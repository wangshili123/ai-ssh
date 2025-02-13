import { EventEmitter } from 'events';
import { CpuInfo as MonitorCpuInfo } from '../../../types/monitor';
import { SSHService } from '../../../types';

/**
 * CPU数据采集服务
 */
export class CpuMetricsService {
  private static instance: CpuMetricsService;
  private sshService: SSHService;

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
  async collectMetrics(sessionId: string): Promise<MonitorCpuInfo> {
    try {
      const [basicInfo, usage, freq] = await Promise.all([
        this.getCpuInfo(sessionId),
        this.getCpuUsage(sessionId),
        this.getCpuFrequency(sessionId)
      ]);

      return {
        ...basicInfo,
        usage: usage.usage,
        cores: usage.cores,
        model: basicInfo.model || 'Unknown',
        speed: basicInfo.speed || freq.current,
        currentSpeed: freq.current,
        maxSpeed: freq.max,
        minSpeed: freq.min,
        physicalCores: basicInfo.physicalCores || usage.cores.length / 2,
        logicalCores: basicInfo.logicalCores || usage.cores.length,
        cache: basicInfo.cache || {},
        usageHistory: [],  // 历史数据由 MonitorManager 维护
        coreUsageHistory: []
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
        coreUsageHistory: []
      };
    }
  }

  /**
   * 获取CPU基本信息
   */
  private async getCpuInfo(sessionId: string): Promise<Partial<MonitorCpuInfo>> {
    try {
      // 获取CPU型号、核心数等基本信息
      const cpuInfoCmd = 'cat /proc/cpuinfo';
      const cpuInfoResult = await this.sshService.executeCommandDirect(sessionId, cpuInfoCmd);
      
      // 获取CPU温度
      const tempCmd = 'sensors 2>/dev/null | grep "Core"';
      const tempResult = await this.sshService.executeCommandDirect(sessionId, tempCmd);
      
      // 解析CPU信息
      const info = this.parseCpuInfo(cpuInfoResult || '');
      const temp = this.parseTemperature(tempResult || '');
      
      return {
        ...info,
        temperature: temp
      };
    } catch (error) {
      console.error('获取CPU信息失败:', error);
      return {
        model: '',
        physicalCores: 0,
        logicalCores: 0,
        vendor: '',
        cache: {}
      };
    }
  }

  /**
   * 解析CPU基本信息
   */
  private parseCpuInfo(output: string): Partial<MonitorCpuInfo> {
    const info: Partial<MonitorCpuInfo> = {
      model: '',
      physicalCores: 0,
      logicalCores: 0,
      vendor: '',
      cache: {}
    };

    const lines = output.split('\n');
    let physicalId = new Set();
    let coreId = new Set();

    for (const line of lines) {
      if (line.includes('model name')) {
        info.model = line.split(':')[1].trim();
      } else if (line.includes('vendor_id')) {
        info.vendor = line.split(':')[1].trim();
      } else if (line.includes('physical id')) {
        physicalId.add(line.split(':')[1].trim());
      } else if (line.includes('core id')) {
        coreId.add(line.split(':')[1].trim());
      } else if (line.includes('cache size')) {
        info.cache = {
          ...info.cache,
          l3: parseInt(line.split(':')[1].trim())
        };
      }
    }

    info.physicalCores = coreId.size * physicalId.size;
    info.logicalCores = lines.filter(line => line.includes('processor')).length;

    return info;
  }

  /**
   * 解析CPU温度信息
   */
  private parseTemperature(output: string): number | undefined {
    if (!output) return undefined;

    const temps = output.split('\n')
      .filter(line => line.includes('Core'))
      .map(line => {
        const match = line.match(/\+(\d+\.\d+)°C/);
        return match ? parseFloat(match[1]) : 0;
      });

    return temps.length > 0 ? Math.max(...temps) : undefined;
  }

  /**
   * 获取CPU使用率
   */
  private async getCpuUsage(sessionId: string): Promise<{
    usage: number;
    cores: number[];
  }> {
    try {
      // 获取总体CPU使用率
      const totalCmd = "top -bn1 | grep 'Cpu(s)' | awk '{print $2}'";
      const totalResult = await this.sshService.executeCommandDirect(sessionId, totalCmd);
      // console.log('[CpuService] 总体CPU使用率:', totalResult);
      
      // 获取每个核心的使用率
      const coresCmd = "mpstat -P ALL 1 1";
      const coresResult = await this.sshService.executeCommandDirect(sessionId, coresCmd);
      // console.log('[CpuService] mpstat原始输出:', coresResult);
      
      // 解析每个核心的使用率
      const lines = coresResult.split('\n');
      // 找到第一个数据块的开始位置（跳过头部信息）
      const startIndex = lines.findIndex(line => line.includes('CPU    %usr'));
      if (startIndex === -1) {
        console.error('[CpuService] 未找到CPU数据块');
        return { usage: 0, cores: [] };
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
        usage: parseFloat(totalResult || '0'),
        cores: coresData
      };
    } catch (error) {
      console.error('获取CPU使用率失败:', error);
      return {
        usage: 0,
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
   * 销毁实例
   */
  destroy(): void {
    CpuMetricsService.instance = null as any;
  }
} 