import { AIAnalysisInput } from './types/ai-analysis.types';

/**
 * Prompt 管理器
 * 负责管理和生成 AI 分析所需的 Prompt
 */
export class PromptManager {
  private readonly ANALYSIS_TEMPLATE = `
作为一个命令行模式分析专家，请分析以下用户命令使用模式：

当前模式：
{{patterns}}

使用指标：
{{metrics}}

环境上下文：
{{context}}

请从以下方面进行分析：
1. 模式关联性分析
2. 使用效率评估
3. 潜在问题识别
4. 优化建议生成

输出要求：
1. 分析结果必须客观且可操作
2. 建议需要考虑实际可行性
3. 优先级需要明确标注
4. 风险需要充分评估

请以 JSON 格式返回分析结果，格式如下：
{
  "insights": {
    "patternInsights": [
      {
        "pattern": "命令模式",
        "confidence": 0.95,
        "impact": 0.8,
        "relatedPatterns": ["相关模式1", "相关模式2"],
        "usageContext": ["使用场景1", "使用场景2"],
        "recommendations": ["建议1", "建议2"]
      }
    ],
    "correlations": [
      {
        "sourcePattern": "源模式",
        "targetPattern": "目标模式",
        "correlationType": "sequence",
        "strength": 0.85,
        "evidence": ["证据1", "证据2"]
      }
    ],
    "anomalies": [
      {
        "pattern": "异常模式",
        "anomalyType": "frequency",
        "severity": "high",
        "description": "异常描述",
        "suggestedActions": ["建议操作1", "建议操作2"]
      }
    ]
  },
  "suggestions": {
    "immediate": [
      {
        "type": "immediate",
        "target": "优化目标",
        "suggestion": "具体建议",
        "impact": 0.9,
        "effort": 0.3,
        "priority": 0.8,
        "implementation": "实现方法",
        "risks": ["风险1", "风险2"]
      }
    ],
    "longTerm": []
  },
  "metadata": {
    "confidence": 0.95,
    "processingTime": 0,
    "modelVersion": "1.0",
    "timestamp": ""
  }
}
`;

  /**
   * 生成分析 Prompt
   */
  public async generateAnalysisPrompt(input: AIAnalysisInput): Promise<string> {
    try {
      return this.ANALYSIS_TEMPLATE
        .replace('{{patterns}}', JSON.stringify(input.baseAnalysis.patterns, null, 2))
        .replace('{{metrics}}', JSON.stringify(input.baseAnalysis.metrics, null, 2))
        .replace('{{context}}', JSON.stringify({
          environment: input.context.environmentState,
          preferences: input.context.userPreferences,
          history: input.context.historicalData
        }, null, 2));
    } catch (error) {
      console.error('[PromptManager] Failed to generate analysis prompt:', error);
      throw new Error(`Failed to generate analysis prompt: ${error}`);
    }
  }

  /**
   * 验证 Prompt 长度
   */
  private validatePromptLength(prompt: string): boolean {
    // 假设每个字符平均 4 bytes，设置 32KB 的限制
    const MAX_PROMPT_LENGTH = 32 * 1024;
    return Buffer.from(prompt).length <= MAX_PROMPT_LENGTH;
  }
} 