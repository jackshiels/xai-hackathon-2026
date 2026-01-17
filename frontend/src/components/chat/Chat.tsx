import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';
import { DebugPanel } from './DebugPanel';
import { StatusBar } from './StatusBar';
import { Transcript } from './Transcript';
import type { Message, Status } from './types';

const SAMPLE_RATE = 24000;
const ORT_SRC = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.js';
const VAD_SRC = 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.7/dist/bundle.min.js';

declare const vad: any;

type WSMessage = {
  type: string;
  delta?: string;
  transcript?: string;
  error?: { message?: string };
};

type PublicMetrics = {
  followers_count: number;
  following_count: number;
  tweet_count: number;
  listed_count?: number;
};

type UserProfile = {
  _id?: string;
  id?: string;
  username: string;
  name: string;
  description?: string;
  profile_image_url?: string;
  profile_banner_url?: string;
  public_metrics?: PublicMetrics;
  tags?: string[];
  voice_id?: string;
};

class AudioStreamPlayer {
  private queue: AudioBuffer[] = [];
  private nextStartTime = 0;
  private isPlaying = false;

  constructor(private context: AudioContext, private log: (type: string, msg: string) => void) {}

  addPCM16(base64: string) {
    try {
      const binary = atob(base64);
      if (binary.length % 2 !== 0) {
        this.log('AUDIO_ERR', 'Odd byte length, skipping frame');
        return;
      }

      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768.0;

      this.log('AUDIO', `Queued ${float32.length} samples`);

      const buffer = this.context.createBuffer(1, float32.length, SAMPLE_RATE);
      buffer.getChannelData(0).set(float32);

      this.queue.push(buffer);
      this.schedule();
    } catch (e) {
      this.log('AUDIO_ERR', e instanceof Error ? e.message : 'Unknown audio error');
    }
  }

  private schedule() {
    if (this.queue.length === 0 || this.isPlaying) return;
    this.isPlaying = true;
    const buffer = this.queue.shift();
    if (!buffer) {
      this.isPlaying = false;
      return;
    }

    const src = this.context.createBufferSource();
    src.buffer = buffer;
    src.connect(this.context.destination);

    const now = this.context.currentTime;
    if (this.nextStartTime < now) this.nextStartTime = now;

    src.start(this.nextStartTime);
    this.nextStartTime += buffer.duration;

    src.onended = () => {
      this.isPlaying = false;
      this.schedule();
    };
  }

  reset() {
    this.queue = [];
    this.isPlaying = false;
    this.nextStartTime = 0;
  }
}

