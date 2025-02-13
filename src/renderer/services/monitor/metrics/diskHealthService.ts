import { SSHService } from '../../../types';

export interface SmartInfo {
  device: string;
  status: 'PASSED' | 'FAILED' | 'UNKNOWN';
  temperature: number;
  powerOnHours: number;
  reallocatedSectors: number;
  pendingSectors: number;
  uncorrectableSectors: number;
  model: string;
  serial: string;
  remainingLife?: number;
}

export interface DiskHealth {
  devices: SmartInfo[];
  lastCheck: number;
}

interface DiskDevice {
  device: string;
  model: string;
  type: string;
}

/**
 * 磁盘健康监控服务
 */
export class DiskHealthService {
  private static instance: DiskHealthService;
  private sshService: SSHService;
  private readonly CACHE_TTL = 3600000; // 1小时缓存过期
  private healthCache: Map<string, DiskHealth> = new Map();

  private constructor(sshService: SSHService) {
    this.sshService = sshService;
  }

  static getInstance(sshService: SSHService): DiskHealthService {
    if (!DiskHealthService.instance) {
      DiskHealthService.instance = new DiskHealthService(sshService);
    }
    return DiskHealthService.instance;
  }

  /**
   * 检查所需工具是否可用
   */
  private async checkToolsAvailable(sessionId: string): Promise<boolean> {
    try {
      // 检查smartctl命令是否可用
      const result = await this.sshService.executeCommandDirect(sessionId, 'which smartctl');
      // which命令如果找不到会返回类似 "no smartctl in (...)" 的错误信息
      if (result.includes('no smartctl in')) {
        console.log('smartctl 工具未安装，跳过磁盘健康检查:', {
          sessionId,
          result,
          timestamp: new Date().toISOString()
        });
        return false;
      }
      return true;
    } catch (error) {
      console.log('检查工具可用性失败:', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
      return false;
    }
  }

  /**
   * 获取磁盘健康状态
   */
  async getDiskHealth(sessionId: string): Promise<DiskHealth | undefined> {
    try {
      console.log('开始获取磁盘健康状态:', {
        sessionId,
        timestamp: new Date().toISOString()
      });

      // 检查缓存
      const cachedData = this.healthCache.get(sessionId);
      if (cachedData && Date.now() - cachedData.lastCheck < this.CACHE_TTL) {
        console.log('使用缓存的磁盘健康数据:', {
          sessionId,
          lastCheck: new Date(cachedData.lastCheck).toISOString(),
          devicesCount: cachedData.devices.length,
          timestamp: new Date().toISOString()
        });
        return cachedData;
      }

      // 检查工具是否可用
      const toolsAvailable = await this.checkToolsAvailable(sessionId);
      if (!toolsAvailable) {
        return {
          devices: [],
          lastCheck: Date.now()
        };
      }

      // 获取所有磁盘设备
      const devices = await this.getDevices(sessionId);
      if (!devices.length) {
        console.log('未找到磁盘设备:', {
          sessionId,
          timestamp: new Date().toISOString()
        });
        return undefined;
      }

      console.log('找到磁盘设备:', {
        sessionId,
        deviceCount: devices.length,
        devices: devices.map(d => d.device),
        timestamp: new Date().toISOString()
      });

      // 并行获取所有设备的SMART信息
      const smartInfoPromises = devices.map(device => this.getSmartInfo(sessionId, device.device));
      const smartInfoResults = await Promise.allSettled(smartInfoPromises);

      const healthDevices: SmartInfo[] = [];
      smartInfoResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          healthDevices.push(result.value);
        } else {
          console.warn('获取SMART信息失败:', {
            sessionId,
            device: devices[index].device,
            error: result.status === 'rejected' ? result.reason : '无SMART数据',
            timestamp: new Date().toISOString()
          });
        }
      });

      const health: DiskHealth = {
        devices: healthDevices,
        lastCheck: Date.now()
      };

      // 更新缓存
      this.healthCache.set(sessionId, health);

      console.log('磁盘健康状态获取完成:', {
        sessionId,
        devicesCount: health.devices.length,
        lastCheck: new Date(health.lastCheck).toISOString(),
        timestamp: new Date().toISOString()
      });

