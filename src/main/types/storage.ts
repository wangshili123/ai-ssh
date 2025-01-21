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
  group?: string;
  groupOrder?: number;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
} 