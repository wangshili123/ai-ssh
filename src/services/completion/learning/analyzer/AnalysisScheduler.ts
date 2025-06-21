import { AIAnalyzer } from './ai/AIAnalyzer';
import { PromptManager } from './ai/PromptManager';
import { AnalysisStateManager, DataCheckResult } from './AnalysisStateManager';
import { AIConfigManager } from '../../../../renderer/services/config/AIConfig';
import type { AIConfig } from '../../../../renderer/types/baseconfig/BaseConfigType';

/**
 * 分析任务调度器
 * 负责管理和调度模式分析任务
 */
export class AnalysisScheduler {
  private static instance: AnalysisScheduler;
  private isAnalyzing: boolean = false;
  private lastAnalysisTime: Date | null = null;
  private retryCount: number = 0;
  private readonly MAX_RETRIES: number = 3;
  private schedulerTimer: NodeJS.Timeout | null = null;
  private stateManager: AnalysisStateManager;
  private promptManager: PromptManager;
  private aiConfigManager: AIConfigManager;

  // 配置参数
  private config = {
    minCommandCount: 10,        // 最小命令数
    minCompletionCount: 20,     // 最小补全数
    minDataChangeRate: 0.2,     // 最小数据变化率
    minAnalysisInterval: 5 * 60 * 1000,  // 最小分析间隔（12秒）
    optimalAnalysisInterval: 30 * 60 * 1000  // 最佳分析间隔（30分钟）
  };

  private constructor() {
    this.stateManager = AnalysisStateManager.getInstance();
    this.promptManager = new PromptManager();
    this.aiConfigManager = AIConfigManager.getInstance();
  }

  public static getInstance(): AnalysisScheduler {
    if (!AnalysisScheduler.instance) {
      AnalysisScheduler.instance = new AnalysisScheduler();
    }
    return AnalysisScheduler.instance;
  }

  /**
   * 启动调度器
   */
  public startScheduling(): void {
    console.log('[AnalysisScheduler] Starting scheduler');
    
    // 先执行一次分析
    this.scheduleAnalysis();
    
    // 设置定期执行
    this.schedulerTimer = setInterval(() => {
      this.scheduleAnalysis();
    }, this.config.minAnalysisInterval);
  }