      return health;
    } catch (error) {
      console.error('获取磁盘健康状态失败:', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
      return undefined;
    }
  }

  /**
   * 获取所有磁盘设备
   */
  private async getDevices(sessionId: string): Promise<DiskDevice[]> {
    try {
      // 获取所有物理磁盘设备
      const lsblkCmd = 'lsblk -d -o NAME,MODEL,TYPE | grep disk';
      const output = await this.sshService.executeCommandDirect(sessionId, lsblkCmd);
      if (!output) return [];

      return output.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [device, ...modelParts] = line.trim().split(/\s+/);
          const type = modelParts.pop() || '';
          const model = modelParts.join(' ');
          return {
            device,
            model,
            type
          };
        });
    } catch (error) {
      console.error('获取磁盘设备列表失败:', error);
      return [];
    }
  }

  /**
   * 获取单个设备的SMART信息
   */
  private async getSmartInfo(sessionId: string, device: string): Promise<SmartInfo | null> {
    try {
      // 获取SMART详细信息
      const smartctlCmd = `smartctl -a /dev/${device}`;
      const output = await this.sshService.executeCommandDirect(sessionId, smartctlCmd);
      console.log('获取SMART信息:', {
        sessionId,
        device,
        output
      });
      if (!output) return null;

      return this.parseSmartOutput(device, output);
    } catch (error) {
      console.error(`获取设备 ${device} 的SMART信息失败:`, error);
      return null;
    }
  }

  /**
   * 解析SMART输出信息
   */
  private parseSmartOutput(device: string, output: string): SmartInfo {
    const lines = output.split('\n');
    const info: Partial<SmartInfo> = { device };
    let smartValues: { [key: string]: number } = {};

    for (const line of lines) {
      if (line.includes('SMART overall-health self-assessment test result:')) {
        info.status = line.includes('PASSED') ? 'PASSED' : 
                     line.includes('FAILED') ? 'FAILED' : 'UNKNOWN';
      } else if (line.includes('Model Family') || line.includes('Device Model')) {
        info.model = line.split(':')[1]?.trim() || 'Unknown';
      } else if (line.includes('Serial Number')) {
        info.serial = line.split(':')[1]?.trim() || 'Unknown';
      } else if (line.includes('Temperature_Celsius') || line.includes('Airflow_Temperature_Cel')) {
        const parts = line.trim().split(/\s+/);
        const tempMatch = parts[9]?.match(/\d+/);
        if (tempMatch) {
          info.temperature = parseInt(tempMatch[0]);
        }
      } else if (line.includes('Power_On_Hours')) {
        const parts = line.trim().split(/\s+/);
        const hoursMatch = parts[9]?.match(/\d+/);
        if (hoursMatch) {
          info.powerOnHours = parseInt(hoursMatch[0]);
        }
      } else if (line.includes('Reallocated_Sector_Ct')) {
        const parts = line.trim().split(/\s+/);
        const match = parts[9]?.match(/\d+/);
        info.reallocatedSectors = match ? parseInt(match[0]) : 0;
      } else if (line.includes('Current_Pending_Sector')) {
        const parts = line.trim().split(/\s+/);
        const match = parts[9]?.match(/\d+/);
        info.pendingSectors = match ? parseInt(match[0]) : 0;
      } else if (line.includes('Offline_Uncorrectable')) {
        const parts = line.trim().split(/\s+/);
        const match = parts[9]?.match(/\d+/);
        info.uncorrectableSectors = match ? parseInt(match[0]) : 0;
      }

      // 收集其他SMART属性的值
      if (line.match(/^\s*\d+\s+\w+/)) {
        const parts = line.trim().split(/\s+/);
        const attrId = parts[0];
        const value = parseInt(parts[3]); // 使用normalized value
        if (!isNaN(value)) {
          smartValues[attrId] = value;
        }
      }
    }

    // 评估磁盘寿命
    let lifeScore = 100;
    const criticalAttrs = {
      '5': { weight: 30, maxValue: 100 },   // Reallocated_Sector_Ct
      '196': { weight: 10, maxValue: 100 }, // Reallocation_Event_Count
      '197': { weight: 10, maxValue: 100 }, // Current_Pending_Sector
      '198': { weight: 20, maxValue: 100 }, // Offline_Uncorrectable
      '199': { weight: 10, maxValue: 100 }, // UDMA_CRC_Error_Count
      '187': { weight: 10, maxValue: 100 }, // Reported_Uncorrect
      '188': { weight: 10, maxValue: 100 }  // Command_Timeout
    };

    let totalWeight = 0;
    let weightedSum = 0;

    // 计算加权平均值
    for (const [attrId, config] of Object.entries(criticalAttrs)) {
      if (attrId in smartValues) {
        // 确保值在0-100之间
        const normalizedValue = Math.min(100, Math.max(0, smartValues[attrId]));
        weightedSum += normalizedValue * config.weight;
        totalWeight += config.weight;
      }
    }

    // 如果有足够的属性来评估
    if (totalWeight > 0) {
      lifeScore = Math.round(weightedSum / totalWeight);
      // 确保寿命值在0-100之间
      info.remainingLife = Math.min(100, Math.max(0, lifeScore));
    } else if (info.status === 'PASSED') {
      // 如果没有足够的属性但状态是PASSED，给一个基础评分
      info.remainingLife = 76;
    }

    // 如果有坏道，额外扣分
    const totalBadSectors = (info.reallocatedSectors || 0) + (info.pendingSectors || 0) + (info.uncorrectableSectors || 0);
    if (totalBadSectors > 0) {
      const badSectorPenalty = Math.min(50, totalBadSectors);
      info.remainingLife = Math.max(0, Math.min(100, (info.remainingLife || 100) - badSectorPenalty));
    }

    // 最后确保一次寿命值在0-100之间
    if (info.remainingLife !== undefined) {
      info.remainingLife = Math.min(100, Math.max(0, info.remainingLife));
    }

    return {
      device,
      status: info.status || 'UNKNOWN',
      temperature: info.temperature || 0,
      powerOnHours: info.powerOnHours || 0,
      reallocatedSectors: info.reallocatedSectors || 0,
      pendingSectors: info.pendingSectors || 0,
      uncorrectableSectors: info.uncorrectableSectors || 0,
      model: info.model || 'Unknown',
      serial: info.serial || 'Unknown',
      remainingLife: info.remainingLife
    };
  }

  destroy(): void {
    DiskHealthService.instance = null as any;
  }
} 