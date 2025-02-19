import { CommandSuggestion } from '../ai';
import { AIConfigManager } from '../config/AIConfig';

const systemPrompt = `你是一个 Linux 命令专家，帮助用户将自然语言转换为准确的 Linux 命令。
请遵循以下规则：
1. 返回的内容必须是 JSON 格式，不要带markdown格式，回复以{开头}结尾，比如{“a”:1}，包含以下字段：
   - command: 具体的 Linux 命令
   - description: 命令的中文解释
   - risk: 命令的风险等级 (low/medium/high)
   - example: 使用示例（可选）
   - parameters: 参数说明（可选）
2. 对于危险命令（如 rm、chmod 等），必须在 description 中说明风险
3. 尽量提供最简洁有效的命令
4. 如果用户的描述不够清晰，返回空命令并在 description 中说明原因
5.强制要求（不要带markdown格式，json按文本格式返回）`;

interface APIError {
  error?: {
    message: string;
  };
  message?: string;
}

export interface CommandModeService {
  getCommandSuggestion: (input: string) => Promise<CommandSuggestion>;
}

class CommandModeServiceImpl implements CommandModeService {
  private currentCommands: string[] = [];

  private addCurrentCommand(command: string) {
    this.currentCommands.push(command);
  }

  private getCurrentCommands(): string[] {
    return this.currentCommands;
  }

  private clearCurrentCommands() {
    this.currentCommands = [];
  }

  async getCommandSuggestion(input: string): Promise<CommandSuggestion> {
    try {
      console.log('输入的原始内容:', input);
      
      // 获取已生成的命令列表
      const excludeCommands = this.getCurrentCommands();
      console.log('排除的命令列表:', excludeCommands);

      const config = AIConfigManager.getInstance().getConfig();
      
      // 构建用户提示，包含已生成的命令信息
      let userPrompt = input;
      if (excludeCommands.length > 0) {
        userPrompt = `${input}\n\n请注意：以下命令已经生成过，需要生成一个不同的命令：\n${excludeCommands.map(cmd => `- ${cmd}`).join('\n')}`;
        console.log('构建的提示:', userPrompt);
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      };

      const requestBody = {
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        response_format: { type: 'json_object' }
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
      try {
        const result = JSON.parse(data.choices[0].message.content);
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
          })) : undefined
        };

        // 记录生成的命令到当前会话历史
        if (suggestion.command) {
          this.addCurrentCommand(suggestion.command);
        }

        return suggestion;
      } catch (parseError) {
        return {
          command: '',
          description: data.choices[0].message.content,
          risk: 'low',
          parameters: undefined
        };
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('生成命令失败:', error);
      return {
        command: '',
        description: `生成失败: ${error.message}`,
        risk: 'low'
      };
    }
  }
}

export const commandModeService = new CommandModeServiceImpl(); 