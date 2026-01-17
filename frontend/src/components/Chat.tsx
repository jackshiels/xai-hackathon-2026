import type { FormEvent } from 'react';
import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChatHeader } from './chat/ChatHeader';
import { DebugPanel } from './chat/DebugPanel';
import { MessageInput } from './chat/MessageInput';
import { MessageList } from './chat/MessageList';
import { StatusPanel } from './chat/StatusPanel';
import { useVoiceChat } from './chat/useVoiceChat';

function Chat() {
  const { username } = useParams<{ username: string }>();
  const [inputText, setInputText] = useState('');
  const {
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
  } = useVoiceChat();

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      sendMessage(inputText);
      if (inputText.trim()) setInputText('');
    },
    [inputText, sendMessage]
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <ChatHeader username={username} />
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[rgba(var(--ink),0.08)] bg-[rgb(var(--surface-strong))] shadow-[0_24px_60px_rgba(22,27,38,0.18)]">
        <header className="border-b border-[rgba(var(--ink),0.08)] bg-[rgba(var(--surface),0.6)] p-4">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[rgba(var(--muted),0.9)]">
            Conversation
          </p>
        </header>

        <StatusPanel
          status={status}
          statusText={statusText}
          micStatus={micStatus}
          backendUrl={backendUrl}
          onBackendUrlChange={setBackendUrl}
          voice={voice}
          onVoiceChange={setVoice}
          onConnect={connect}
          onDisconnect={disconnect}
          isConnected={isConnected}
          debugEnabled={debugEnabled}
          onDebugToggle={setDebugEnabled}
        />

        {error && (
          <div className="border-b border-[rgba(var(--ink),0.08)] bg-red-50 px-6 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <MessageList messages={messages} />

        {debugEnabled && <DebugPanel logs={debugLogs} />}

        <MessageInput
          inputText={inputText}
          onInputChange={setInputText}
          onSubmit={handleSubmit}
          onToggleMic={toggleMic}
          isMicActive={isMicActive}
        />
      </div>
    </div>
  );
}

export default Chat;
