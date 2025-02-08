import { AIAnalysisInput } from './types/ai-analysis.types';

/**
 * Prompt 管理器
 * 负责管理和生成 AI 分析所需的 Prompt
 */
export class PromptManager {
  private static readonly SYSTEM_PROMPT = `你是一个专业的命令行工具使用专家。你的任务是分析用户的命令行使用历史，识别出有价值的命令模式和上下文关系。

你需要:
1. 分析命令使用模式和关联性
2. 识别命令参数的常见组合
3. 发现命令序列中的关联性
4. 评估每个建议的可信度

请以 JSON 格式返回分析结果（不要带 markdown 格式），不要在结尾带任何额外解释，固定返回json内容,格式如下:
{
  "patterns": [
    {
      "command": "完整命令",
      "parts": ["命令", "参数"],
      "frequency": 使用次数,
      "confidence": 0-1之间的置信度,
      "context": "使用场景描述"
    }
  ],
  "metadata": {
    "totalCommands": 总命令数,
    "averageConfidence": 平均置信度
  }
}`;

  private static readonly USER_PROMPT_TEMPLATE = `请分析以下命令历史:
{commands}

上次分析状态:
{lastState}

请提供:
1. 识别出的命令模式
2. 每个模式的使用频率
3. 相关的上下文信息
4. 置信度评分(0-1)

注意:
- 关注命令的使用频率和场景
- 识别参数的常见组合
- 发现命令之间的关联
- 评估每个建议的可信度`;

  /**
   * 生成分析提示词
   */
  public generateAnalysisPrompt(params: {
    commands: Array<{
      command: string;
      frequency: number;
      created_at: string;
      success?: boolean;
    }>;
    lastState: any;
  }): AIAnalysisInput {
    // 1. 格式化命令历史
    const formattedCommands = params.commands.map(cmd => {
      return `- ${cmd.command} (使用次数: ${cmd.frequency}, 成功: ${cmd.success ? '是' : '否'})`;
    }).join('\n');

    // 2. 格式化上次分析状态
    const formattedState = params.lastState ? 
      JSON.stringify(params.lastState.metrics, null, 2) :
      '首次分析';

    // 3. 生成用户提示词
    const userPrompt = PromptManager.USER_PROMPT_TEMPLATE
      .replace('{commands}', formattedCommands)
      .replace('{lastState}', formattedState);

    // 4. 构建完整的提示词输入
    return {
      messages: [
        {
          role: 'system',
          content: PromptManager.SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      context: {
        totalCommands: params.commands.length,
        timeRange: {
          start: params.commands[params.commands.length - 1]?.created_at,
          end: params.commands[0]?.created_at
        }
      },
      baseAnalysis: params.lastState?.metrics || null
    };
  }

  /**
   * 解析 AI 响应
   */
  public parseAIResponse(response: string): {
    completions: Array<{
      command: string;
      parts: string | null;
      frequency: number;
      confidence: number;
      context: string | null;
    }>;
    metadata: {
      totalCommands: number;
      uniquePatterns: number;
      averageConfidence: number;
    };
  } {
    try {
      // 这里需要根据实际的 AI 响应格式进行解析
      // 示例格式:
      const parsed = JSON.parse(response);
      
      return {
        completions: parsed.patterns.map((p: any) => ({
          command: p.command,
          parts: p.parts || null,
          frequency: p.frequency || 1,
          confidence: p.confidence || 0.5,
          context: p.context || null
        })),
        metadata: {
          totalCommands: parsed.metadata.totalCommands,
          uniquePatterns: parsed.patterns.length,
          averageConfidence: parsed.metadata.averageConfidence
        }
      };
    } catch (error) {
      console.error('[PromptManager] Failed to parse AI response:', error);
      throw error;
    }
  }
} 