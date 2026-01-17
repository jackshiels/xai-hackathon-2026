import type { FormEvent } from 'react';
import { Mic, MicOff } from 'lucide-react';

interface MessageInputProps {
  inputText: string;
  onInputChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onToggleMic: () => void | Promise<void>;
  isMicActive: boolean;
}

export function MessageInput({
  inputText,
  onInputChange,
  onSubmit,
  onToggleMic,
  isMicActive,
}: MessageInputProps) {
  return (
    <form onSubmit={onSubmit} className="border-t border-[rgba(var(--ink),0.08)] bg-[rgba(var(--surface),0.6)] p-4">
      <div className="flex items-center space-x-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 rounded-full border border-[rgba(var(--ink),0.15)] bg-[rgb(var(--surface-strong))] px-4 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-[rgba(var(--accent-strong),0.45)]"
        />
        <button
          type="button"
          onClick={onToggleMic}
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
  );
}
