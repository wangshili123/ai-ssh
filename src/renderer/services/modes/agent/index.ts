import { CommandParameter } from '@/renderer/services/ai';
import { aiConfigService } from '@/renderer/services/ai-config';
import { terminalOutputService, TerminalHistory } from '@/renderer/services/terminalOutput';
import { AgentModeService, AgentState, AgentTask, AgentResponseStatus, MessageContent, AgentResponse, CommandRiskLevel } from './types';
import { v4 as uuidv4 } from 'uuid';

const systemPrompt = `你是一个智能的 Linux 助手，帮助用户完成复杂的任务。
请遵循以下规则：
1. 你需要将任务分解为多个步骤，每个步骤都需要用户确认和执行。
2. 每个步骤的返回内容必须是 JSON 格式，不要带markdown格式，比如{"a":1}，包含以下字段：
   - command: 具体的 Linux 命令
   - description: 命令的中文解释
   - risk: 命令的风险等级 (low/medium/high)
3. 对于危险命令（如 rm、chmod 等），必须在 description 中说明风险。
4. 每个步骤都要等待用户执行完成并查看输出后，再决定下一步操作。
5. 如果任务完成，返回纯文本的总结说明。
6. 如果遇到错误，需要提供诊断和解决方案。
7. 强制要求（不要带markdown格式，json按文本格式返回）`;

interface APIError {
  error?: {
    message: string;
  };
  message?: string;
}

class AgentModeServiceImpl implements AgentModeService {
  private currentTask: AgentTask | null = null;
  private taskSteps: string[] = [];
  private currentStepIndex: number = -1;

  getState(): AgentState {
    return this.currentTask?.state || AgentState.IDLE;
  }

  setState(state: AgentState): void {
    if (this.currentTask) {
      this.currentTask.state = state;
      console.log('Agent状态变更:', state);
    }
  }

  getCurrentTask(): AgentTask | null {
    return this.currentTask;
  }

  getCurrentMessage(): AgentResponse | null {
    return this.currentTask?.currentMessage || null;
  }

  updateMessageStatus(status: AgentResponseStatus): void {
    if (this.currentTask?.currentMessage) {
      this.currentTask.currentMessage.status = status;
    }
  }

  appendContent(content: MessageContent): void {
    if (this.currentTask?.currentMessage) {
      this.currentTask.currentMessage.contents.push(content);
    }
  }

  toggleAutoExecute(): void {
    if (this.currentTask) {
      this.currentTask.autoExecute = !this.currentTask.autoExecute;
      console.log('自动执行模式:', this.currentTask.autoExecute);
    }
  }

  togglePause(): void {
    if (this.currentTask) {
      this.currentTask.paused = !this.currentTask.paused;
      console.log('暂停状态:', this.currentTask.paused);
    }
  }

  async handleCommandExecuted(output: string): Promise<void> {
    if (!this.currentTask || this.currentTask.paused || !this.currentTask.autoExecute) {
      return;
    }

    // 更新状态为分析中
    this.setState(AgentState.ANALYZING);
    this.updateMessageStatus(AgentResponseStatus.ANALYZING);

    // 添加命令输出到当前消息
    this.appendContent({
      type: 'output',
      content: output,
      timestamp: Date.now()
    });

    try {
      // 获取下一步
      await this.getNextStep(output);
    } catch (error) {
      console.error('处理命令执行结果失败:', error);
      this.setState(AgentState.ERROR);
      this.updateMessageStatus(AgentResponseStatus.ERROR);
      this.appendContent({
        type: 'result',
        content: `处理失败: ${error instanceof Error ? error.message : '未知错误'}`,
        timestamp: Date.now()
      });
    }
  }

  async getNextStep(input: string): Promise<void> {
    try {
      console.log('输入的原始内容:', input);

      const history = terminalOutputService.getHistory();
      console.log('终端历史:', history);

      const config = await aiConfigService.loadConfig();
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      };

      let contextPrompt = '';
      if (!this.currentTask || this.getState() === AgentState.IDLE) {
        // 新任务
        this.currentTask = {
          id: uuidv4(),
          goal: input,
          state: AgentState.PLANNING,
          steps: [],
          currentStep: -1,
          autoExecute: true,
          paused: false,
          currentMessage: {
            status: AgentResponseStatus.THINKING,
            contents: [{
              type: 'analysis',
              content: `开始分析任务：${input}`,
              timestamp: Date.now()
            }]
          }
        };
        this.taskSteps = [];
        this.currentStepIndex = -1;
        contextPrompt = `新任务：${input}\n请规划第一个步骤。`;
      } else {
        // 继续当前任务
        contextPrompt = `
当前任务：${this.currentTask.goal}
已执行的步骤：
${this.taskSteps.map((step, index) => `${index + 1}. ${step}`).join('\n')}

最近的终端输出：
${history.map((h: TerminalHistory) => `${h.command || ''}
${h.output || ''}`).join('\n')}

用户输入：${input}

请分析输出并决定下一步操作。`;
      }

      // 更新状态为思考中
      this.setState(AgentState.PLANNING);
      this.updateMessageStatus(AgentResponseStatus.THINKING);

      const requestBody = {
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: contextPrompt }
        ],
        temperature: config.temperature,
        max_tokens: config.maxTokens
      };

      const response = await fetch(`${config.baseURL}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const apiError = await response.json() as APIError;
        throw new Error(apiError.error?.message || apiError.message || '请求失败');
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      // 尝试解析为 JSON 格式的命令建议
      try {
        const result = JSON.parse(content);
        if (result.command) {
          // 记录当前步骤
          this.currentStepIndex++;
          this.taskSteps[this.currentStepIndex] = result.description;

          // 添加命令到消息内容
          this.appendContent({
            type: 'command',
            content: result.description,
            timestamp: Date.now(),
            command: {
              text: result.command,
              risk: result.risk as CommandRiskLevel,
              executed: false
            }
          });

          // 更新状态为等待执行
          this.setState(AgentState.EXECUTING);
          this.updateMessageStatus(AgentResponseStatus.WAITING);
        } else {
          // 如果不是命令，说明是分析结果
          this.appendContent({
            type: 'analysis',
            content: content,
            timestamp: Date.now()
          });
        }
      } catch (parseError) {
        // 如果不是 JSON 格式，说明任务已完成或需要处理错误
        if (content.includes('任务完成') || content.includes('总结')) {
          this.appendContent({
            type: 'result',
            content: content,
            timestamp: Date.now()
          });
          // 清空当前任务
          this.currentTask = null;
          this.taskSteps = [];
          this.currentStepIndex = -1;
          // 更新状态为完成
          this.setState(AgentState.COMPLETED);
          this.updateMessageStatus(AgentResponseStatus.COMPLETED);
        } else {
          this.appendContent({
            type: 'analysis',
            content: content,
            timestamp: Date.now()
          });
        }
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('处理任务失败:', error);
      // 更新状态为错误
      this.setState(AgentState.ERROR);
      this.updateMessageStatus(AgentResponseStatus.ERROR);
      this.appendContent({
        type: 'result',
        content: `处理失败: ${error.message}`,
        timestamp: Date.now()
      });
    }
  }
}

export const agentModeService = new AgentModeServiceImpl(); 