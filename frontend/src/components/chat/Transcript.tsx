import type { Message } from './types';

type Props = {
  messages: Message[];
};

export function Transcript({ messages }: Props) {
  return (
    <div className="flex h-[380px] flex-col gap-3 overflow-y-auto rounded-2xl border border-white/10 bg-black/30 p-4 shadow-inner backdrop-blur-xl">
      {messages.map((msg) => {
        const isUser = msg.role === 'user';
        return (
          <div
            key={msg.id}
            className={`flex max-w-[85%] flex-col text-sm leading-relaxed ${
              isUser ? 'self-end items-end text-right' : 'self-start items-start text-left'
            }`}
          >
            <span className="mb-1 text-[10px] font-mono uppercase tracking-[0.18em] text-gray-500">
              {isUser ? 'You' : 'Grok'}
            </span>
            <div
              className={`rounded-2xl px-4 py-3 text-[15px] shadow-lg ${
                isUser
                  ? 'rounded-br-sm bg-white text-black shadow-[0_15px_45px_-30px_rgba(255,255,255,0.7)]'
                  : 'rounded-bl-sm border border-white/10 bg-white/5 text-white shadow-[0_12px_45px_-40px_rgba(255,255,255,0.7)] backdrop-blur'
              }`}
            >
              {msg.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
