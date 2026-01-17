import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Mic, MicOff } from 'lucide-react';

const SAMPLE_RATE = 24000;

const floatTo16BitPCM = (float32Arr: Float32Array) => {
  const pcm16 = new Int16Array(float32Arr.length);
  for (let i = 0; i < float32Arr.length; i += 1) {
    const s = Math.max(-1, Math.min(1, float32Arr[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm16.buffer;
};

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  streaming?: boolean;
}

function Chat() {
  const { username } = useParams<{ username: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [backendUrl, setBackendUrl] = useState('http://localhost:8000');
  const [voice, setVoice] = useState('Ara');
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'listening' | 'speaking' | 'responding'>(
    'disconnected'
  );
  const [statusText, setStatusText] = useState('Disconnected');
  const [micStatus, setMicStatus] = useState('(Mic Inactive)');
  const [isConnected, setIsConnected] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const vadRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioPlayerRef = useRef<AudioStreamPlayer | null>(null);
  const messageIdRef = useRef(0);
  const debugEnabledRef = useRef(false);

  const logDebug = useCallback((type: string, msg: string) => {
    if (!debugEnabledRef.current) return;
    const entry = `[${new Date().toLocaleTimeString()}] [${type}] ${msg}`;
    setDebugLogs((prev) => [entry, ...prev].slice(0, 200));
  }, []);

  class AudioStreamPlayer {
    context: AudioContext;
    queue: AudioBuffer[];
    nextStartTime: number;
    isPlaying: boolean;

    constructor(context: AudioContext) {
      this.context = context;
      this.queue = [];
      this.nextStartTime = 0;
      this.isPlaying = false;
    }

    addPCM16(base64: string) {
      try {
        const binary = atob(base64);
        if (binary.length % 2 !== 0) {
          logDebug('AUDIO_ERR', 'Odd byte length, skipping frame');
          return;
        }

        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

        const pcm16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(pcm16.length);
        for (let i = 0; i < pcm16.length; i += 1) float32[i] = pcm16[i] / 32768.0;

        logDebug('AUDIO', `Queued ${float32.length} samples`);

        const buffer = this.context.createBuffer(1, float32.length, SAMPLE_RATE);
        buffer.getChannelData(0).set(float32);

        this.queue.push(buffer);
        this.schedule();
      } catch (e) {
        if (e instanceof Error) {
          logDebug('AUDIO_ERR', e.message);
        }
      }
    }

    schedule() {
      if (this.queue.length === 0 || this.isPlaying) return;
      this.isPlaying = true;
      const buffer = this.queue.shift();
      if (!buffer) return;
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

  const setStatusState = useCallback((nextStatus: typeof status, nextText: string) => {
    setStatus(nextStatus);
    setStatusText(nextText);
  }, []);

  const appendMessage = useCallback((role: 'user' | 'assistant', text: string, isStream = false) => {
    setMessages((prev) => {
      if (role === 'assistant' && isStream) {
        const last = prev[prev.length - 1];
        if (last && last.sender === 'bot' && last.streaming) {
          return [
            ...prev.slice(0, -1),
            { ...last, text: `${last.text}${text}`, timestamp: new Date() },
          ];
        }
      }
      const newMessage: Message = {
        id: messageIdRef.current + 1,
        text,
        sender: role === 'user' ? 'user' : 'bot',
        timestamp: new Date(),
        streaming: isStream,
      };
      messageIdRef.current += 1;
      return [...prev, newMessage];
    });
  }, []);

  const finalizeStreamingMessage = useCallback(() => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.sender !== 'bot' || !last.streaming) return prev;
      return [...prev.slice(0, -1), { ...last, streaming: false }];
    });
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);
  useEffect(() => {
    debugEnabledRef.current = debugEnabled;
  }, [debugEnabled]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;

    appendMessage('user', text.trim());
    setInputText('');

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [{ type: 'input_text', text: text.trim() }],
          },
        })
      );
      wsRef.current.send(JSON.stringify({ type: 'response.create' }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputText);
  };

  const initVAD = useCallback(async () => {
    const vadLib = (window as any).vad;
    if (!vadLib) {
      throw new Error('VAD library not loaded. Check script tags in index.html.');
    }
    if (!audioContextRef.current) {
      throw new Error('Audio context not initialized.');
    }

    vadRef.current = await vadLib.MicVAD.new({
      positiveSpeechThreshold: 0.8,
      onSpeechStart: () => {
        audioPlayerRef.current?.reset();
        setStatusState('speaking', 'Speaking...');
      },
      onSpeechEnd: (audio: Float32Array) => {
        setStatusState('responding', 'Processing...');
        const pcm16 = floatTo16BitPCM(audio);
        const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16)));
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: base64 }));
          wsRef.current.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
        }
      },
      sampleRate: SAMPLE_RATE,
      audioContext: audioContextRef.current,
    });
    vadRef.current.start();
    setIsMicActive(true);
  }, [setStatusState]);

  const connect = useCallback(async () => {
    if (isConnected) return;
    setStatusState('connecting', 'Authenticating...');
    setError(null);

    try {
      const res = await fetch(`${backendUrl}/session`, { method: 'POST' });
      if (!res.ok) throw new Error('Auth Failed');
      const data = await res.json();
      const token = data.client_secret?.value || data.token || data.value;

      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextCtor({ sampleRate: SAMPLE_RATE });
      await audioContextRef.current.resume();
      audioPlayerRef.current = new AudioStreamPlayer(audioContextRef.current);
      logDebug('SYS', 'Audio Context Started');

      wsRef.current = new WebSocket('wss://api.x.ai/v1/realtime?model=grok-beta-realtime', [
        'realtime',
        `openai-insecure-api-key.${token}`,
      ]);

      wsRef.current.onopen = async () => {
        logDebug('WS', 'Connected');
        wsRef.current?.send(
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
          })
        );

        await initVAD();
        setStatusState('listening', 'Connected');
        setMicStatus('(Listening...)');
        setIsConnected(true);
      };

      wsRef.current.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type.endsWith('audio.delta')) {
          logDebug('RX_AUDIO', `Received ${msg.delta.length} chars`);
          audioPlayerRef.current?.addPCM16(msg.delta);
        } else if (msg.type.endsWith('transcript.delta') || msg.type.endsWith('text.delta')) {
          appendMessage('assistant', msg.delta, true);
        } else if (msg.type === 'response.created') {
          setStatusState('responding', 'Grok speaking...');
          appendMessage('assistant', '', true);
        } else if (msg.type === 'response.done') {
          setStatusState('listening', 'Listening...');
          finalizeStreamingMessage();
        } else if (msg.type === 'conversation.item.input_audio_transcription.completed') {
          if (msg.transcript) appendMessage('user', msg.transcript);
        } else if (msg.type === 'error') {
          logDebug('ERR', msg.error.message);
        }
      };

      wsRef.current.onclose = () => {
        setStatusState('disconnected', 'Disconnected');
        setMicStatus('(Mic Inactive)');
        setIsConnected(false);
        setIsMicActive(false);
      };
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unknown error');
      }
      setStatusState('disconnected', 'Disconnected');
    }
  }, [appendMessage, backendUrl, finalizeStreamingMessage, initVAD, isConnected, logDebug, setStatusState, voice]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    vadRef.current?.destroy?.();
    vadRef.current = null;
    audioContextRef.current?.close();
    audioContextRef.current = null;
    audioPlayerRef.current = null;
    setStatusState('disconnected', 'Disconnected');
    setMicStatus('(Mic Inactive)');
    setIsConnected(false);
    setIsMicActive(false);
  }, []);

  const toggleMic = useCallback(async () => {
    if (!isConnected) {
      await connect();
      return;
    }
    if (isMicActive) {
      vadRef.current?.destroy?.();
      vadRef.current = null;
      setIsMicActive(false);
      setMicStatus('(Mic Inactive)');
      setStatusState('listening', 'Muted');
    } else {
      await initVAD();
      setMicStatus('(Listening...)');
    }
  }, [connect, initVAD, isConnected, isMicActive, setStatusState]);

  useEffect(() => () => disconnect(), [disconnect]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-8 text-ink">Chat with @{username}</h1>
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[rgba(var(--ink),0.08)] bg-[rgb(var(--surface-strong))] shadow-[0_24px_60px_rgba(22,27,38,0.18)]">
        <header className="border-b border-[rgba(var(--ink),0.08)] bg-[rgba(var(--surface),0.6)] p-4">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[rgba(var(--muted),0.9)]">
            Conversation
          </p>
        </header>

        <div className="space-y-4 border-b border-[rgba(var(--ink),0.08)] bg-[rgba(var(--surface),0.6)] p-4">
          <div
            className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${
              status === 'disconnected'
                ? 'border-red-200 bg-red-50 text-red-700'
                : status === 'connecting'
                  ? 'border-yellow-200 bg-yellow-50 text-yellow-700'
                  : status === 'speaking'
                    ? 'border-orange-200 bg-orange-50 text-orange-700'
                    : status === 'responding'
                      ? 'border-blue-200 bg-blue-50 text-blue-700'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            <span className="font-semibold">{statusText}</span>
            <span className="text-xs text-[rgba(var(--ink),0.7)]">{micStatus}</span>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            <input
              type="text"
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              placeholder="Backend URL"
              className="flex-1 rounded-xl border border-[rgba(var(--ink),0.15)] bg-[rgb(var(--surface-strong))] px-4 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-[rgba(var(--accent-strong),0.45)]"
            />
            <select
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              className="rounded-xl border border-[rgba(var(--ink),0.15)] bg-[rgb(var(--surface-strong))] px-4 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-[rgba(var(--accent-strong),0.45)]"
            >
              <option value="Ara">Ara (Female)</option>
              <option value="Rex">Rex (Male)</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={connect}
              disabled={isConnected}
              className="rounded-full bg-[rgb(var(--accent-strong))] px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-white shadow-[0_12px_25px_rgba(214,106,71,0.35)] transition hover:bg-[rgb(var(--accent))] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Start Conversation
            </button>
            <button
              type="button"
              onClick={disconnect}
              disabled={!isConnected}
              className="rounded-full border border-[rgba(var(--ink),0.2)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-ink transition hover:border-[rgba(var(--ink),0.4)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Disconnect
            </button>
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-[rgba(var(--ink),0.7)]">
              <input
                type="checkbox"
                checked={debugEnabled}
                onChange={(e) => setDebugEnabled(e.target.checked)}
                className="h-4 w-4 rounded border border-[rgba(var(--ink),0.2)] text-[rgb(var(--accent-strong))] focus:ring-2 focus:ring-[rgba(var(--accent-strong),0.45)]"
              />
              Show Debug Logs
            </label>
          </div>
        </div>

        {error && (
          <div className="border-b border-[rgba(var(--ink),0.08)] bg-red-50 px-6 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="h-96 overflow-y-auto space-y-4 bg-[rgba(var(--surface),0.6)] p-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs rounded-2xl px-4 py-3 text-sm lg:max-w-md ${
                  message.sender === 'user'
                    ? 'bg-[rgb(var(--accent))] text-[rgb(var(--ink))] shadow-[0_12px_30px_rgba(237,176,119,0.35)]'
                    : 'border border-[rgba(var(--ink),0.1)] bg-[rgb(var(--surface-strong))] text-ink'
                }`}
              >
                <p>{message.text}</p>
                <p className="mt-2 text-xs text-[rgba(var(--ink),0.6)]">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {debugEnabled && (
          <div className="border-t border-[rgba(var(--ink),0.08)] bg-[rgba(var(--surface),0.6)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(var(--muted),0.9)]">
              Server Events &amp; Audio Logs
            </p>
            <div className="mt-2 max-h-40 overflow-y-auto rounded-lg bg-black/90 p-3 text-xs text-green-400">
              {debugLogs.length === 0 ? (
                <p className="text-green-500/70">No logs yet.</p>
              ) : (
                debugLogs.map((entry, index) => <div key={`${entry}-${index}`}>{entry}</div>)
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="border-t border-[rgba(var(--ink),0.08)] bg-[rgba(var(--surface),0.6)] p-4">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 rounded-full border border-[rgba(var(--ink),0.15)] bg-[rgb(var(--surface-strong))] px-4 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-[rgba(var(--accent-strong),0.45)]"
            />
            <button
              type="button"
              onClick={toggleMic}
              className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm transition ${
                isMicActive
                  ? 'border-emerald-300 bg-emerald-100 text-emerald-700'
                  : 'border-[rgba(var(--ink),0.2)] bg-[rgb(var(--surface-strong))] text-[rgba(var(--ink),0.7)]'
              }`}
              aria-label={isMicActive ? 'Stop microphone' : 'Start microphone'}
            >
              {isMicActive ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button
              type="submit"
              className="rounded-full bg-[rgb(var(--accent-strong))] px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_25px_rgba(214,106,71,0.35)] transition hover:bg-[rgb(var(--accent))] focus:outline-none focus:ring-2 focus:ring-[rgba(var(--accent-strong),0.45)]"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Chat;
