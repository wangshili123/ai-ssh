import { CommandSuggestion } from '../services/ai';

export interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: number;
  command?: CommandSuggestion;
  commands?: CommandSuggestion[];
  explanation?: string;
}

export interface BaseProps {
  sessionId?: string;
  input: string;
  loading: boolean;
  messages: Message[];
  onUpdateMessages: (messages: Message[]) => void;
}

export interface SSHService {
  connect: (sessionInfo: any) => Promise<void>;
  disconnect: (sessionId: string) => Promise<void>;
  createShell: (sessionId: string, onData: (data: string) => void, onClose?: () => void) => Promise<void>;
  write: (sessionId: string, data: string) => Promise<void>;
  resize: (sessionId: string, cols: number, rows: number) => Promise<void>;
  executeCommand: (sessionId: string, command: string) => Promise<void>;
}

/**
 * 会话信息接口
 */
export interface SessionInfo {
  id: string;
  name?: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  authType: 'password' | 'privateKey';
  status?: 'connected' | 'disconnected' | 'connecting' | 'error';
}

/**
 * 分组信息接口
 */
export interface GroupInfo {
  id: string;
  name: string;
  expanded?: boolean;
  order?: number;
} 