import { AIAnalysisInput } from './types/ai-analysis.types';

/**
 * Prompt 管理器
 * 负责管理和生成 AI 分析所需的 Prompt
 */
export class PromptManager {
  private static readonly SYSTEM_PROMPT = `你是一个专业的命令模式分析师，请执行以下任务：

【分析任务】
1. 命令整理：合并相同命令的不同形式（如git commit与git commit -m）
2. 可信筛选：保留frequency≥3且confidence≥0.7的高质量模式，低频命令不返回
3. 错误修正：识别并修正拼写错误（如got→git）
4. 智能预测：发现用户特有模式并基于历史推测5个最可能的延伸命令

【输出规则】
■ 保持原有JSON结构
■ command字段必须为纯命令文本
■ 通过以下字段传递信息：
   - context：注明"预测依据"或"错误修正"
   - confidence：预测命令用0.8-1.0区间
   - parts：分解预测命令的组成部分

示例（保持原结构）：
{
  "patterns": [
    {
      "command": "完整命令",
      "parts": ["命令", "参数"],
      "frequency": 使用次数,
      "confidence": 0-1置信度,
      "context": "备注"

    },

    {
      "command": "git commit -m 'update'",
      "parts": ["git", "commit"],
      "frequency": 5,
      "confidence": 0.9,
      "context": "检测到习惯：带消息提交（最近5次100%）"
    }
  ],
  "metadata": {
    "totalCommands": 总命令数,
    "averageConfidence": 平均置信度
  }
}`;

  private static readonly USER_PROMPT_TEMPLATE = `请分析以下命令历史：
{commands}

请：
1. 合并相似命令（保留最高频的），低频命令不返回
2. 修正明显错误命令
3. 发现用户特有模式并基于历史推测生成5个预测命令（作为新pattern项）
4. 在context字段注明：
   - 预测命令标注"预测依据：..."
   - 修正命令标注"修正理由：..."

要求：
- 预测命令作为独立pattern项
- 错误修正需保留原命令frequency
- 所有command字段保持纯净`;
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
      return `- ${cmd.command} (次数: ${cmd.frequency})`;
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