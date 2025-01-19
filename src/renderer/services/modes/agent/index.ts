import { aiConfigService } from '@/renderer/services/ai-config';
import { terminalOutputService } from '@/renderer/services/terminalOutput';
import { 
  AgentModeService, 
  AgentState, 
  AgentTask, 
  AgentResponseStatus, 
  MessageContent, 
  AgentResponse, 
  CommandRiskLevel,
  AIResponse,
  AICommandResponse
} from './types';
import { DialogueManager } from './dialogue';
import { AGENT_SYSTEM_PROMPT, APIError } from './constants';
import { v4 as uuidv4 } from 'uuid';
import { autoExecuteService } from '@/renderer/services/modes/agent/autoExecute';

class AgentModeServiceImpl implements AgentModeService {
  private currentTask: AgentTask | null = null;
  private taskSteps: string[] = [];
  private currentStepIndex: number = -1;
  private messageHistory: AgentResponse[] = [];
  private dialogueManager: DialogueManager;

  constructor() {
    this.dialogueManager = new DialogueManager(AGENT_SYSTEM_PROMPT);
  }

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

  getAllMessages(): AgentResponse[] {
    return this.messageHistory;
  }

  updateMessageStatus(status: AgentResponseStatus): void {
    if (this.currentTask?.currentMessage) {
      this.currentTask.currentMessage.status = status;
      const lastMessage = this.messageHistory[this.messageHistory.length - 1];
      if (lastMessage) {
        lastMessage.status = status;
      }
    }
  }

