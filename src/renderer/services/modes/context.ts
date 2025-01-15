import { CommandSuggestion } from '../ai';
import { aiConfigService } from '../ai-config';
import { terminalOutputService, TerminalHistory } from '../terminalOutput';

const systemPrompt = `你是一个 Linux 命令专家，帮助用户理解命令输出并提供建议。
请遵循以下规则：
1. 如果提供了终端输出，你需要：
   - 分析输出内容，理解当前的执行状态
   - 结合用户的问题，给出针对性的解释或建议
   - 如果输出表明有错误或异常，解释原因并提供解决方案
2. 返回的内容必须是 JSON 格式，包含以下字段：
   {
     "explanation": "对问题或输出的简要说明",
     "commands": [
       {
         "command": "具体的 Linux 命令",
         "description": "命令的中文解释",
         "risk": "low/medium/high",
         "example": "使用示例",
         "parameters": [
           {
             "name": "参数名",
             "description": "参数说明",
             "required": true,
             "defaultValue": "默认值"
           }
         ]
       }
     ]
   }
3. 如果是解释命令输出，返回格式为：
   {
     "explanation": "命令输出的解释说明"
   }
4. 对于危险命令（如 rm、chmod 等），必须在 description 中说明风险
5. 尽量提供最简洁有效的命令
6. 如果用户的描述不够清晰，在 explanation 中说明原因`;

interface APIError {
  error?: {
    message: string;
  };
  message?: string;
}

interface CommandResponse {
  command: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
  example?: string;
  parameters?: CommandParameter[];
}

interface CommandParameter {
  name: string;
  description: string;
  required: boolean;
  defaultValue?: string;
}

interface ContextResponse {
  explanation?: string;
  commands?: CommandResponse[];
}

export interface ContextModeService {
  getContextResponse: (input: string) => Promise<string | CommandSuggestion[]>;
}

class ContextModeServiceImpl implements ContextModeService {
  async getContextResponse(input: string): Promise<string | CommandSuggestion[]> {
    try {
      console.log('输入的原始内容:', input);

      // 获取终端输出历史
      const terminalOutput = terminalOutputService.getRecentOutput();
      console.log('终端输出:', terminalOutput);

      const config = await aiConfigService.loadConfig();
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      };

      // 构建上下文提示
      let contextPrompt = input;
      if (terminalOutput && terminalOutput.trim()) {
        contextPrompt = `
最近的终端输出：
${terminalOutput}

用户问题：${input}

请根据上述终端输出和用户问题，给出相应的解释或建议。`;
      }

      const requestBody = {
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: contextPrompt }
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
      const content = data.choices[0].message.content;

      // 尝试解析为 JSON 格式的响应
      try {
        const result = JSON.parse(content) as ContextResponse;
        
        // 如果包含 commands 字段，说明是命令建议
        if (result.commands) {
          return result.commands.map((item: CommandResponse) => ({
            command: item.command || '',
            description: item.description || '无法生成合适的命令',
            risk: item.risk || 'low',
            example: item.example,
            parameters: item.parameters || []
          }));
        }
        
        // 如果只有 explanation 字段，说明是解释文本
        if (result.explanation) {
          return result.explanation;
        }

        // 如果解析失败，返回原始内容
        return content;
      } catch (parseError) {
        // 如果不是 JSON 格式，直接返回文本内容
        return content;
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('处理上下文失败:', error);
      return `处理失败: ${error.message}`;
    }
  }
}

export const contextModeService = new ContextModeServiceImpl(); 