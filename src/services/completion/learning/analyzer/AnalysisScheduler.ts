import { PatternAnalyzer } from './PatternAnalyzer';
import { DatabaseService } from '../../../database/DatabaseService';

/**
 * 分析任务调度器
 * 负责管理和调度模式分析任务
 */
export class AnalysisScheduler {
  private static instance: AnalysisScheduler;
  private isAnalyzing: boolean = false;
  private lastAnalysisTime: Date | null = null;
  private analysisInterval: number = 24 * 60 * 60 * 1000; // 24小时
  private retryCount: number = 0;
  private readonly MAX_RETRIES: number = 3;
  private schedulerTimer: NodeJS.Timeout | null = null;

  private constructor() {}

  /**
   * 获取调度器实例
   */
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
    }, this.analysisInterval);
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
   * 调度分析任务
   */
  private async scheduleAnalysis(): Promise<void> {
    // 如果正在分析中，跳过
    if (this.isAnalyzing) {
      console.log('[AnalysisScheduler] Analysis already in progress, skipping');
      return;
    }

    try {
      this.isAnalyzing = true;
      console.log('[AnalysisScheduler] Starting analysis task');

      // 获取数据库实例
      const db = DatabaseService.getInstance().getDatabase();
      if (!db) {
        throw new Error('Database not initialized');
      }

      // 执行分析
      const analyzer = PatternAnalyzer.getInstance();
      await analyzer.analyze();

      // 更新最后分析时间
      this.lastAnalysisTime = new Date();
      this.retryCount = 0;

      console.log('[AnalysisScheduler] Analysis completed successfully');
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
    return now - lastAnalysis >= this.analysisInterval;
  }

  /**
   * 手动触发分析
   */
  public async triggerAnalysis(): Promise<void> {
    console.log('[AnalysisScheduler] Manually triggering analysis');
    await this.scheduleAnalysis();
  }
} 