async function ensureScript(src: string) {
  const existing = document.querySelector(`script[src=\"${src}\"]`);
  if (existing) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function floatTo16BitPCM(float32Arr: Float32Array) {
  const pcm16 = new Int16Array(float32Arr.length);
  for (let i = 0; i < float32Arr.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Arr[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm16.buffer;
}

export default function Chat() {
  const location = useLocation();
  const { username } = useParams<{ username: string }>();
  const [searchParams] = useSearchParams();
  const profileId = useMemo(() => searchParams.get('profileID') ?? username ?? null, [searchParams, username]);
  const initialVoice =
    (location.state as { voice?: string } | null)?.voice && typeof (location.state as { voice?: string }).voice === 'string'
      ? (location.state as { voice?: string }).voice
      : 'Ara';

  const [backendUrl, setBackendUrl] = useState('http://localhost:8000');
  const [voice, setVoice] = useState(initialVoice);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [systemInstructions, setSystemInstructions] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [status, setStatus] = useState<Status>('disconnected');
  const [statusText, setStatusText] = useState('Disconnected');
  const [micText, setMicText] = useState('(Mic Inactive)');
  const [messages, setMessages] = useState<Message[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const vadRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioPlayerRef = useRef<AudioStreamPlayer | null>(null);
  const showDebugRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    showDebugRef.current = showDebug;
  }, [showDebug]);

  const logDebug = useCallback((type: string, msg: string) => {
    if (!showDebugRef.current) return;
    const entry = `[${new Date().toLocaleTimeString()}] [${type}] ${msg}`;
    setLogs((prev) => [entry, ...prev].slice(0, 200));
  }, []);

  const updateStatus = useCallback((state: Status, text: string) => {
    setStatus(state);
    setStatusText(text);
  }, []);

  const appendMessage = useCallback((role: 'user' | 'assistant', text: string, isStream = false) => {
    setMessages((prev) => {
      if (role === 'assistant' && isStream && prev.length && prev[prev.length - 1].role === 'assistant') {
        const next = [...prev];
        next[next.length - 1] = { ...next[next.length - 1], content: next[next.length - 1].content + text };
        return next;
      }
      const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      return [...prev, { id, role, content: text }];
    });
  }, [updateStatus]);

  const initVAD = useCallback(async () => {
    if (!audioContextRef.current) return;
    if (vadRef.current) {
      await vadRef.current.destroy?.();
    }
    vadRef.current = await vad.MicVAD.new({
      positiveSpeechThreshold: 0.8,
      onSpeechStart: () => {
        audioPlayerRef.current?.reset();
        updateStatus('speaking', 'Speaking...');
        setMicText('(Capturing...)');
      },
      onSpeechEnd: (audio: Float32Array) => {
        updateStatus('responding', 'Processing...');
        setMicText('(Processing...)');
        const pcm16 = floatTo16BitPCM(audio);
        const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16)));
        if (wsRef.current && wsRef.current.readyState === 1) {
          wsRef.current.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: base64 }));
          wsRef.current.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
        }
      },
      sampleRate: SAMPLE_RATE,
      audioContext: audioContextRef.current,
    });
    vadRef.current.start();
  }, []);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      const msg: WSMessage = JSON.parse(event.data);
      if (msg.type?.endsWith('audio.delta')) {
        logDebug('RX_AUDIO', `Received ${msg.delta?.length ?? 0} chars`);
        if (msg.delta && audioPlayerRef.current) {
          audioPlayerRef.current.addPCM16(msg.delta);
        }
      } else if (msg.type?.endsWith('transcript.delta') || msg.type?.endsWith('text.delta')) {
        if (msg.delta) appendMessage('assistant', msg.delta, true);
      } else if (msg.type === 'response.created') {
        updateStatus('responding', 'Grok speaking...');
        appendMessage('assistant', '', true);
      } else if (msg.type === 'response.done') {
        updateStatus('listening', 'Listening...');
        setMicText('(Listening...)');
      } else if (msg.type === 'conversation.item.input_audio_transcription.completed') {
        if (msg.transcript) appendMessage('user', msg.transcript);
      } else if (msg.type === 'error') {
        const message = msg.error?.message ?? 'Unknown error';
        logDebug('ERR', message);
        setError(message);
        updateStatus('disconnected', 'Disconnected');
      }
    },
    [appendMessage, logDebug, updateStatus],
  );

  const connect = useCallback(async () => {
    if (!profileId) {
      setError('Missing profileID. Please return and pick a profile.');
      return;
    }
    if (!systemInstructions) {
      setError('Session instructions are not ready yet. Please wait a moment.');
      return;
    }

    if (wsRef.current) wsRef.current.close();
    setError(null);
    updateStatus('connecting', 'Authenticating...');

    try {
      await ensureScript(ORT_SRC);
      await ensureScript(VAD_SRC);

      const res = await fetch(`${backendUrl}/session`, { method: 'POST' });
      if (!res.ok) throw new Error('Auth Failed');
      const data = await res.json();
      const token = data.client_secret?.value || data.token || data.value;

      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: SAMPLE_RATE });
      await ctx.resume();
      audioContextRef.current = ctx;
      audioPlayerRef.current = new AudioStreamPlayer(ctx, logDebug);
      logDebug('SYS', 'Audio Context Started');

      const ws = new WebSocket(
        'wss://api.x.ai/v1/realtime?model=grok-beta-realtime',
        ['realtime', `openai-insecure-api-key.${token}`],
      );
      wsRef.current = ws;

      ws.onopen = async () => {
        logDebug('WS', 'Connected');
        ws.send(
          JSON.stringify({
            type: 'session.update',
            session: {
              modalities: ['text', 'audio'],
              instructions: systemInstructions,
              voice,
              input_audio_format: 'pcm16',
              output_audio_format: 'pcm16',
              turn_detection: null,
              input_audio_transcription: { model: 'whisper-1' },
            },
          }),
        );

        await initVAD();
        updateStatus('listening', 'Connected');
        setMicText('(Listening...)');
      };

      ws.onmessage = handleMessage;
      ws.onerror = () => {
        setError('WebSocket error');
        updateStatus('disconnected', 'Disconnected');
      };
      ws.onclose = () => {
        updateStatus('disconnected', 'Disconnected');
        setMicText('(Mic Inactive)');
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      setError(message);
      updateStatus('disconnected', 'Disconnected');
    }
  }, [appendMessage, backendUrl, handleMessage, initVAD, logDebug, profileId, systemInstructions, updateStatus, voice]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    vadRef.current?.destroy?.();
    vadRef.current = null;
    audioContextRef.current?.close();
    audioContextRef.current = null;
    audioPlayerRef.current = null;
    if (isMountedRef.current) {
      updateStatus('disconnected', 'Disconnected');
      setMicText('(Mic Inactive)');
    }
  }, [updateStatus]);

  useEffect(() => {
    const stateVoice = (location.state as { voice?: string } | null)?.voice;
    if (stateVoice && typeof stateVoice === 'string') {
      setVoice(stateVoice);
    }

    const load = async () => {
      try {
        await ensureScript(ORT_SRC);
        await ensureScript(VAD_SRC);
      } catch (err) {
        console.error(err);
      }
    };
    load();
    return () => {
      isMountedRef.current = false;
      disconnect();
    };
  }, [disconnect, location.state]);

  useEffect(() => {
    const bootstrapSession = async () => {
      if (!profileId) {
        setError('Missing profileID in the URL.');
        return;
      }

      setIsBootstrapping(true);
      updateStatus('connecting', 'Loading profile...');

      try {
        const profileRes = await fetch(`${backendUrl}/api/profile?profileID=${encodeURIComponent(profileId)}`);
        if (!profileRes.ok) {
          throw new Error('Failed to fetch profile');
        }
        const profileData = await profileRes.json();
        setProfile(profileData);
        if (profileData?.voice_id) setVoice(profileData.voice_id);

        const goals =
          Array.isArray(profileData?.conversational_goals) && profileData.conversational_goals.length
            ? profileData.conversational_goals
                .map((g: any) => {
                  if (!g) return null;
                  if (typeof g === 'string') return g;
                  if (typeof g === 'object' && 'description' in g) return g.description;
                  return null;
                })
                .filter(Boolean)
            : [];

        const sessionRes = await fetch(`${backendUrl}/api/session/init`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile_id: profileId, goals }),
        });

        if (!sessionRes.ok) {
          throw new Error('Failed to initialize session');
        }

        const sessionData = await sessionRes.json();
        if (sessionData?.system_instructions) setSystemInstructions(sessionData.system_instructions);
        if (sessionData?.voice_preset) setVoice(sessionData.voice_preset);

        updateStatus('disconnected', 'Ready to connect');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to prepare chat session';
        setError(message);
        updateStatus('disconnected', 'Disconnected');
      } finally {
        setIsBootstrapping(false);
      }
    };

    bootstrapSession();
  }, [backendUrl, profileId, updateStatus]);

  const isConnecting = useMemo(() => status === 'connecting', [status]);
  const isConnected = useMemo(() => status !== 'disconnected' && status !== 'connecting', [status]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-grok-bg text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-1/4 -top-1/3 h-[60vw] w-[60vw] bg-glow-conic opacity-40 blur-3xl" />
        <div className="absolute top-1/2 right-[-12%] -translate-y-1/2 h-[80vw] w-[80vw] nebula-glow rounded-full mix-blend-screen" />
        <div className="absolute top-1/2 right-[-200px] -translate-y-1/2 h-[820px] w-[620px] light-beam" />
      </div>

      <main className="relative z-20 mx-auto w-full max-w-6xl px-4 pb-14">
        <div className="relative w-full select-none text-center">
          <h1 className="mb-24 mt-4 font-sans font-extrabold text-[22vw] leading-none tracking-tight grok-text-gradient opacity-90 mix-blend-overlay md:text-[240px]">
            PersonifX
          </h1>
          <h1 className="pointer-events-none absolute inset-0 font-sans font-extrabold text-[22vw] leading-none tracking-tight text-white blur-3xl opacity-10 md:text-[240px]">
            PersonifX
          </h1>
        </div>

        <div className="relative mt-8 w-full max-w-5xl mx-auto">
          <div className="relative overflow-hidden rounded-[28px] border border-grok-border/60 bg-grok-panel/80 p-6 shadow-[0_30px_90px_-60px_rgba(0,0,0,0.8)] backdrop-blur-2xl ring-1 ring-white/5">
            <div className="pointer-events-none absolute inset-0 opacity-60">
              <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
              <div className="absolute left-16 bottom-0 h-52 w-52 rounded-full bg-blue-500/10 blur-3xl" />
            </div>

            <div className="relative flex flex-col gap-5">
              {profile ? (
                <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 overflow-hidden rounded-full border border-white/10 bg-black/40">
                      {profile.profile_image_url ? (
                        <img src={profile.profile_image_url} alt={profile.username} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-white">
                          {profile.username?.[0]?.toUpperCase() ?? '?'}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-lg font-semibold text-white">{profile.name}</span>
                      <span className="text-sm text-gray-400">@{profile.username}</span>
                    </div>
                    <div className="ml-auto text-xs uppercase tracking-[0.15em] text-gray-300">
                      {profile.public_metrics?.followers_count
                        ? `${profile.public_metrics.followers_count.toLocaleString()} followers`
                        : 'Followers N/A'}
                    </div>
                  </div>
                  {profile.description ? (
                    <p className="text-sm text-gray-200">{profile.description}</p>
                  ) : (
                    <p className="text-sm text-gray-400">No bio available.</p>
                  )}
                  {profile.tags && profile.tags.length ? (
                    <div className="flex flex-wrap gap-2">
                      {profile.tags.slice(0, 5).map((tag) => (
                        <span key={tag} className="rounded-full border border-white/10 bg-white/10 px-2 py-[2px] text-[11px] text-gray-200">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <StatusBar status={status} text={statusText} micText={micText} />

              <Transcript messages={messages} />

              {error ? (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 shadow-inner">
                  {error}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={connect}
                  disabled={isConnecting || isBootstrapping || !systemInstructions}
                  className="group relative overflow-hidden rounded-full border border-white/30 bg-white px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-black shadow-xl transition-all duration-300 hover:-translate-y-[1px] hover:shadow-white/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="relative z-10">
                    {isConnecting ? 'Connecting...' : isBootstrapping ? 'Preparing...' : 'Start Conversation'}
                  </span>
                  <span className="absolute inset-0 bg-gradient-to-r from-white via-white to-gray-200 opacity-0 transition group-hover:opacity-20" />
                </button>
                <button
                  onClick={disconnect}
                  disabled={!isConnected}
                  className="rounded-full border border-white/20 px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-200 transition duration-300 hover:-translate-y-[1px] hover:border-white/40 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Disconnect
                </button>
              </div>

              <DebugPanel show={showDebug} logs={logs} onToggle={setShowDebug} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