  /**
   * 停止调度器
   */
  public stopScheduling(): void {
    console.log('[AnalysisScheduler] Stopping scheduler');
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  /**
   * 检查是否允许自动分析
   */
  private async shouldAllowAutoAnalysis(): Promise<boolean> {
    try {
      // 首先检查并重置月度使用次数
      const aiConfig = await this.aiConfigManager.checkAndResetMonthlyUsage();

      // 1. 检查总开关
      if (!aiConfig.autoAnalysisEnabled) {
        console.log('[AnalysisScheduler] 自动分析已禁用');
        return false;
      }

      // 2. 检查频率设置
      if (aiConfig.autoAnalysisFrequency === 'manual') {
        console.log('[AnalysisScheduler] 设置为仅手动分析');
        return false;
      }

      // 3. 检查月度额度
      const currentUsage = aiConfig.autoAnalysisCurrentUsage || 0;
      const quotaLimit = aiConfig.autoAnalysisQuotaLimit || 50;
      if (currentUsage >= quotaLimit) {
        console.log('[AnalysisScheduler] 月度AI调用额度已用完:', {
          currentUsage,
          quotaLimit
        });
        return false;
      }

      // 4. 检查频率间隔
      const lastAnalysisTime = this.lastAnalysisTime?.getTime() || 0;
      const now = Date.now();
      const requiredInterval = this.getRequiredInterval(aiConfig.autoAnalysisFrequency || 'weekly');

      if (now - lastAnalysisTime < requiredInterval) {
        console.log('[AnalysisScheduler] 未到分析时间间隔:', {
          timeSinceLastAnalysis: now - lastAnalysisTime,
          requiredInterval
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error('[AnalysisScheduler] 检查自动分析配置失败:', error);
      return false;
    }
  }

  /**
   * 根据频率设置获取所需间隔时间
   */
  private getRequiredInterval(frequency: 'daily' | 'weekly' | 'manual'): number {
    switch (frequency) {
      case 'daily':
        return 24 * 60 * 60 * 1000; // 24小时
      case 'weekly':
        return 7 * 24 * 60 * 60 * 1000; // 7天
      default:
        return this.config.minAnalysisInterval; // 默认间隔
    }
  }

  /**
   * 判断是否应该执行分析
   */
  private shouldRunAnalysis(checkResult: DataCheckResult): boolean {
    if (!checkResult.hasEnoughData) {
      console.log('[AnalysisScheduler] 数据量不足或变化不大:', checkResult.metrics);
      return false;
    }

    // 检查时间间隔
    const timeSinceLastAnalysis = Date.now() - checkResult.metrics.lastAnalysisTime.getTime();
    if (timeSinceLastAnalysis < this.config.minAnalysisInterval) {
      console.log('[AnalysisScheduler] 分析间隔过短:', {
        timeSinceLastAnalysis,
        required: this.config.minAnalysisInterval
      });
      return false;
    }

    return true;
  }

  /**
   * 执行 AI 分析
   */
  private async runAIAnalysis() {
    try {
      // 1. 获取分析状态和新命令
      const { lastState, newCommands } = await this.stateManager.getAnalysisData();
      
      if (!newCommands || newCommands.length === 0) {
        console.log('[AnalysisScheduler] No new commands to analyze');
        return null;
      }

      // 2. 生成分析提示词
      const prompt = this.promptManager.generateAnalysisPrompt({
        commands: newCommands,
        lastState: lastState
      });

      // 3. 执行 AI 分析
      const aiAnalyzer = AIAnalyzer.getInstance();
      const result = await aiAnalyzer.analyze(prompt);

      if (!result) {
        return null;
      }

      // 4. 保存分析结果
      await this.stateManager.saveAnalysisResult(result, newCommands);

      return result;
    } catch (error) {
      console.error('[AnalysisScheduler] AI analysis failed:', error);
      return null;
    }
  }

  /**
   * 调度分析任务
   */
  private async scheduleAnalysis(): Promise<void> {
    if (this.isAnalyzing) {
      console.log('[AnalysisScheduler] Analysis already in progress, skipping');
      return;
    }

    try {
      this.isAnalyzing = true;
      console.log('[AnalysisScheduler] Starting analysis task');

      // 1. 首先检查是否允许自动分析
      if (!(await this.shouldAllowAutoAnalysis())) {
        console.log('[AnalysisScheduler] 自动分析被配置禁用，跳过分析');
        return;
      }

      // 2. 检查数据充分性
      const checkResult = await this.stateManager.checkDataSufficiency();

      if (!this.shouldRunAnalysis(checkResult)) {
        console.log('[AnalysisScheduler] 数据量不足或变化不大，跳过分析');
        return;
      }

      // 3. 执行 AI 分析
      const aiResult = await this.runAIAnalysis();
      if (aiResult) {
        console.log('[AnalysisScheduler] AI analysis completed:', {
          completionsCount: aiResult.completions.length,
          averageConfidence: aiResult.metadata.averageConfidence
        });

        // 分析成功后更新使用次数
        await this.updateUsageCount();
      }

      // 更新最后分析时间
      this.lastAnalysisTime = new Date();
      this.retryCount = 0;

      console.log('[AnalysisScheduler] Analysis pipeline completed successfully');
    } catch (error) {
      console.error('[AnalysisScheduler] Analysis failed:', error);
      
      // 处理重试逻辑
      if (this.retryCount < this.MAX_RETRIES) {
        this.retryCount++;
        console.log(`[AnalysisScheduler] Retrying analysis (${this.retryCount}/${this.MAX_RETRIES})`);
        
        // 延迟重试
        setTimeout(() => {
          this.scheduleAnalysis();
        }, 5 * 60 * 1000); // 5分钟后重试
      } else {
        console.error('[AnalysisScheduler] Max retries reached, giving up');
        
        // 达到最大重试次数,更新分析状态以避免重复分析相同数据
        try {
          const { lastState, newCommands } = await this.stateManager.getAnalysisData();
          if (newCommands && newCommands.length > 0) {
            await this.stateManager.updateAnalysisState(
              newCommands[newCommands.length - 1].id,
              newCommands.length,
              {
                totalCommands: lastState?.processed_count || 0,
                uniquePatterns: 0,
                averageConfidence: 0,
                error: 'Analysis failed after max retries'
              }
            );
          }
        } catch (updateError) {
          console.error('[AnalysisScheduler] Failed to update analysis state after max retries:', updateError);
        }
        
        this.retryCount = 0;
        this.lastAnalysisTime = new Date(); // 更新最后分析时间,避免立即重试
      }
    } finally {
      this.isAnalyzing = false;
    }
  }

  /**
   * 获取上次分析时间
   */
  public getLastAnalysisTime(): Date | null {
    return this.lastAnalysisTime;
  }

  /**
   * 检查是否需要执行分析
   */
  public shouldAnalyze(): boolean {
    if (!this.lastAnalysisTime) {
      return true;
    }

    const now = new Date().getTime();
    const lastAnalysis = this.lastAnalysisTime.getTime();
    return now - lastAnalysis >= this.config.minAnalysisInterval;
  }

  /**
   * 手动触发分析
   */
  public async triggerAnalysis(): Promise<{ success: boolean; message: string }> {
    console.log('[AnalysisScheduler] Manually triggering analysis');

    if (this.isAnalyzing) {
      return {
        success: false,
        message: '分析正在进行中，请稍后再试'
      };
    }

    try {
      // 手动触发时，绕过自动分析的开关检查，但仍需检查额度
      const result = await this.runManualAnalysis();
      return result;
    } catch (error) {
      console.error('[AnalysisScheduler] Manual analysis failed:', error);
      return {
        success: false,
        message: '手动分析失败: ' + (error instanceof Error ? error.message : '未知错误')
      };
    }
  }

  /**
   * 执行手动分析（绕过自动分析限制）
   */
  private async runManualAnalysis(): Promise<{ success: boolean; message: string }> {
    try {
      this.isAnalyzing = true;
      console.log('[AnalysisScheduler] Starting manual analysis');

      // 1. 检查并重置月度使用次数
      const aiConfig = await this.aiConfigManager.checkAndResetMonthlyUsage();

      // 2. 检查月度额度（手动触发仍需检查额度）
      const currentUsage = aiConfig.autoAnalysisCurrentUsage || 0;
      const quotaLimit = aiConfig.autoAnalysisQuotaLimit || 50;
      if (currentUsage >= quotaLimit) {
        return {
          success: false,
          message: `月度AI调用额度已用完 (${currentUsage}/${quotaLimit})`
        };
      }

      // 3. 检查数据充分性
      const checkResult = await this.stateManager.checkDataSufficiency();
      if (!checkResult.hasEnoughData) {
        return {
          success: false,
          message: '当前数据量不足，无法进行有效分析'
        };
      }

      // 4. 执行 AI 分析
      const aiResult = await this.runAIAnalysis();
      if (aiResult) {
        console.log('[AnalysisScheduler] Manual AI analysis completed:', {
          completionsCount: aiResult.completions.length,
          averageConfidence: aiResult.metadata.averageConfidence
        });

        // 分析成功后更新使用次数
        await this.updateUsageCount();

        // 更新最后分析时间
        this.lastAnalysisTime = new Date();
        this.retryCount = 0;

        return {
          success: true,
          message: `分析完成！生成了 ${aiResult.completions.length} 个补全建议，平均置信度 ${(aiResult.metadata.averageConfidence * 100).toFixed(1)}%`
        };
      } else {
        return {
          success: false,
          message: '分析未能生成有效结果，请检查AI配置'
        };
      }
    } finally {
      this.isAnalyzing = false;
    }
  }

  /**
   * 更新AI调用使用次数
   */
  private async updateUsageCount(): Promise<void> {
    try {
      const config = await this.aiConfigManager.getConfig();
      const currentUsage = (config.autoAnalysisCurrentUsage || 0) + 1;

      await this.aiConfigManager.saveConfig({
        ...config,
        autoAnalysisCurrentUsage: currentUsage
      });

      console.log('[AnalysisScheduler] 更新AI调用使用次数:', {
        previousUsage: config.autoAnalysisCurrentUsage || 0,
        currentUsage,
        quotaLimit: config.autoAnalysisQuotaLimit || 50
      });
    } catch (error) {
      console.error('[AnalysisScheduler] 更新使用次数失败:', error);
    }
  }
}