import { CommandSuggestion } from '../services/ai';
import { MonitorData } from './monitor';

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
  status: 'connected' | 'disconnected' | 'connecting' | 'error' | 'refreshing';
  type?: 'terminal' | 'monitor';  // 连接时指定的类型
  group?: string;
  currentDirectory?: string;  // 当前工作目录
  groupOrder?: number;
  // 通用配置
  config?: {
    refreshInterval: number;     // 刷新间隔(毫秒)
    autoRefresh: boolean;       // 是否自动刷新
    defaultPage?: 'process' | 'performance' | 'history' | 'startup' | 'user' | 'detail' | 'service';  // 默认页面
    collectServiceInfo?: boolean;  // 启动时获取服务信息
    recordHistory?: boolean;      // 记录历史数据
    enableCache?: boolean;       // 是否启用缓存
    cacheExpiration?: number;    // 缓存过期时间(毫秒)
  };
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