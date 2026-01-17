interface DebugPanelProps {
  logs: string[];
}

export function DebugPanel({ logs }: DebugPanelProps) {
  return (
    <div className="border-t border-[rgba(var(--ink),0.08)] bg-[rgba(var(--surface),0.6)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(var(--muted),0.9)]">
        Server Events &amp; Audio Logs
      </p>
      <div className="mt-2 max-h-40 overflow-y-auto rounded-lg bg-black/90 p-3 text-xs text-green-400">
        {logs.length === 0 ? (
          <p className="text-green-500/70">No logs yet.</p>
        ) : (
          logs.map((entry, index) => <div key={`${entry}-${index}`}>{entry}</div>)
        )}
      </div>
    </div>
  );
}
