type Props = {
  show: boolean;
  logs: string[];
  onToggle: (value: boolean) => void;
};

export function DebugPanel({ show, logs, onToggle }: Props) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm text-gray-400">
        <input
          type="checkbox"
          className="h-4 w-4 accent-white"
          checked={show}
          onChange={(e) => onToggle(e.target.checked)}
        />
        Show Debug Logs
      </label>
      {show ? (
        <div className="rounded-2xl border border-white/10 bg-black/60 text-emerald-200 shadow-inner backdrop-blur">
          <div className="border-b border-white/10 px-4 py-2 text-xs font-semibold text-white">
            Server Events &amp; Audio Logs
          </div>
          <div className="max-h-48 overflow-y-auto px-4 py-3 text-[12px] font-mono leading-relaxed">
            {logs.length === 0 ? (
              <div className="text-white/60">No logs yet</div>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="border-b border-white/10 py-1 last:border-none">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
