interface ChatHeaderProps {
  username?: string;
}

export function ChatHeader({ username }: ChatHeaderProps) {
  return <h1 className="text-4xl font-bold mb-8 text-ink">Chat with @{username}</h1>;
}
