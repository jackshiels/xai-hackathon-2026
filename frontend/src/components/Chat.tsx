import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

function Chat() {
  const { username } = useParams<{ username: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;

    const newMessage: Message = {
      id: Date.now(),
      text: text.trim(),
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newMessage]);
    setInputText('');

    // Simulate bot response (replace with actual chat logic)
    setTimeout(() => {
      const botMessage: Message = {
        id: Date.now() + 1,
        text: `Hello from ${username}! You said: ${text}`,
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMessage]);
    }, 1000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputText);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-8 text-ink">Chat with @{username}</h1>
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[rgba(var(--ink),0.08)] bg-[rgb(var(--surface-strong))] shadow-[0_24px_60px_rgba(22,27,38,0.18)]">
        <header className="border-b border-[rgba(var(--ink),0.08)] bg-[rgba(var(--surface),0.6)] p-4">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[rgba(var(--muted),0.9)]">
            Conversation
          </p>
        </header>

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

        <form onSubmit={handleSubmit} className="border-t border-[rgba(var(--ink),0.08)] bg-[rgba(var(--surface),0.6)] p-4">
          <div className="flex space-x-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 rounded-full border border-[rgba(var(--ink),0.15)] bg-[rgb(var(--surface-strong))] px-4 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-[rgba(var(--accent-strong),0.45)]"
            />
            <button
              type="submit"
              className="rounded-full bg-[rgb(var(--accent-strong))] px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_25px_rgba(214,106,71,0.35)] transition hover:bg-[rgb(var(--accent))] focus:outline-none focus:ring-2 focus:ring-[rgba(var(--accent-strong),0.45)]"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Chat;
