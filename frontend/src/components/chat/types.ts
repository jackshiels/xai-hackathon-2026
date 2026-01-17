export type Status = 'disconnected' | 'connecting' | 'listening' | 'speaking' | 'responding';

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};
