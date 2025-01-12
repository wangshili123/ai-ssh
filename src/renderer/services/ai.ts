import { ipcRenderer } from 'electron';

export interface AIConfig {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  baseURL: string;
  proxyURL?: string;
}

export interface CommandSuggestion {
  command: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
  example?: string;
  parameters?: {
    name: string;
    description: string;
    required: boolean;
  }[];
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

示例输出：
{
  "command": "ls -la",
  "description": "显示当前目录下的所有文件（包括隐藏文件），并以详细列表形式展示",
  "risk": "low",
  "example": "ls -la /home/user",
  "parameters": [
    {
      "name": "-l",
      "description": "使用长列表格式",
      "required": true
    },
    {
      "name": "-a",
      "description": "显示所有文件，包括隐藏文件",
      "required": true
    }
  ]
}`;

interface APIError {
  error?: {
    message: string;
  };
  message?: string;
}

class AIService {
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

  async convertToCommand(input: string): Promise<CommandSuggestion> {
    try {
      const config = await this.getConfig();
      console.log('准备发送请求到:', config.baseURL);
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      };

      console.log('请求头:', headers);

      const requestBody = {
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: input }
        ],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        response_format: { type: 'json_object' }
      };

      console.log('请求体:', requestBody);

      const requestInit: RequestInit = {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      };

      // 如果配置了代理，添加代理设置
      if (config.proxyURL) {
        console.log('使用代理:', config.proxyURL);
        const proxyAgent = new URL(config.proxyURL);
        Object.assign(requestInit, {
          agent: proxyAgent
        });
      }

      const response = await fetch(`${config.baseURL}/chat/completions`, requestInit);
      console.log('收到响应状态:', response.status);

      if (!response.ok) {
        const apiError = await response.json() as APIError;
        throw new Error(apiError.error?.message || apiError.message || '请求失败');
      }

      const data = await response.json();
      console.log('响应数据:', data);
      const result = JSON.parse(data.choices[0].message.content);

      return {
        command: result.command || '',
        description: result.description || '无法生成合适的命令',
        risk: result.risk || 'low',
        example: result.example,
        parameters: result.parameters
      };
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
}

export const aiService = new AIService(); 