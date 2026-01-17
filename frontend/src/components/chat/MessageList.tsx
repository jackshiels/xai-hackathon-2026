import { useEffect, useRef } from 'react';
import type { Message } from './types';

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
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
  );
}
