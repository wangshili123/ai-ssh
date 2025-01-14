import { ipcRenderer } from 'electron';

export interface AIConfig {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  baseURL: string;
  proxyURL?: string;
}

export interface CommandParameter {
  name: string;
  description: string;
  required: boolean;
  defaultValue?: string;
}

export interface CommandSuggestion {
  command: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
  parameters?: CommandParameter[];
  example?: string;
}

const systemPrompt = `你是一个 Linux 命令专家，帮助用户将自然语言转换为准确的 Linux 命令。
请遵循以下规则：
1. 返回的内容必须是 JSON 格式，包含以下字段：
   - command: 具体的 Linux 命令
   - description: 命令的中文解释
   - risk: 命令的风险等级 (low/medium/high)
   - example: 使用示例（可选）
   - parameters: 参数说明（可选）
2. 对于危险命令（如 rm、chmod 等），必须在 description 中说明风险
3. 尽量提供最简洁有效的命令
4. 如果用户的描述不够清晰，返回空命令并在 description 中说明原因
5. 如果提供了已生成的命令列表，必须生成一个不同的命令`;

interface APIError {
  error?: {
    message: string;
  };
  message?: string;
}

class AIService {
  private static instance: AIService;
  private currentCommands: string[] = [];
  private config: AIConfig | null = null;

  constructor() {
    this.currentCommands = [];
  }

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  private async getConfig(): Promise<AIConfig> {
    const response = await ipcRenderer.invoke('ai-config:load');
    console.log('AI 配置加载结果:', response);
    if (!response.success) {
      throw new Error(response.error);
    }
    const config = response.data;
    if (!config.baseURL) {
      throw new Error('未配置 API 基础 URL');
    }
    return config;
  }

  /**
   * 添加命令到当前会话的历史记录
   * @param command 生成的命令
   */
  addCurrentCommand(command: string) {
    console.log('添加命令到当前会话:', command);
    this.currentCommands.push(command);
    console.log('当前会话的所有命令:', this.currentCommands);
  }

  /**
   * 获取当前会话的命令历史
   */
  getCurrentCommands(): string[] {
    return this.currentCommands;
  }

  /**
   * 清空当前会话的命令历史
   */
  clearCurrentCommands() {
    console.log('清空当前会话的命令历史');
    this.currentCommands = [];
  }

  /**
   * 将自然语言转换为命令
   * @param input 用户输入的自然语言
   * @param excludeCommands 要排除的命令列表
   * @returns 生成的命令建议
   */
  async convertToCommand(input: string, excludeCommands?: string[]): Promise<CommandSuggestion> {
    try {
      console.log('输入的原始内容:', input);
      console.log('排除的命令列表:', excludeCommands);

      const config = await this.getConfig();
      
      // 构建用户提示，包含已生成的命令信息
      let userPrompt = input;
      if (excludeCommands && excludeCommands.length > 0) {
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
          example: result.example,
          parameters: result.parameters
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
          risk: 'low'
        };
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('转换命令失败:', error);
      return {
        command: '',
        description: `转换失败: ${error.message}`,
        risk: 'low'
      };
    }
  }

  async explainCommand(command: string): Promise<string> {
    try {
      const config = await this.getConfig();
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': config.apiKey
      };

      const requestBody = {
        model: config.model,
        messages: [
          {
            role: 'system',
            content: '你是一个 Linux 命令专家，请用通俗易懂的中文解释用户输入的命令，包括每个参数的作用和可能的风险。'
          },
          { role: 'user', content: command }
        ],
        temperature: config.temperature,
        max_tokens: config.maxTokens
      };

      const requestInit: RequestInit = {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      };

      // 如果配置了代理，添加代理设置
      if (config.proxyURL) {
        const proxyAgent = new URL(config.proxyURL);
        Object.assign(requestInit, {
          agent: proxyAgent
        });
      }

      const response = await fetch(config.baseURL, requestInit);

      if (!response.ok) {
        const apiError = await response.json() as APIError;
        throw new Error(apiError.error?.message || apiError.message || '请求失败');
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (err: unknown) {
      const error = err as Error;
      console.error('解释命令失败:', error);
      return `解释失败: ${error.message}`;
    }
  }

  /**
   * 处理上下文模式的请求
   * @param input 用户输入
   * @param context 终端上下文
   * @returns AI 的回复
   */
  async getContextResponse(input: string, context: string): Promise<string> {
    try {
      const config = await this.getConfig();
      
      const systemPrompt = `你是一个 Linux 终端助手。请遵循以下规则回答：
1. 用最简短的语言说明问题和解决方法
2. 如果需要执行命令，使用 \`\`\`command 格式
3. 每个命令独占一行
4. 避免废话和重复
5. 如果是错误信息，直接说明原因和解决方法
6. 不要解释命令的作用，只需列出要执行的命令`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      };

      const userPrompt = `
用户问题：${input}

终端最近输出：
${context}

请根据终端输出和用户问题提供帮助。`;

      const requestBody = {
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
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
      return data.choices[0].message.content;
    } catch (err: unknown) {
      const error = err as Error;
      console.error('处理上下文请求失败:', error);
      throw error;
    }
  }
}

export const aiService = AIService.getInstance(); 