import { EventEmitter } from 'events';
import { CpuBasicInfo, CpuDetailInfo } from '../../../types/monitor/monitor';
import { SSHService } from '../../../types';

/**
 * CPU数据采集服务
 */
export class CpuMetricsService {
  private static instance: CpuMetricsService;
  private sshService: SSHService;
  private readonly MAX_HISTORY_POINTS = 60; // 保存60个历史数据点
  private usageHistory: Map<string, CpuDetailInfo['usageHistory']> = new Map();
  private coreUsageHistory: Map<string, CpuDetailInfo['coreUsageHistory']> = new Map();
  private lastCpuStat: { [key: string]: { user: number; nice: number; system: number; idle: number; iowait: number; irq: number; softirq: number; steal: number; total: number } } = {};
  private lastUsage: { [key: string]: number } = {};
  private lastCpuDetailData: Map<string, CpuDetailInfo> = new Map();

  private constructor(sshService: SSHService) {
    this.sshService = sshService;
  }

  /**
   * 获取单例实例
   */
  static getInstance(sshService: SSHService): CpuMetricsService {
    if (!CpuMetricsService.instance) {
      CpuMetricsService.instance = new CpuMetricsService(sshService);
    }
    return CpuMetricsService.instance;
  }

  /**
   * 采集CPU所有指标数据
   */
  async collectMetrics(sessionId: string): Promise<CpuDetailInfo> {
    try {
      const [basicInfo, usage] = await Promise.all([
        this.getCpuInfo(sessionId),
        this.getCpuUsage(sessionId)
      ]);

      const now = Date.now();

      // 更新CPU使用率历史
      if (!this.usageHistory.has(sessionId)) {
        this.usageHistory.set(sessionId, []);
      }
      const currentUsageHistory = this.usageHistory.get(sessionId)!;
      currentUsageHistory.push({
        timestamp: now,
        usage: basicInfo.usage || 0,
        speed: basicInfo.speed || 0
      });
      if (currentUsageHistory.length > this.MAX_HISTORY_POINTS) {
        currentUsageHistory.shift();
      }

      // 更新每个核心的使用率历史
      if (!this.coreUsageHistory.has(sessionId)) {
        this.coreUsageHistory.set(sessionId, []);
      }
      const currentCoreHistory = this.coreUsageHistory.get(sessionId)!;
      // 确保有足够的数组来存储每个核心的历史数据
      while (currentCoreHistory.length < usage.cores.length) {
        currentCoreHistory.push([]);
      }
      // 更新每个核心的历史数据
      usage.cores.forEach((coreUsage, index) => {
        currentCoreHistory[index].push({
          timestamp: now,
          usage: coreUsage,
          speed: basicInfo.speed
        });
        if (currentCoreHistory[index].length > this.MAX_HISTORY_POINTS) {
          currentCoreHistory[index].shift();
        }
      });

      return {
        ...basicInfo,
        usage: basicInfo.usage || 0,
        cores: usage.cores,
        model: basicInfo.model || 'Unknown',
        speed: basicInfo.speed || 0,
        currentSpeed: basicInfo.speed,
        maxSpeed: basicInfo.maxSpeed,
        minSpeed: basicInfo.minSpeed,
        physicalCores: basicInfo.physicalCores || usage.cores.length / 2,
        logicalCores: basicInfo.logicalCores || usage.cores.length,
        cache: basicInfo.cache || {},
        usageHistory: this.usageHistory.get(sessionId) || [],
        coreUsageHistory: this.coreUsageHistory.get(sessionId) || [],
        architecture: basicInfo.architecture || 'Unknown',
        vendor: basicInfo.vendor || 'Unknown',
        socket: basicInfo.socket || 'Unknown',
        virtualization: basicInfo.virtualization || false
      };
    } catch (error) {
      console.error('采集CPU指标失败:', error);
      return {
        model: '',
        physicalCores: 0,
        logicalCores: 0,
        vendor: '',
        cache: {},
        usage: 0,
        cores: [],
        speed: 0,
        currentSpeed: 0,
        maxSpeed: 0,
        minSpeed: 0,
        usageHistory: [],
        coreUsageHistory: [],
        architecture: 'Unknown',
        socket: 'Unknown',
        virtualization: false
      };
    }
  }

