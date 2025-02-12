import { cpuService } from './cpuService';
import { memoryService } from './memoryService';
import { TimeSeriesData, RefreshOptions, CPUInfo, CPUUsage, CPULoad, MemoryInfo, MemoryStats, VMStats } from './metricsTypes';
import EventEmitter from 'events';

interface MetricsData {
  cpu: {
    info: CPUInfo | null;
    usage: TimeSeriesData<CPUUsage>[];
    load: TimeSeriesData<CPULoad>[];
  };
  memory: {
    info: MemoryInfo | null;
    stats: TimeSeriesData<MemoryStats>[];
    vmStats: TimeSeriesData<VMStats>[];
  };
}

/**
 * 监控数据管理器
 */
export class MetricsManager extends EventEmitter {
  private static instance: MetricsManager;
  private refreshTimer: NodeJS.Timer | null = null;
  private data: MetricsData = {
    cpu: {
      info: null,
      usage: [],
      load: []
    },
    memory: {
      info: null,
      stats: [],
      vmStats: []
    }
  };

  private options: RefreshOptions = {
    interval: 5000,        // 默认5秒刷新一次
    maxDataPoints: 60,     // 默认保存60个数据点
    autoRefresh: true      // 默认自动刷新
  };

  private constructor() {
    super();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): MetricsManager {
    if (!MetricsManager.instance) {
      MetricsManager.instance = new MetricsManager();
    }
    return MetricsManager.instance;
  }

  /**
   * 初始化监控数据
   */
  async initialize(): Promise<void> {
    try {
      // 获取基本信息
      const [cpuInfo, memoryInfo] = await Promise.all([
        cpuService.getCPUInfo(),
        memoryService.getMemoryInfo()
      ]);

      this.data.cpu.info = cpuInfo;
      this.data.memory.info = memoryInfo;

      // 开始自动刷新
      if (this.options.autoRefresh) {
        this.startRefresh();
      }
    } catch (error) {
      console.error('Failed to initialize metrics:', error);
      throw error;
    }
  }

  /**
   * 开始自动刷新
   */
  startRefresh(): void {
    if (this.refreshTimer) {
      return;
    }

    // 立即执行一次刷新
    this.refresh();

    // 设置定时刷新
    this.refreshTimer = setInterval(() => {
      this.refresh();
    }, this.options.interval);
  }

  /**
   * 停止自动刷新
   */
  stopRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer as NodeJS.Timeout);
      this.refreshTimer = null;
    }
  }

  /**
   * 手动刷新数据
   */
  async refresh(): Promise<void> {
    try {
      // 并行获取所有数据
      const [cpuUsage, cpuLoad, memStats, vmStats] = await Promise.all([
        cpuService.getCPUUsage(),
        cpuService.getCPULoad(),
        memoryService.getMemoryStats(),
        memoryService.getVMStats()
      ]);

      const timestamp = Date.now();

      // 更新CPU数据
      this.data.cpu.usage.push({
        timestamp,
        value: cpuUsage
      });
      this.data.cpu.load.push({
        timestamp,
        value: cpuLoad
      });

      // 更新内存数据
      this.data.memory.stats.push({
        timestamp,
        value: memStats
      });
      this.data.memory.vmStats.push({
        timestamp,
        value: vmStats
      });

      // 限制数据点数量
      this.trimData();

      // 发送数据更新事件
      this.emit('dataUpdated', this.data);
    } catch (error) {
      console.error('Failed to refresh metrics:', error);
      this.emit('error', error);
    }
  }

  /**
   * 限制数据点数量
   */
  private trimData(): void {
    const trim = (arr: any[]) => {
      if (arr.length > this.options.maxDataPoints) {
        arr.splice(0, arr.length - this.options.maxDataPoints);
      }
    };

    trim(this.data.cpu.usage);
    trim(this.data.cpu.load);
    trim(this.data.memory.stats);
    trim(this.data.memory.vmStats);
  }

  /**
   * 更新刷新选项
   */
  updateOptions(options: Partial<RefreshOptions>): void {
    this.options = { ...this.options, ...options };

    // 如果更新了刷新间隔，需要重启定时器
    if (options.interval !== undefined && this.refreshTimer) {
      this.stopRefresh();
      this.startRefresh();
    }

    // 处理自动刷新状态变化
    if (options.autoRefresh !== undefined) {
      if (options.autoRefresh && !this.refreshTimer) {
        this.startRefresh();
      } else if (!options.autoRefresh && this.refreshTimer) {
        this.stopRefresh();
      }
    }
  }

  /**
   * 获取当前数据
   */
  getData(): MetricsData {
    return this.data;
  }

  /**
   * 获取当前选项
   */
  getOptions(): RefreshOptions {
    return { ...this.options };
  }

  /**
   * 清理数据
   */
  clearData(): void {
    this.data = {
      cpu: {
        info: this.data.cpu.info,
        usage: [],
        load: []
      },
      memory: {
        info: this.data.memory.info,
        stats: [],
        vmStats: []
      }
    };
    this.emit('dataCleared');
  }

  /**
   * 销毁实例
   */
  destroy(): void {
    this.stopRefresh();
    this.removeAllListeners();
    cpuService.destroy();
    memoryService.destroy();
    MetricsManager.instance = null as any;
  }
}

// 导出单例
export const metricsManager = MetricsManager.getInstance(); 