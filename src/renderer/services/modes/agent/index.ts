
import { terminalOutputService } from '@/renderer/services/terminalOutput';
import { AIConfigManager } from '@/renderer/services/config/AIConfig';
import { 
  AgentModeService, 
  AgentState, 
  AgentTask, 
  AgentResponseStatus, 
  MessageContent, 
  AgentResponse, 
  CommandRiskLevel,
  AIResponse

} from './types';
import { DialogueManager } from './dialogue';
import { AGENT_SYSTEM_PROMPT, APIError } from './constants';
import { v4 as uuidv4 } from 'uuid';
import { notification } from 'antd';
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
      console.log('updateMessageStatus 被调用:', {
        newStatus: status,
        currentMessageId: this.currentTask.currentMessage.contents[0]?.timestamp,
        totalMessages: this.messageHistory.length
      });

      this.currentTask.currentMessage.status = status;

      // 确保历史记录中的对应消息也被更新，但只更新当前消息
      const lastMessage = this.messageHistory[this.messageHistory.length - 1];
      if (lastMessage && lastMessage === this.currentTask.currentMessage) {
        // 只有当最后一条消息确实是当前消息时才更新
        lastMessage.status = status;
        console.log('已更新最后一条消息的状态');
      } else {
        // 如果不匹配，说明可能有同步问题，需要修复
        console.warn('currentMessage 和 lastMessage 不匹配，尝试同步');
        // 在历史记录中找到当前消息并更新
        const currentMessageIndex = this.messageHistory.findIndex(msg =>
          msg === this.currentTask?.currentMessage
        );
        if (currentMessageIndex !== -1) {
          this.messageHistory[currentMessageIndex].status = status;
          console.log('已在历史记录中找到并更新当前消息状态，索引:', currentMessageIndex);
        }
      }
    }
  }

  appendContent(content: MessageContent): void {
    console.log('appendContent 被调用:', {
      type: content.type,
      content: content.content,
      hasAnalysis: !!content.analysis,
      hasCommand: !!content.command,
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
      console.log('内容已添加，新的内容数量:', this.currentTask.currentMessage.contents.length);
      console.log('添加的内容详情:', content);
    } else {
      console.error('无法添加内容：currentTask 或 currentMessage 不存在');
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
        hasCommand: !!lastContent.command
      });

      if (lastContent.type === 'command' && lastContent.command) {
        lastContent.command =lastContent.command;
        lastContent.executed = true;
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

      const config = await AIConfigManager.getInstance().getConfig();
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      };

      // 如果是新的用户查询，或者没有当前任务，或者状态为空闲，则创建新任务
      if (isNewUserQuery || !this.currentTask || this.getState() === AgentState.IDLE) {
        console.log('创建新任务和消息');

        // 注意：不要强制修改之前消息的状态，保持它们原有的状态
        // 之前的消息状态应该保持不变，只有在真正完成时才设置为完成

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
        console.log('isEnd 值和类型:', {
          isEnd: result.isEnd,
          isEndType: typeof result.isEnd,
          isEndString: String(result.isEnd),
          isEndEqualsFalse: result.isEnd === "false",
          isEndEqualsBoolean: result.isEnd === false
        });

        if (result.isEnd === "false" || result.isEnd === false) {
          console.log('isEnd 为 false，检查命令:', {
            command: result.command,
            commandTrimmed: result.command?.trim(),
            hasCommand: !!(result.command && result.command.trim())
          });
          // 如果有命令需要执行
          if (result.command && result.command.trim()) {
            console.log('有命令需要执行:', result.command);
            // 记录当前步骤
            this.currentStepIndex++;
            this.taskSteps[this.currentStepIndex] = result.command;

            // 添加命令到消息内容
            this.appendContent({
              type: 'command',
              content: '',
              timestamp: Date.now(),
              analysis: result.analysis,
              command: result.command,
              description: result.description,
              risk: result.risk as CommandRiskLevel,
              executed: false,
              stopCommand: result.stopCommand,
              isEnd: false
            });
            // 更新状态为等待执行
            this.setState(AgentState.EXECUTING);
            this.updateMessageStatus(AgentResponseStatus.WAITING);

            // 检查是否可以自动执行命令
            const canAutoExecute = await autoExecuteService.canAutoExecute(result.risk as CommandRiskLevel);
            if (canAutoExecute) {
              console.log('自动执行命令:', result.command);
              await autoExecuteService.executeCommand(result.command);
            }
          } else {
            // 如果没有命令，只显示分析内容
            console.log('没有命令，显示分析内容:', {
              analysis: result.analysis,
              description: result.description
            });
            this.setState(AgentState.COMPLETED);
            this.updateMessageStatus(AgentResponseStatus.COMPLETED);
            this.appendContent({
              type: 'analysis',
              content: result.analysis || result.description || '等待进一步指令',
              timestamp: Date.now(),
              isEnd: false
            });
            console.log('分析内容已添加，当前消息内容数量:', this.currentTask?.currentMessage?.contents.length);
          }
        }    // 如果命令标记为结束，更新任务状态
        else if (result.isEnd === "true" || result.isEnd === true) {
          this.setState(AgentState.COMPLETED);
          this.updateMessageStatus(AgentResponseStatus.COMPLETED);
          this.appendContent({
            type: 'analysis',
            content:  result.analysis || content,
            timestamp: Date.now(),
            isEnd: true
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

  /**
   * 重置所有状态，清除当前任务和消息历史
   */
  reset(): void {
    // 清除当前任务
    this.currentTask = null;
    // 清除消息历史
    this.messageHistory = [];
    // 重置任务步骤
    this.taskSteps = [];
    this.currentStepIndex = -1;
    // 重置状态
    this.setState(AgentState.IDLE);
    // 重置对话管理器
    this.dialogueManager = new DialogueManager(AGENT_SYSTEM_PROMPT);
    
    console.log('Agent状态已重置');
  }
}

// 导出服务实例
export const agentModeService = new AgentModeServiceImpl(); 