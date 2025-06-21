import { CommandSuggestion } from '../services/ai';
import { MonitorData } from './monitor/monitor';

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
  executeCommand: (sessionId: string, command: string) => Promise<string>;
  executeCommandDirect: (sessionId: string, command: string) => Promise<string>;
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
  passphrase?: string;     // 私钥密码短语
  authType: 'password' | 'privateKey';
  status: 'connected' | 'disconnected' | 'connecting' | 'error' | 'refreshing';
  type?: 'terminal' | 'monitor';  // 连接时指定的类型
  group?: string;
  currentDirectory?: string;  // 当前工作目录
  groupOrder?: number;
  lastUpdated?: number;     // 最后更新时间
  error?: string;          // 错误信息
  monitorData?: MonitorData;  // 监控数据
}

/**
 * 分组信息接口
 */
export interface GroupInfo {
  id: string;
  name: string;
  expanded?: boolean;
  order: number;  // 改为必需字段
}
