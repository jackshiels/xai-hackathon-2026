import type { Status } from './types';

type Props = {
  status: Status;
  text: string;
  micText: string;
};

const statusColors: Record<Status, string> = {
  disconnected: 'bg-red-500',
  connecting: 'bg-amber-400',
  listening: 'bg-emerald-500 animate-pulse',
  speaking: 'bg-orange-500',
  responding: 'bg-blue-500',
};

export function StatusBar({ status, text, micText }: Props) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/60 bg-white/80 px-5 py-3 shadow-sm backdrop-blur">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink">
        <span className={`h-2.5 w-2.5 rounded-full ${statusColors[status]}`} />
        <span>{text}</span>
      </div>
      <div className="text-xs text-muted">{micText}</div>
    </div>
  );
}
