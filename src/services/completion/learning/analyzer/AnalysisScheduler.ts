import { AIAnalyzer } from './ai/AIAnalyzer';
import { PromptManager } from './ai/PromptManager';
import { AnalysisStateManager, DataCheckResult } from './AnalysisStateManager';

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

  // 配置参数
  private config = {
    minCommandCount: 10,        // 最小命令数
    minCompletionCount: 20,     // 最小补全数
    minDataChangeRate: 0.2,     // 最小数据变化率
    minAnalysisInterval: 0.2 * 60 * 1000,  // 最小分析间隔（12秒）
    optimalAnalysisInterval: 30 * 60 * 1000  // 最佳分析间隔（30分钟）
  };

  private constructor() {
    this.stateManager = AnalysisStateManager.getInstance();
    this.promptManager = new PromptManager();
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

      // 1. 检查数据充分性
      const checkResult = await this.stateManager.checkDataSufficiency();
      
      if (!this.shouldRunAnalysis(checkResult)) {
        console.log('[AnalysisScheduler] 数据量不足或变化不大，跳过分析');
        return;
      }

      // 2. 执行 AI 分析
      const aiResult = await this.runAIAnalysis();
      if (aiResult) {
        console.log('[AnalysisScheduler] AI analysis completed:', {
          completionsCount: aiResult.completions.length,
          averageConfidence: aiResult.metadata.averageConfidence
        });
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
        this.retryCount = 0;
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
  public async triggerAnalysis(): Promise<void> {
    console.log('[AnalysisScheduler] Manually triggering analysis');
    await this.scheduleAnalysis();
  }
} 