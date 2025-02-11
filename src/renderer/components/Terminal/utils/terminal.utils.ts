import { sshService } from '../../../services/ssh';
import type { SessionInfo } from '../../../../renderer/types/index';

// 等待 SSH 连接就绪
export const waitForConnection = async (sessionInfo: SessionInfo): Promise<void> => {
  let retries = 5;
  while (retries > 0) {
    try {
      await sshService.connect(sessionInfo);
      return;
    } catch (error) {
      retries--;
      if (retries === 0) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}; 