import { AgentService, AgentResponse, AgentResponseStatus } from './types';
import { aiService } from '../../renderer/services/ai';
import { sshService } from '../../renderer/services/ssh';
import { eventBus } from '../../renderer/services/eventBus';

/**
 * Agent 服务实现
 */
export class AgentServiceImpl implements AgentService {
  private async analyzeTask(message: string): Promise<AgentResponse> {
    try {
      // 使用 AI 服务分析任务并生成执行计划
      const response = await aiService.getAgentResponse(message);
      
      // 如果需要执行命令
      if (response.command) {
        return {
          status: AgentResponseStatus.WAITING,
          message: `我建议执行以下命令：\n${response.command}\n\n${response.description || ''}`,
          command: response.command
        };
      }
      
      // 如果只是普通回复
      return {
        status: AgentResponseStatus.COMPLETED,
        message: response.description || '我理解了您的需求。'
      };
    } catch (error) {
      return {
        status: AgentResponseStatus.COMPLETED,
        message: '抱歉，我在分析任务时遇到了问题：' + (error as Error).message,
        error: (error as Error).message
      };
    }
  }

  /**
   * 发送消息给 Agent
   */
  async sendMessage(message: string): Promise<AgentResponse> {
    return this.analyzeTask(message);
  }

  /**
   * 执行命令
   */
  async executeCommand(command: string): Promise<string> {
    const shellId = eventBus.getCurrentShellId();
    if (!shellId) {
      throw new Error('未连接到 SSH 会话');
    }

    try {
      // 添加换行符确保命令执行
      await sshService.write(shellId, command + '\n');
      return '命令已执行';
    } catch (error) {
      throw new Error('执行命令失败：' + (error as Error).message);
    }
  }
} 