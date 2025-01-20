import { CommandSuggestion } from '../ai';
import { aiConfigService } from '../ai-config';
import { terminalOutputService } from '../terminalOutput';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface CommandResponse {
  command: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
}

interface AIResponse {
  explanation?: string;
  commands?: CommandResponse[];
}

export interface ContextResponse {
  explanation?: string;
  command?: CommandSuggestion;
}

class ContextModeService {
  private readonly MAX_HISTORY_LENGTH = 10; // 最多保存10轮对话
  private messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是一个 Linux 命令专家，帮助用户理解命令输出并提供建议。
请遵循以下规则：
1. 如果提供了终端输出，你需要：
   - 分析输出内容，理解当前的执行状态
   - 结合用户的问题，给出针对性的解释或建议
   - 如果输出表明有错误或异常，解释原因并提供解决方案
2. 返回的内容必须是 JSON 格式，不要带markdown格式，比如{“a”:1}，包含以下字段：
   {
     "explanation": "对问题或输出的简要说明",
     "commands": [
       {
         "command": "具体的 Linux 命令",
         "description": "命令的中文解释",
         "risk": "low/medium/high"
       }
     ]
   }
3. 对于危险命令（如 rm、chmod 等），必须在 description 中说明风险
4. 尽量提供最简洁有效的命令
5. 如果用户的描述不够清晰，在 explanation 中说明原因
6.强制要求（不要带markdown格式，json按文本格式返回）`
    }
  ];

  async getContextResponse(input: string): Promise<ContextResponse> {
    try {
      // 获取终端输出历史
      const terminalOutput = terminalOutputService.getRecentOutput();
      
      // 构建用户提示
      let userPrompt = input;
      if (terminalOutput && terminalOutput.trim()) {
        userPrompt = `最近的终端输出：\n${terminalOutput}\n\n用户问题：${input}`;
      }

      // 添加用户消息到历史
      this.messages.push({ role: 'user', content: userPrompt });

      // 如果历史记录超过最大长度，删除最早的非系统消息
      while (this.messages.length > this.MAX_HISTORY_LENGTH + 1) { // +1 是因为要保留 system 消息
        const systemMessageIndex = this.messages.findIndex(m => m.role === 'system');
        if (systemMessageIndex === 0) {
          this.messages.splice(1, 1); // 删除系统消息后的第一条消息
        } else {
          this.messages.splice(0, 1); // 删除第一条消息
        }
      }

      const config = await aiConfigService.loadConfig();
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      };

      const requestBody = {
        model: config.model,
        messages: this.messages,
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
        const apiError = await response.json();
        throw new Error(apiError.error?.message || apiError.message || '请求失败');
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      // 尝试解析为 JSON 格式的响应
      try {
        const result = JSON.parse(content) as AIResponse;
        
        return {
          explanation: result.explanation,
          command: result.commands?.map((item: CommandResponse) => ({
            command: item.command || '',
            description: item.description || '无法生成合适的命令',
            risk: item.risk || 'low'
          }))[0]
        };
      } catch (parseError) {
        // 如果不是 JSON 格式，作为普通文本返回
        return {
          explanation: content
        };
      }
    } catch (error) {
      console.error('处理上下文失败:', error);
      throw error;
    }
  }

  // 清空对话历史，但保留系统提示
  clearHistory() {
    const systemMessage = this.messages.find(m => m.role === 'system');
    this.messages = systemMessage ? [systemMessage] : [];
  }
}

export const contextModeService = new ContextModeService(); 