  /**
   * 获取CPU基本信息
   */
  private async getCpuInfo(sessionId: string): Promise<Partial<CpuDetailInfo>> {
    try {
      // 使用 lscpu 获取 CPU 所有基本信息
      const cpuInfoCmd = 'lscpu';
      const cpuInfoResult = await this.sshService.executeCommandDirect(sessionId, cpuInfoCmd);
      
      // 检查是否安装了 lm-sensors
      const checkSensorsCmd = 'which sensors >/dev/null 2>&1 && echo "installed" || echo "not_installed"';
      const sensorsInstalled = await this.sshService.executeCommandDirect(sessionId, checkSensorsCmd);
      
      let temp;
      if (sensorsInstalled.trim() === 'installed') {
        // 如果已安装，尝试获取温度
        const tempCmd = `sensors 2>/dev/null | grep -E "Core|Package|Tdie" | awk '{print $3}' | grep -oE "[0-9]+.[0-9]+" | sort -nr | head -n1`;
        const tempResult = await this.sshService.executeCommandDirect(sessionId, tempCmd);
        temp = tempResult;
      } else {
        temp = 'not_installed';
      }

      // 解析CPU信息
      const info = this.parseCpuInfo(cpuInfoResult || '');
      
      return {
        ...info,
        temperature: temp,
        usage: this.lastUsage[sessionId] || 0  // 使用collectBasicMetrics中计算的使用率
      };
    } catch (error) {
      console.error('获取CPU信息失败:', error);
      return {
        model: '',
        physicalCores: 0,
        logicalCores: 0,
        vendor: '',
        cache: {},
        speed: 0,
        currentSpeed: 0,
        maxSpeed: 0,
        minSpeed: 0
      };
    }
  }

  /**
   * 解析CPU基本信息
   */
  private parseCpuInfo(output: string): Partial<CpuDetailInfo> {
    const info: Required<Pick<CpuDetailInfo, 'cache'>> & Partial<CpuDetailInfo> = {
      model: '',
      physicalCores: 0,
      logicalCores: 0,
      vendor: '',
      cache: {
        l1: 0,
        l2: 0,
        l3: 0
      },
      speed: 0,
      currentSpeed: 0,
      maxSpeed: 0,
      minSpeed: 0
    };

    const lines = output.split('\n');
    for (const line of lines) {
      const [key, value] = line.split(':').map(s => s.trim());
      if (!key || !value) continue;

      switch (key) {
        case 'Model name':
          info.model = value;
          break;
        case 'Vendor ID':
          info.vendor = value;
          break;
        case 'CPU(s)':
          info.logicalCores = parseInt(value) || 0;
          break;
        case 'Core(s) per socket':
          const coresPerSocket = parseInt(value) || 0;
          const sockets = parseInt(lines.find(l => l.includes('Socket(s)'))?.split(':')[1] || '1') || 1;
          info.physicalCores = coresPerSocket * sockets;
          break;
        case 'CPU max MHz':
          info.maxSpeed = parseFloat(value) || 0;
          info.speed = info.maxSpeed; // 基准频率设为最大频率
          break;
        case 'CPU min MHz':
          info.minSpeed = parseFloat(value) || 0;
          break;
        case 'CPU MHz':
          info.currentSpeed = parseFloat(value) || 0;
          break;
        case 'L1d cache':
          info.cache.l1 = parseInt(value) || 0;
          break;
        case 'L2 cache':
          info.cache.l2 = parseInt(value) || 0;
          break;
        case 'L3 cache':
          info.cache.l3 = parseInt(value) || 0;
          break;
        case 'Architecture':
          info.architecture = value;
          break;
        case 'Virtualization':
          info.virtualization = value !== 'none';
          break;
      }
    }

    return info;
  }

  /**
   * 解析CPU温度信息
   */
  private parseTemperature(output: string): string {
    if (!output) return '';

    const temps = output.split('\n')
      .filter(line => line.includes('Core'))
      .map(line => {
        const match = line.match(/\+(\d+\.\d+)°C/);
        return match ? parseFloat(match[1]) : 0;
      });

    return temps.length > 0 ? Math.max(...temps).toString() : '';
  }

