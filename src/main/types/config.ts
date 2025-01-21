import type { ConnectConfig, Algorithms } from 'ssh2';

/**
 * SSH会话配置
 */
export interface SessionConfig extends Omit<ConnectConfig, 'algorithms'> {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string | Buffer;
  passphrase?: string;
  keepaliveInterval?: number;
  readyTimeout?: number;
  tryKeyboard?: boolean;
  agent?: string;
  algorithms?: Algorithms;
} 