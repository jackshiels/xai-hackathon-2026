import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatStatus, Message } from './types';

const SAMPLE_RATE = 24000;

const floatTo16BitPCM = (float32Arr: Float32Array) => {
  const pcm16 = new Int16Array(float32Arr.length);
  for (let i = 0; i < float32Arr.length; i += 1) {
    const s = Math.max(-1, Math.min(1, float32Arr[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm16.buffer;
};

class AudioStreamPlayer {
  private context: AudioContext;
  private logDebug: (type: string, msg: string) => void;
  private queue: AudioBuffer[];
  private nextStartTime: number;
  private isPlaying: boolean;

  constructor(context: AudioContext, logDebug: (type: string, msg: string) => void) {
    this.context = context;
    this.logDebug = logDebug;
    this.queue = [];
    this.nextStartTime = 0;
    this.isPlaying = false;
  }

  addPCM16(base64: string) {
    try {
      const binary = atob(base64);
      if (binary.length % 2 !== 0) {
        this.logDebug('AUDIO_ERR', 'Odd byte length, skipping frame');
        return;
      }

      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i += 1) float32[i] = pcm16[i] / 32768.0;

      this.logDebug('AUDIO', `Queued ${float32.length} samples`);

      const buffer = this.context.createBuffer(1, float32.length, SAMPLE_RATE);
      buffer.getChannelData(0).set(float32);

      this.queue.push(buffer);
      this.schedule();
    } catch (e) {
      if (e instanceof Error) {
        this.logDebug('AUDIO_ERR', e.message);
      }
    }
  }

  private schedule() {
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

export function useVoiceChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [backendUrl, setBackendUrl] = useState('http://localhost:8000');
  const [voice, setVoice] = useState('Ara');
  const [status, setStatus] = useState<ChatStatus>('disconnected');
  const [statusText, setStatusText] = useState('Disconnected');
  const [micStatus, setMicStatus] = useState('(Mic Inactive)');
  const [isConnected, setIsConnected] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
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

  const setStatusState = useCallback((nextStatus: ChatStatus, nextText: string) => {
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

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim()) return;

      appendMessage('user', text.trim());

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
    },
    [appendMessage]
  );

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
      audioPlayerRef.current = new AudioStreamPlayer(audioContextRef.current, logDebug);
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
  }, [setStatusState]);

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

  useEffect(() => {
    debugEnabledRef.current = debugEnabled;
  }, [debugEnabled]);

  useEffect(() => () => disconnect(), [disconnect]);

  return {
    messages,
    backendUrl,
    setBackendUrl,
    voice,
    setVoice,
    status,
    statusText,
    micStatus,
    isConnected,
    isMicActive,
    error,
    debugEnabled,
    setDebugEnabled,
    debugLogs,
    sendMessage,
    connect,
    disconnect,
    toggleMic,
  };
}
