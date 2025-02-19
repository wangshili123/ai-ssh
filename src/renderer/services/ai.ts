import { ipcRenderer } from 'electron';
import { AIConfigManager } from './config/AIConfig';
import { AIConfig } from '../types/baseconfig/BaseConfigType';
import { message } from 'antd';


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

export interface AgentCommandResponse {
  command?: string;
  description?: string;
}

export interface ContextCommandResponse {
  type: 'commands' | 'text';
  explanation?: string;
  command?: {
    command: string;
    description: string;
    risk: 'low' | 'medium' | 'high';
  };
  content?: string;
}

export interface ContextResponse {
  explanation: string;
  command: CommandSuggestion;
}

const systemPrompt = `你是一个 Linux 命令专家，帮助用户将自然语言转换为准确的 Linux 命令。
请遵循以下规则：
1. 返回的内容必须是 JSON 格式，不要带markdown格式，回复以{开头}结尾比如{“a”:1}，包含以下字段：
   - command: 具体的 Linux 命令
   - description: 命令的中文解释
   - risk: 命令的风险等级 (low/medium/high)
   - example: 使用示例（可选）
   - parameters: 参数说明（可选）
2. 对于危险命令（如 rm、chmod 等），必须在 description 中说明风险
3. 尽量提供最简洁有效的命令
4. 如果用户的描述不够清晰，返回空命令并在 description 中说明原因
5. 如果提供了已生成的命令列表，必须生成一个不同的命令
6.强制要求（不要带markdown格式，json按文本格式返回）`;

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
    this.configManager = AIConfigManager.getInstance();
  }

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  private configManager: AIConfigManager;


  async getConfig(): Promise<AIConfig> {
    return this.configManager.getConfig();
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
      if (!config.baseURL) {
        //弹框
        message.error('未配置 API 基础 URL');
        return '';
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
   * @returns AI 的回复或命令建议
   */
  async getContextResponse(input: string, context: string): Promise<string | ContextResponse> {
    try {
      const config = await this.getConfig();
      
      const systemPrompt = `你是一个 Linux 终端助手。请严格遵循以下规则回答：
1. 先用简短的语言说明问题
2. 如果需要执行命令，必须返回 JSON 格式数据，不要带markdown格式，比如{“a”:1}，格式如下：
   {
     "type": "commands",
     "explanation": "对问题的简要说明",
     "commands": [
       {
         "command": "具体的命令",
         "description": "命令的详细解释，包括参数说明",
         "risk": "low"
       }
     ]
   }
3. 对于危险命令（如 rm、chmod 等），必须在 description 中说明风险，并将 risk 设置为 high
4. 如果不需要执行命令，返回格式如下：
   {
     "type": "text",
     "content": "你的回复内容"
   }
5. 避免废话和重复
6. 如果是错误信息，直接说明原因和解决方法`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      };

      const userPrompt = `
用户问题：${input}

终端最近输出：
${context}

请根据终端输出和用户问题提供帮助。没有请忽略，只关注用户问题`;

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
      const content = data.choices[0]?.message?.content;
      
      try {
        const result = JSON.parse(content) as ContextCommandResponse;
        if (result.type === 'commands' && result.command) {
          // 返回命令建议和说明
          return {
            explanation: result.explanation || '',
            command: {
              command: result.command.command,
              description: result.command.description,
              risk: result.command.risk || 'low',
              example: undefined,
              parameters: undefined
            }
          };
        } else if (result.type === 'text' && result.content) {
          // 返回普通文本
          return result.content;
        }
      } catch (e) {
        // 如果解析失败，返回原始内容
        return content;
      }

      return content;
    } catch (err: unknown) {
      const error = err as Error;
      console.error('处理上下文请求失败:', error);
      throw error;
    }
  }

  /**
   * 获取 Agent 的响应
   * @param message 用户消息
   * @returns Agent 的响应内容
   */
  async getAgentResponse(message: string): Promise<AgentCommandResponse> {
    try {
      const config = await this.getConfig();
      
      const agentSystemPrompt = `你是一个 Linux 系统助手，可以帮助用户分析任务并提供合适的命令。
请遵循以下规则：
1. 仔细分析用户的需求
2. 如果需要执行命令，使用 $ 开头表示，例如：$ ls -l
3. 在命令前后提供清晰的解释
4. 对于危险命令，必须明确提示风险
5. 如果不需要执行命令，直接提供建议和解释`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      };

      const requestBody = {
        model: config.model,
        messages: [
          {
            role: 'system',
            content: agentSystemPrompt
          },
          {
            role: 'user',
            content: message
          }
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
      const content = data.choices[0]?.message?.content;
      if (!content) {
        throw new Error('未获取到有效响应');
      }

      // 解析响应内容
      const lines: string[] = content.split('\n');
      const command = lines.find((line: string) => line.startsWith('$'))?.slice(2);
      const description = lines.filter((line: string) => !line.startsWith('$')).join('\n').trim();

      return {
        command,
        description
      };
    } catch (error) {
      console.error('获取 Agent 响应失败:', error);
      throw error;
    }
  }
}

export const aiService = AIService.getInstance(); 