import { SessionConfig } from '../types/config';

/**
 * 会话配置管理器
 */
class SessionConfigManager {
  private configs: Map<string, SessionConfig> = new Map();

  /**
   * 设置会话配置
   * @param sessionId 会话ID
   * @param config 配置信息
   */
  setConfig(sessionId: string, config: SessionConfig): void {
    this.configs.set(sessionId, config);
  }

  /**
   * 获取会话配置
   * @param sessionId 会话ID
   */
  async getConfig(sessionId: string): Promise<SessionConfig | undefined> {
    return this.configs.get(sessionId);
  }

  /**
   * 删除会话配置
   * @param sessionId 会话ID
   */
  removeConfig(sessionId: string): void {
    this.configs.delete(sessionId);
  }
}

// 导出单例
export const sessionConfigManager = new SessionConfigManager(); 