  appendContent(content: MessageContent): void {
    console.log('appendContent 被调用:', {
      type: content.type,
      hasAnalysis: !!content.analysis,
      hasCommands: content.commands?.length || 0,
      timestamp: content.timestamp
    });

    if (this.currentTask?.currentMessage) {
      const lastMessage = this.messageHistory[this.messageHistory.length - 1];
      if (lastMessage !== this.currentTask.currentMessage) {
        console.warn('currentMessage 和 lastMessage 不是同一个引用');
        this.currentTask.currentMessage = lastMessage;
      }
      
      console.log('当前消息内容数量:', this.currentTask.currentMessage.contents.length);
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

    console.log('handleCommandExecuted 被调用:', {
      output,
      currentTaskExists: !!this.currentTask,
      currentState: this.getState(),
      messageContentsLength: this.currentTask?.currentMessage?.contents.length
    });

    // 更新状态为分析中
    this.setState(AgentState.ANALYZING);
    this.updateMessageStatus(AgentResponseStatus.ANALYZING);

    // 更新最后一个命令的执行状态
    if (this.currentTask.currentMessage) {
      const lastContent = this.currentTask.currentMessage.contents[this.currentTask.currentMessage.contents.length - 1];
      console.log('更新最后一个命令状态:', {
        type: lastContent.type,
        hasCommands: !!lastContent.commands
      });

      if (lastContent.type === 'command' && lastContent.commands) {
        lastContent.commands = lastContent.commands.map(cmd => ({
          ...cmd,
          executed: true
        }));
      }
    }

    // 添加命令输出到当前消息
    this.appendContent({
      type: 'output',
      content: output,
      timestamp: Date.now()
    });

    try {
      // 获取下一步
      console.log('准备获取下一步操作');
      await this.getNextStep(output);
      console.log('获取下一步操作完成');
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

  async getNextStep(input: string, isNewUserQuery: boolean = false): Promise<void> {
    try {
      console.log('getNextStep 被调用:', {
        input,
        isNewUserQuery,
        currentTaskExists: !!this.currentTask,
        currentState: this.getState()
      });

      const history = terminalOutputService.getHistory();
      console.log('终端历史:', history);

      const config = await aiConfigService.loadConfig();
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      };

      // 如果是新的用户查询，或者没有当前任务，或者状态为空闲，则创建新任务
      if (isNewUserQuery || !this.currentTask || this.getState() === AgentState.IDLE) {
        console.log('创建新任务和消息');

        // 如果存在当前消息，将其状态更新为已完成
        if (this.currentTask?.currentMessage) {
          this.currentTask.currentMessage.status = AgentResponseStatus.COMPLETED;
          this.currentTask.state = AgentState.COMPLETED;
        }

        // 创建新消息
        const newMessage: AgentResponse = {
          status: AgentResponseStatus.THINKING,
          contents: [{
            type: 'analysis',
            content: `开始分析任务：${input}`,
            timestamp: Date.now()
          }],
          userInput: input
        };
        
        // 添加到历史记录
        this.messageHistory.push(newMessage);
        console.log('历史消息数量:', this.messageHistory.length);

        // 创建新任务
        this.currentTask = {
          id: uuidv4(),
          goal: input,
          state: AgentState.PLANNING,
          steps: [],
          currentStep: -1,
          autoExecute: true,
          paused: false,
          userInput: input,
          currentMessage: newMessage
        };

        this.taskSteps = [];
        this.currentStepIndex = -1;
      }

      // 更新状态为思考中
      this.setState(AgentState.PLANNING);
      this.updateMessageStatus(AgentResponseStatus.THINKING);

      // 格式化当前状态并添加到对话历史
      const currentState = this.dialogueManager.formatCurrentState(input, history, isNewUserQuery);
      this.dialogueManager.addDialogue(currentState, isNewUserQuery);

      const requestBody = {
        model: config.model,
        messages: this.dialogueManager.getDialogueHistory(),
        temperature: config.temperature,
        max_tokens: config.maxTokens
      };

      console.log('发送请求到 AI:', {
        currentState,
        temperature: config.temperature,
        max_tokens: config.maxTokens
      });

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
      const content = data.choices[0]?.message?.content;
      
      // 处理空响应
      if (!content) {
        this.setState(AgentState.ERROR);
        this.updateMessageStatus(AgentResponseStatus.ERROR);
        this.appendContent({
          type: 'error',
          content: 'AI 响应为空，请重试',
          timestamp: Date.now()
        });
        return;
      }

      console.log('收到 AI 响应:', content);

      // 尝试提取和解析 JSON 内容
      try {
        // 使用正则表达式提取 JSON 内容
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('未找到有效的 JSON 内容：'+content);
        }

        const jsonContent = jsonMatch[0];
        const result = JSON.parse(jsonContent) as AIResponse;
        console.log('解析 AI 响应:', result);

        if (result.commands && Array.isArray(result.commands) && result.commands.length > 0) {
          // 记录当前步骤
          this.currentStepIndex++;
          this.taskSteps[this.currentStepIndex] = result.commands[0].command;
          console.log('添加新步骤:', {
            index: this.currentStepIndex,
            description: result.commands[0].command
          });

          // 添加命令到消息内容
          this.appendContent({
            type: 'command',
            content: '',
            timestamp: Date.now(),
            analysis: result.analysis,
            commands: result.commands.map((cmd: AICommandResponse) => ({
              text: cmd.command,
              description: cmd.description,
              risk: cmd.risk as CommandRiskLevel,
              executed: false
            }))
          });
          // 更新状态为等待执行
          this.setState(AgentState.EXECUTING);
          this.updateMessageStatus(AgentResponseStatus.WAITING);

          // 检查是否可以自动执行命令
          const command = result.commands[0];
          const canAutoExecute = await autoExecuteService.canAutoExecute(command.risk as CommandRiskLevel);
          if (canAutoExecute) {
            console.log('自动执行命令:', command.command);
            await autoExecuteService.executeCommand(command.command);
          }
        } else {
          // 如果不是命令，说明是分析结果
          this.appendContent({
            type: 'analysis',
            content: content,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        console.error('解析 AI 响应失败:', error);
        this.setState(AgentState.ERROR);
        this.updateMessageStatus(AgentResponseStatus.ERROR);
        
        // 显示错误通知
        notification.error({
          message: 'AI 响应解析失败',
          description: error instanceof Error ? error.message : '未知错误',
          placement: 'bottomLeft',
          duration: 3
        });

        this.appendContent({
          type: 'error',
          content: `AI 响应解析失败: ${error instanceof Error ? error.message : '未知错误'}`,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('获取下一步失败:', error);
      this.setState(AgentState.ERROR);
      this.updateMessageStatus(AgentResponseStatus.ERROR);
      this.appendContent({
        type: 'error',
        content: `获取下一步失败: ${error instanceof Error ? error.message : '未知错误'}`,
        timestamp: Date.now()
      });
    }
  }
}

// 导出服务实例
export const agentModeService = new AgentModeServiceImpl(); 