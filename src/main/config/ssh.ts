import { SessionConfig } from '../types/config';
import { sessionConfigManager } from './sessionConfig';

/**
 * 获取SSH配置
 * @param sessionId 会话ID
 */
export async function getSSHConfig(sessionId: string): Promise<SessionConfig> {
  const config = await sessionConfigManager.getConfig(sessionId);
  if (!config) {
    throw new Error(`未找到会话配置: ${sessionId}`);
  }
  return config;
} 