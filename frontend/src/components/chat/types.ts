export type ChatStatus = 'disconnected' | 'connecting' | 'listening' | 'speaking' | 'responding';

export interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  streaming?: boolean;
}