  /**
   * 获取核心使用率
   */
  private async getCpuUsage(sessionId: string): Promise<{
    cores: number[];
  }> {
    try {
      console.log('[CpuService] getCpuUsage');
      // 获取每个核心的使用率
      const coresCmd = "mpstat -P ALL 1 1";
      const coresResult = await this.sshService.executeCommandDirect(sessionId, coresCmd);
      
      // 解析每个核心的使用率
      const lines = coresResult.split('\n');
      // 找到第一个数据块的开始位置（跳过头部信息）
      const startIndex = lines.findIndex(line => line.includes('CPU    %usr'));
      if (startIndex === -1) {
        console.error('[CpuService] 未找到CPU数据块');
        return { cores: [] };
      }

      // 提取数据行（跳过'all'行）
      const coresData = lines.slice(startIndex + 2)  // 跳过标题行和'all'行
        .filter(line => line.trim() && !line.includes('Average'))  // 排除空行和Average行
        .map(line => {
          const parts = line.trim().split(/\s+/);
          if (parts.length < 11) return 0;  // 确保有足够的列
          
          // 计算使用率：%usr + %nice + %sys + %irq + %soft + %steal
          const usr = parseFloat(parts[3]) || 0;    // %usr
          const nice = parseFloat(parts[4]) || 0;   // %nice
          const sys = parseFloat(parts[5]) || 0;    // %sys
          const irq = parseFloat(parts[7]) || 0;    // %irq
          const soft = parseFloat(parts[8]) || 0;   // %soft
          const steal = parseFloat(parts[9]) || 0;  // %steal
          
          const usage = usr + nice + sys + irq + soft + steal;
          return isNaN(usage) ? 0 : usage;
        })
        .filter(usage => usage !== undefined);  // 过滤掉无效值

      // console.log('[CpuService] 解析后的核心使用率:', {
      //   count: coresData.length,
      //   rates: coresData,
      //   hasNaN: coresData.some(rate => isNaN(rate))
      // });
      
      return {
        cores: coresData
      };
    } catch (error) {
      console.error('获取CPU使用率失败:', error);
      return {
        cores: []
      };
    }
  }

  /**
   * 获取CPU频率信息
   */
  private async getCpuFrequency(sessionId: string): Promise<{
    current: number;
    min: number;
    max: number;
  }> {
    try {
      // 获取当前频率
      const currentCmd = "cat /proc/cpuinfo | grep 'cpu MHz' | head -n1 | awk '{print $4}'";
      const currentResult = await this.sshService.executeCommandDirect(sessionId, currentCmd);
      
      // 获取最大和最小频率
      const freqCmd = "cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_*_freq 2>/dev/null";
      const freqResult = await this.sshService.executeCommandDirect(sessionId, freqCmd);
      
      return this.parseFrequency(currentResult || '', freqResult || '');
    } catch (error) {
      console.error('获取CPU频率失败:', error);
      return {
        current: 0,
        min: 0,
        max: 0
      };
    }
  }

  /**
   * 解析CPU频率信息
   */
  private parseFrequency(current: string, freq: string): {
    current: number;
    min: number;
    max: number;
  } {
    const currentFreq = parseFloat(current);
    const freqLines = freq.split('\n').filter(line => line.trim());
    
    let min = currentFreq;
    let max = currentFreq;

    for (const line of freqLines) {
      const value = parseInt(line) / 1000; // 转换为MHz
      if (line.includes('scaling_min_freq')) {
        min = value;
      } else if (line.includes('scaling_max_freq')) {
        max = value;
      }
    }

    return {
      current: currentFreq,
      min,
      max
    };
  }

  /**
   * 采集CPU基础指标数据
   */
  async collectBasicMetrics(sessionId: string): Promise<CpuBasicInfo> {
    try {
      console.time(`[CpuService] collectBasicMetrics ${sessionId}`);
      // 获取CPU使用率
      const cpuStatCmd = 'cat /proc/stat | grep "^cpu "';
      const cpuStatResult = await this.sshService.executeCommandDirect(sessionId, cpuStatCmd);
      
      // 获取CPU频率
      const cpuFreqCmd = "cat /proc/cpuinfo | grep 'cpu MHz' | head -n1 | awk '{print $4}'";
      const cpuFreqResult = await this.sshService.executeCommandDirect(sessionId, cpuFreqCmd);

      const usage = this.calculateCpuUsage(sessionId, cpuStatResult);
      const speed = parseFloat(cpuFreqResult || '0');

      // 保存最新的使用率，供getCpuInfo使用
      this.lastUsage[sessionId] = usage;

      console.timeEnd(`[CpuService] collectBasicMetrics ${sessionId}`);
      return {
        usage,
        speed
      };
    } catch (error) {
      console.error('采集CPU基础指标失败:', error);
      return {
        usage: 0,
        speed: 0
      };
    }
  }

  /**
   * 计算CPU使用率
   */
  private calculateCpuUsage(sessionId: string, statContent: string): number {
    try {
      const parts = statContent.trim().split(/\s+/);
      if (parts.length < 8) return 0;

      const stats = {
        user: parseInt(parts[1]),
        nice: parseInt(parts[2]),
        system: parseInt(parts[3]),
        idle: parseInt(parts[4]),
        iowait: parseInt(parts[5]),
        irq: parseInt(parts[6]),
        softirq: parseInt(parts[7]),
        steal: parseInt(parts[8]) || 0
      };

      const total = stats.user + stats.nice + stats.system + stats.idle + 
                    stats.iowait + stats.irq + stats.softirq + stats.steal;

      // 获取上次的统计数据
      const lastStats = this.lastCpuStat[sessionId];
      
      // 更新统计数据
      this.lastCpuStat[sessionId] = { ...stats, total };

      // 如果没有上次的数据，返回0
      if (!lastStats) {
        return 0;
      }

      // 计算时间差
      const totalDiff = total - lastStats.total;
      if (totalDiff === 0) return 0;

      // 计算空闲时间差
      const idleDiff = (stats.idle + stats.iowait) - (lastStats.idle + lastStats.iowait);

      // 计算使用率
      const usage = ((totalDiff - idleDiff) / totalDiff) * 100;

      return Math.min(100, Math.max(0, usage));
    } catch (error) {
      console.error('计算CPU使用率失败:', error);
      return 0;
    }
  }

