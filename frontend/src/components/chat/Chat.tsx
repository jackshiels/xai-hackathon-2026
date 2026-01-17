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
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="rounded-3xl border border-white/60 bg-white/80 p-8 shadow-xl backdrop-blur">
        <h1 className="mb-6 text-2xl font-semibold text-ink">Grok Voice Agent</h1>

        <div className="space-y-4">
          <StatusBar status={status} text={statusText} micText={micText} />

          <Transcript messages={messages} />

          {error ? (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-inner">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={connect}
              disabled={isConnecting}
              className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold shadow transition hover:-translate-y-[1px] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isConnecting ? 'Connecting...' : 'Start Conversation'}
            </button>
            <button
              onClick={disconnect}
              disabled={!isConnected}
              className="rounded-xl border border-white/60 bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:-translate-y-[1px] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
            >
              Disconnect
            </button>
          </div>

          <DebugPanel show={showDebug} logs={logs} onToggle={setShowDebug} />
        </div>
      </div>
    </div>
  );
}
