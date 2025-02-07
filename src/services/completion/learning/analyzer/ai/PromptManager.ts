import { AIAnalysisInput } from './types/ai-analysis.types';

/**
 * Prompt 管理器
 * 负责管理和生成 AI 分析所需的 Prompt
 */
export class PromptManager {
  private readonly SYSTEM_PROMPT = `你是一个专业的命令行补全系统优化专家，负责分析用户的命令使用模式并提供优化建议。你需要：
1. 分析命令使用模式和关联性
2. 识别低效或风险的使用方式
3. 提供具体的优化方案
4. 评估优化措施的影响和风险

你的建议应该：
- 聚焦于提高命令执行效率
- 给出具体的优化措施
- 包含详细的实施步骤
- 评估潜在风险和防范措施
- 避免泛泛而谈的"学习建议"

请确保你的分析和建议是：
- 具体可行的
- 有明确的优先级
- 包含风险评估
- 易于实施的

请以 JSON 格式返回分析结果（不要带 markdown 格式），格式如下：
{
  "insights": {
    "patternInsights": [
      {
        "pattern": "命令模式描述",
        "confidence": 0.95,
        "impact": 0.8,
        "relatedPatterns": ["相关模式1", "相关模式2"],
        "usageContext": ["使用场景1", "使用场景2"],
        "recommendations": ["优化建议1", "优化建议2"]
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
        "pattern": "异常模式描述",
        "anomalyType": "frequency",
        "severity": "medium",
        "description": "异常描述信息",
        "suggestedActions": ["改善措施1", "改善措施2"]
      }
    ]
  },
  "suggestions": {
    "immediate": [
      {
        "type": "immediate",
        "target": "优化目标",
        "suggestion": "具体优化建议，例如增加常用命令的自动补全或命令别名配置",
        "impact": 0.9,
        "effort": 0.3,
        "priority": 0.8,
        "implementation": "具体实现步骤描述",
        "risks": ["风险说明1", "风险说明2"]
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
}`;

  /**
   * 生成分析 Prompt
   */
  public generateAnalysisPrompt(
    input: AIAnalysisInput,
    processedData: any
  ): { messages: any[], config: any } {
    try {
      const userPrompt = `请分析以下命令使用数据并提供优化建议：

使用模式数据：
${JSON.stringify(processedData.patterns, null, 2)}

使用指标：
${JSON.stringify(processedData.metrics, null, 2)}

环境信息：
${JSON.stringify({
  baseAnalysis: input.baseAnalysis,
  environment: input.context.environmentState,
  preferences: input.context.userPreferences
}, null, 2)}

请提供详细的分析和优化建议，包括：
1. 模式洞察：识别命令使用模式和关联性
2. 效率分析：评估当前命令使用效率
3. 异常检测：发现潜在的问题和风险
4. 优化方案：提供具体的改进措施

注意：
- 关注命令执行效率和自动化机会
- 提供具体的优化步骤和配置建议
- 评估每个建议的影响和风险
- 避免简单的"多加练习"类建议`;

      return {
        messages: [
          { role: 'system', content: this.SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        config: {
          temperature: 0.7,
          max_tokens: 2000,
          response_format: { type: 'json_object' }
        }
      };
    } catch (error) {
      console.error('[PromptManager] Failed to generate analysis prompt:', error);
      throw error;
    }
  }
} 