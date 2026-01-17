import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const [backendUrl, setBackendUrl] = useState('http://localhost:8000');
  const [voice, setVoice] = useState('Ara');
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
              instructions: 'You are a helpful AI.',
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
  }, [appendMessage, backendUrl, handleMessage, initVAD, logDebug, updateStatus, voice]);

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
  }, [disconnect]);

  const isConnecting = useMemo(() => status === 'connecting', [status]);
  const isConnected = useMemo(() => status !== 'disconnected' && status !== 'connecting', [status]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-grok-bg text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-1/4 -top-1/3 h-[60vw] w-[60vw] bg-glow-conic opacity-40 blur-3xl" />
        <div className="absolute top-1/2 right-[-12%] -translate-y-1/2 h-[80vw] w-[80vw] nebula-glow rounded-full mix-blend-screen" />
        <div className="absolute top-1/2 right-[-200px] -translate-y-1/2 h-[820px] w-[620px] light-beam" />
      </div>

      <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
            <svg viewBox="0 0 24 24" fill="white" className="h-5 w-5">
              <path d="M12 2 2 19h20L12 2Zm0 4 6.5 11h-13L12 6Z" fill="currentColor" />
            </svg>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-gray-400">Realtime</p>
            <p className="text-sm text-gray-200">Voice Agent Console</p>
          </div>
        </div>
        <nav className="hidden items-center space-x-6 text-[11px] font-mono uppercase tracking-[0.18em] text-gray-500 md:flex">
          <a className="transition hover:text-white" href="#">Grok</a>
          <a className="transition hover:text-white" href="#">API</a>
          <a className="transition hover:text-white" href="#">Company</a>
          <a className="transition hover:text-white" href="#">Colossus</a>
          <a className="transition hover:text-white" href="#">Careers</a>
          <a className="transition hover:text-white" href="#">News</a>
          <a className="transition hover:text-white" href="#">Shop</a>
        </nav>
        <div className="flex items-center justify-end">
          <button className="font-mono text-[10px] uppercase tracking-[0.2em] rounded-full border border-white/20 px-4 py-2 transition-all duration-300 hover:-translate-y-[1px] hover:bg-white hover:text-black">
            Try Grok
          </button>
        </div>
      </header>

      <main className="relative z-20 mx-auto w-full max-w-5xl px-4 pb-14">
        <div className="relative w-full select-none text-center">
          <h1 className="font-sans font-extrabold text-[22vw] leading-none tracking-tight grok-text-gradient opacity-90 mix-blend-overlay md:text-[240px]">
            Grok
          </h1>
          <h1 className="pointer-events-none absolute inset-0 font-sans font-extrabold text-[22vw] leading-none tracking-tight text-white blur-3xl opacity-10 md:text-[240px]">
            Grok
          </h1>
        </div>
        <p className="mt-[-10px] text-center text-gray-400 md:text-lg">
          Realtime xAI voice console with live transcripts, session controls, and debug traces.
        </p>

        <div className="relative mt-8">
          <div className="relative overflow-hidden rounded-[28px] border border-grok-border/60 bg-grok-panel/80 p-6 shadow-[0_30px_90px_-60px_rgba(0,0,0,0.8)] backdrop-blur-2xl ring-1 ring-white/5">
            <div className="pointer-events-none absolute inset-0 opacity-60">
              <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
              <div className="absolute left-16 bottom-0 h-52 w-52 rounded-full bg-blue-500/10 blur-3xl" />
            </div>

            <div className="relative flex flex-col gap-5">
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
                  disabled={isConnecting}
                  className="group relative overflow-hidden rounded-full border border-white/30 bg-white px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-black shadow-xl transition-all duration-300 hover:-translate-y-[1px] hover:shadow-white/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="relative z-10">{isConnecting ? 'Connecting...' : 'Start Conversation'}</span>
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

      <footer className="relative z-20 mx-auto w-full max-w-5xl px-6 pb-8 pt-2">
        <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 shadow-lg backdrop-blur md:flex-row md:gap-0">
          <div className="flex flex-1 justify-start">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="white" className="h-6 w-6 opacity-50 animate-bounce">
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 13.5-7.5 7.5m0 0L4.5 13.5M12 21V3" />
            </svg>
          </div>
          <div className="flex flex-1 items-center justify-center text-center">
            <p className="text-xs font-medium tracking-wide text-gray-300 md:text-sm">
              xAI Raises $20B Series E: xAI is rapidly accelerating its progress in building advanced AI.
            </p>
          </div>
          <div className="flex flex-1 justify-end">
            <a
              href="#"
              className="group flex items-center space-x-2 rounded-full border border-white/20 px-5 py-2 transition-all hover:bg-white/5"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-300 group-hover:text-white">
                Read Announcement
              </span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
