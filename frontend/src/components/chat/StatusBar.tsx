import type { Status } from './types';

type Props = {
  status: Status;
  text: string;
  micText: string;
};

const statusColors: Record<Status, string> = {
  disconnected: 'bg-red-500',
  connecting: 'bg-amber-400 animate-pulse',
  listening: 'bg-emerald-400 animate-pulse',
  speaking: 'bg-sky-400',
  responding: 'bg-indigo-400',
};

export function StatusBar({ status, text, micText }: Props) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-white shadow-lg backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full ${statusColors[status]}`} />
        <div className="flex flex-col leading-tight">
          <span className="font-semibold text-white">{text}</span>
          <span className="text-[11px] text-gray-400">{micText}</span>
        </div>
      </div>
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-400">Realtime</span>
    </div>
  );
}