  /**
   * 采集CPU详细指标数据
   */
  async collectDetailMetrics(sessionId: string, activeTab: string = 'basic'): Promise<CpuDetailInfo> {
    try {
      console.time(`[CpuService] collectDetailMetrics ${sessionId}`);
      
      // 获取上一次的数据
      const lastData = this.lastCpuDetailData.get(sessionId) || {
        usage: 0,
        speed: 0,
        cores: [],
        model: 'Unknown',
        physicalCores: 0,
        logicalCores: 0,
        cache: {},
        maxSpeed: 0,
        minSpeed: 0,
        currentSpeed: 0,
        usageHistory: [],
        coreUsageHistory: [],
        architecture: 'Unknown',
        vendor: 'Unknown',
        socket: 'Unknown',
        virtualization: false
      };

      // 根据活动标签页决定要获取的数据
      const promises: [Promise<Partial<CpuDetailInfo>>, Promise<{ cores: number[] }>] = [
        // 只在 basic 标签页时获取基本信息
        activeTab === 'basic' 
          ? this.getCpuInfo(sessionId)
          : Promise.resolve(lastData),
        
        // 只在 cores 标签页时获取核心使用率
        activeTab === 'cores'
          ? this.getCpuUsage(sessionId)
          : Promise.resolve({ cores: lastData.cores })
      ];

      // 并行获取数据
      const [basicInfo, usage] = await Promise.all(promises);

      const now = Date.now();

      // 更新CPU使用率历史
      if (!this.usageHistory.has(sessionId)) {
        this.usageHistory.set(sessionId, []);
      }
      const currentUsageHistory = this.usageHistory.get(sessionId)!;
      if (activeTab === 'basic') {
        currentUsageHistory.push({
          timestamp: now,
          usage: basicInfo.usage || 0,
          speed: basicInfo.speed || 0
        });
        if (currentUsageHistory.length > this.MAX_HISTORY_POINTS) {
          currentUsageHistory.shift();
        }
      }

      // 只在"逻辑处理器"标签页时更新核心使用率历史
      let currentCoreHistory = this.coreUsageHistory.get(sessionId) || [];
      if (activeTab === 'cores' && usage.cores.length > 0) {
        if (!this.coreUsageHistory.has(sessionId)) {
          this.coreUsageHistory.set(sessionId, []);
        }
        currentCoreHistory = this.coreUsageHistory.get(sessionId)!;
        // 确保有足够的数组来存储每个核心的历史数据
        while (currentCoreHistory.length < usage.cores.length) {
          currentCoreHistory.push([]);
        }
        // 更新每个核心的历史数据
        usage.cores.forEach((coreUsage, index) => {
          currentCoreHistory[index].push({
            timestamp: now,
            usage: coreUsage,
            speed: basicInfo.speed || 0
          });
          if (currentCoreHistory[index].length > this.MAX_HISTORY_POINTS) {
            currentCoreHistory[index].shift();
          }
        });
      }

      // 合并数据，保留上次数据中未更新的部分
      const result = {
        ...lastData,
        ...(activeTab === 'basic' ? basicInfo : {}),
        cores: activeTab === 'cores' ? usage.cores : lastData.cores,
        usageHistory: currentUsageHistory,
        coreUsageHistory: currentCoreHistory
      };

      // 保存本次数据用于下次缓存
      this.lastCpuDetailData.set(sessionId, result);

      console.timeEnd(`[CpuService] collectDetailMetrics ${sessionId}`);
      return result;
    } catch (error) {
      console.error('采集CPU详细指标失败:', error);
      return {
        usage: 0,
        speed: 0,
        cores: [],
        model: '',
        physicalCores: 0,
        logicalCores: 0,
        cache: {},
        usageHistory: [],
        coreUsageHistory: [],
        maxSpeed: 0,
        minSpeed: 0,
        currentSpeed: 0,
        architecture: 'Unknown',
        vendor: 'Unknown',
        socket: 'Unknown',
        virtualization: false
      };
    }
  }

  /**
   * 销毁实例
   */
  destroy(): void {
    this.lastCpuDetailData.clear();
    CpuMetricsService.instance = null as any;
  }
} 