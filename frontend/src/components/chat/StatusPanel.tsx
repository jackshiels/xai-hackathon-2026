import type { ChatStatus } from './types';

interface StatusPanelProps {
  status: ChatStatus;
  statusText: string;
  micStatus: string;
  backendUrl: string;
  onBackendUrlChange: (value: string) => void;
  voice: string;
  onVoiceChange: (value: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  isConnected: boolean;
  debugEnabled: boolean;
  onDebugToggle: (value: boolean) => void;
}

export function StatusPanel({
  status,
  statusText,
  micStatus,
  backendUrl,
  onBackendUrlChange,
  voice,
  onVoiceChange,
  onConnect,
  onDisconnect,
  isConnected,
  debugEnabled,
  onDebugToggle,
}: StatusPanelProps) {
  return (
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
          onChange={(e) => onBackendUrlChange(e.target.value)}
          placeholder="Backend URL"
          className="flex-1 rounded-xl border border-[rgba(var(--ink),0.15)] bg-[rgb(var(--surface-strong))] px-4 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-[rgba(var(--accent-strong),0.45)]"
        />
        <select
          value={voice}
          onChange={(e) => onVoiceChange(e.target.value)}
          className="rounded-xl border border-[rgba(var(--ink),0.15)] bg-[rgb(var(--surface-strong))] px-4 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-[rgba(var(--accent-strong),0.45)]"
        >
          <option value="Ara">Ara (Female)</option>
          <option value="Rex">Rex (Male)</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onConnect}
          disabled={isConnected}
          className="rounded-full bg-[rgb(var(--accent-strong))] px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-white shadow-[0_12px_25px_rgba(214,106,71,0.35)] transition hover:bg-[rgb(var(--accent))] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Start Conversation
        </button>
        <button
          type="button"
          onClick={onDisconnect}
          disabled={!isConnected}
          className="rounded-full border border-[rgba(var(--ink),0.2)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-ink transition hover:border-[rgba(var(--ink),0.4)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Disconnect
        </button>
        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-[rgba(var(--ink),0.7)]">
          <input
            type="checkbox"
            checked={debugEnabled}
            onChange={(e) => onDebugToggle(e.target.checked)}
            className="h-4 w-4 rounded border border-[rgba(var(--ink),0.2)] text-[rgb(var(--accent-strong))] focus:ring-2 focus:ring-[rgba(var(--accent-strong),0.45)]"
          />
          Show Debug Logs
        </label>
      </div>
    </div>
  );
}
