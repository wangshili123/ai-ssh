import { CommandSuggestion, CommandParameter } from '@/renderer/services/ai';
import { aiConfigService } from '@/renderer/services/ai-config';
import { terminalOutputService, TerminalHistory } from '@/renderer/services/terminalOutput';
import { AgentModeService, AgentState, AgentTask } from './types';
import { v4 as uuidv4 } from 'uuid';

const systemPrompt = `你是一个智能的 Linux 助手，帮助用户完成复杂的任务。
请遵循以下规则：
1. 你需要将任务分解为多个步骤，每个步骤都需要用户确认和执行。
2. 每个步骤的返回内容必须是 JSON 格式，不要带markdown格式，比如{"a":1}，包含以下字段：
   - command: 具体的 Linux 命令
   - description: 命令的中文解释
   - risk: 命令的风险等级 (low/medium/high)
   - example: 使用示例（可选）
   - parameters: 参数说明（可选）
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

  // 获取当前状态
  getState(): AgentState {
    return this.currentTask?.state || AgentState.IDLE;
  }

  // 设置状态
  setState(state: AgentState): void {
    if (this.currentTask) {
      this.currentTask.state = state;
      console.log('Agent状态变更:', state);
    }
  }

  // 获取当前任务
  getCurrentTask(): AgentTask | null {
    return this.currentTask;
  }

  // 切换自动执行
  toggleAutoExecute(): void {
    if (this.currentTask) {
      this.currentTask.autoExecute = !this.currentTask.autoExecute;
      console.log('自动执行模式:', this.currentTask.autoExecute);
    }
  }

  // 切换暂停状态
  togglePause(): void {
    if (this.currentTask) {
      this.currentTask.paused = !this.currentTask.paused;
      console.log('暂停状态:', this.currentTask.paused);
    }
  }

  // 处理命令执行完成
  async handleCommandExecuted(output: string): Promise<string | CommandSuggestion[] | null> {
    if (!this.currentTask || this.currentTask.paused || !this.currentTask.autoExecute) {
      return null;
    }

    // 更新状态为分析中
    this.setState(AgentState.ANALYZING);

    try {
      // 自动调用下一步
      const result = await this.getNextStep(output);
      
      if (typeof result === 'string') {
        // 如果返回字符串，说明是任务完成或错误信息
        this.setState(result.includes('任务完成') ? AgentState.COMPLETED : AgentState.ERROR);
      } else {
        // 如果返回命令建议，更新状态为等待执行
        this.setState(AgentState.EXECUTING);
      }

      return result;
    } catch (error) {
      console.error('处理命令执行结果失败:', error);
      this.setState(AgentState.ERROR);
      return `处理失败: ${error instanceof Error ? error.message : '未知错误'}`;
    }
  }

  async getNextStep(input: string): Promise<string | CommandSuggestion[]> {
    try {
      console.log('输入的原始内容:', input);

      // 获取终端输出历史
      const history = terminalOutputService.getHistory();
      console.log('终端历史:', history);

      const config = await aiConfigService.loadConfig();
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      };

      // 构建上下文提示
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
          paused: false
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
        if (Array.isArray(result)) {
          const suggestions = result.map(item => ({
            command: item.command || '',
            description: item.description || '无法生成合适的命令',
            risk: item.risk || 'low',
            example: item.example || undefined,
            parameters: Array.isArray(item.parameters) ? item.parameters.map((p: any) => ({
              name: p.name || '',
              description: p.description || '',
              required: !!p.required,
              defaultValue: p.defaultValue
            } as CommandParameter)) : undefined
          } as CommandSuggestion));

          // 记录当前步骤
          this.currentStepIndex++;
          this.taskSteps[this.currentStepIndex] = suggestions[0].description;

          // 更新状态为等待执行
          this.setState(AgentState.EXECUTING);

          return suggestions;
        } else {
          const suggestion = {
            command: result.command || '',
            description: result.description || '无法生成合适的命令',
            risk: result.risk || 'low',
            example: result.example || undefined,
            parameters: Array.isArray(result.parameters) ? result.parameters.map((p: any) => ({
              name: p.name || '',
              description: p.description || '',
              required: !!p.required,
              defaultValue: p.defaultValue
            } as CommandParameter)) : undefined
          } as CommandSuggestion;

          // 记录当前步骤
          this.currentStepIndex++;
          this.taskSteps[this.currentStepIndex] = suggestion.description;

          // 更新状态为等待执行
          this.setState(AgentState.EXECUTING);

          return [suggestion];
        }
      } catch (parseError) {
        // 如果不是 JSON 格式，说明任务已完成或需要处理错误
        if (content.includes('任务完成') || content.includes('总结')) {
          // 清空当前任务
          this.currentTask = null;
          this.taskSteps = [];
          this.currentStepIndex = -1;
          // 更新状态为完成
          this.setState(AgentState.COMPLETED);
        }
        return content;
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('处理任务失败:', error);
      // 更新状态为错误
      this.setState(AgentState.ERROR);
      return `处理失败: ${error.message}`;
    }
  }
}

export const agentModeService = new AgentModeServiceImpl(); 