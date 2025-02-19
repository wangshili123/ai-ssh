
import { CommandRiskLevel } from './types';
import { agentModeService } from '.';
import { AgentState, AgentResponseStatus } from './types';
import { AIConfigManager } from '../../config/AIConfig';

/**
 * 命令自动执行服务
 * 负责判断命令是否可以自动执行，以及处理自动执行的逻辑
 */
export class AutoExecuteService {
  private executeCommandCallback: ((command: string) => Promise<void>) | null = null;

  /**
   * 设置命令执行的回调函数
   */
  setExecuteCommandCallback(callback: (command: string) => Promise<void>) {
    this.executeCommandCallback = callback;
  }

  /**
   * 检查命令是否可以自动执行
   * @param commandRisk 命令的风险等级
   * @returns 是否可以自动执行
   */
  async canAutoExecute(commandRisk: CommandRiskLevel): Promise<boolean> {
    try {
      const config = AIConfigManager.getInstance().getConfig();
      
      // 如果没有开启自动执行，直接返回 false
      if (!config.agentAutoRun) {
        console.log('自动执行未开启');
        return false;
      }

      // 根据用户设置的风险等级判断是否可以执行
      const canExecute = (
        (config.agentRiskLevel === 'high') ||
        (config.agentRiskLevel === 'medium' && commandRisk !== 'high') ||
        (config.agentRiskLevel === 'low' && commandRisk === 'low')
      );

      console.log('命令自动执行判断:', {
        autoRun: config.agentAutoRun,
        allowedRisk: config.agentRiskLevel,
        commandRisk,
        canExecute
      });

      return canExecute;
    } catch (error) {
      console.error('检查命令自动执行条件时出错:', error);
      return false;
    }
  }

  /**
   * 执行命令
   * @param command 要执行的命令
   */
  async executeCommand(command: string) {
    if (!this.executeCommandCallback) {
      console.error('未设置命令执行回调函数');
      return;
    }

    try {
      console.log('开始执行命令:', command);
      // 直接使用回调函数执行命令
      await this.executeCommandCallback(command);
    } catch (error) {
      console.error('执行命令失败:', error);
      agentModeService.setState(AgentState.ERROR);
      agentModeService.updateMessageStatus(AgentResponseStatus.ERROR);
    }
  }
}

// 导出服务实例
export const autoExecuteService = new AutoExecuteService(); 