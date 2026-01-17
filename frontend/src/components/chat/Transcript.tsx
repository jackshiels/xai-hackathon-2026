import type { Message } from './types';

type Props = {
  messages: Message[];
};

export function Transcript({ messages }: Props) {
  return (
    <div className="flex h-[400px] flex-col gap-4 overflow-y-auto rounded-2xl border border-white/60 bg-white/90 p-5 shadow-inner backdrop-blur">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex max-w-[85%] flex-col text-sm leading-relaxed ${
            msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'
          }`}
        >
          <div
            className={`rounded-xl px-4 py-2 text-[15px] ${
              msg.role === 'user'
                ? 'rounded-br-sm bg-blue-600 text-white'
                : 'rounded-bl-sm bg-surface text-ink'
            }`}
          >
            {msg.content}
          </div>
        </div>
      ))}
    </div>
  );
}
