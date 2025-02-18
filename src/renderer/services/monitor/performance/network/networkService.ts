import { SSHService } from '../../../../types';
import { NetworkBasicInfo, NetworkDetailInfo } from '../../../../types/monitor';
import { NetworkInterfaceService } from './networkInterfaceService';
import { NetworkConnectionService } from './networkConnectionService';
import { NetworkProcessService } from './networkProcessService';

/**
 * 网络监控服务
 */
export class NetworkService {
  private static instance: NetworkService;
  private sshService: SSHService;
  private networkInterfaceService: NetworkInterfaceService;
  private networkConnectionService: NetworkConnectionService;
  private networkProcessService: NetworkProcessService;
  private previousStats: { [key: string]: { rx: number; tx: number; timestamp: number } } = {};
  private lastNetworkDetailData: Map<string, NetworkDetailInfo> = new Map();

  private constructor(sshService: SSHService) {
    this.sshService = sshService;
    this.networkInterfaceService = NetworkInterfaceService.getInstance(sshService);
    this.networkConnectionService = NetworkConnectionService.getInstance(sshService);
    this.networkProcessService = NetworkProcessService.getInstance(sshService);
  }

  static getInstance(sshService: SSHService): NetworkService {
    if (!NetworkService.instance) {
      NetworkService.instance = new NetworkService(sshService);
    }
    return NetworkService.instance;
  }

  /**
   * 采集基础网络指标
   */
  async collectBasicMetrics(sessionId: string): Promise<NetworkBasicInfo> {
    try {
      console.time(`[NetworkService] collectBasicMetrics ${sessionId}`);
      
      // 使用轻量级命令获取基础网络数据
      const result = await this.sshService.executeCommandDirect(
        sessionId,
        "cat /proc/net/dev | grep -v 'lo:' | tail -n +3"
      );
      
      let totalRxSpeed = 0;
      let totalTxSpeed = 0;
      let totalRx = 0;
      let totalTx = 0;
      const now = Date.now();

      const lines = result.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;

        const [iface, data] = line.split(':');
        if (!data) continue;

        const stats = data.trim().split(/\s+/);
        const rx = parseInt(stats[0], 10);  // 接收字节
        const tx = parseInt(stats[8], 10);  // 发送字节

        totalRx += rx;
        totalTx += tx;

        // 计算速度
        if (this.previousStats[iface]) {
          const timeDiff = (now - this.previousStats[iface].timestamp) / 1000; // 转换为秒
          const rxDiff = rx - this.previousStats[iface].rx;
          const txDiff = tx - this.previousStats[iface].tx;
          
          if (timeDiff > 0) {
            totalRxSpeed += rxDiff / timeDiff;
            totalTxSpeed += txDiff / timeDiff;
          }
        }

        // 更新历史数据
        this.previousStats[iface] = { rx, tx, timestamp: now };
      }

      console.timeEnd(`[NetworkService] collectBasicMetrics ${sessionId}`);
      return {
        totalRx,
        totalTx,
        rxSpeed: Math.max(0, totalRxSpeed),
        txSpeed: Math.max(0, totalTxSpeed)
      };
    } catch (error) {
      console.error('采集网络基础指标失败:', error);
      return {
        totalRx: 0,
        totalTx: 0,
        rxSpeed: 0,
        txSpeed: 0
      };
    }
  }

  /**
   * 采集详细网络指标
   */
  async collectDetailMetrics(
    sessionId: string,
    activeDetailTab?: string
  ): Promise<NetworkDetailInfo> {
    try {
      console.time(`[NetworkService] collectDetailMetrics ${sessionId}`);
      
      // 获取上一次的数据
      const lastData = this.lastNetworkDetailData.get(sessionId) || {
        totalRx: 0,
        totalTx: 0,
        rxSpeed: 0,
        txSpeed: 0,
        interfaces: [],
        connections: {
          total: 0,
          tcp: 0,
          udp: 0,
          listening: 0,
          list: [],
          isToolInstalled: false
        },
        processes: {
          isToolInstalled: false,
          list: []
        },
        history: []
      };

      // 根据标签页决定需要采集的数据
      const needsBasicInfo = activeDetailTab === 'basic';
      const needsConnections = activeDetailTab === 'connections';
      const needsProcesses = activeDetailTab === 'processes';

      // 并行请求所需数据
      const [
        interfaces,
        connections,
        processes
      ] = await Promise.all([
        // 基础信息和接口信息共用 getInterfaceInfo
        needsBasicInfo 
          ? this.networkInterfaceService.getInterfaceInfo(sessionId)
          : Promise.resolve(lastData.interfaces),
        // 连接分析
        needsConnections 
          ? this.networkConnectionService.getConnectionInfo(sessionId)
          : Promise.resolve(lastData.connections),
        // 进程监控
        needsProcesses 
          ? this.networkProcessService.getProcessInfo(sessionId)
          : Promise.resolve(lastData.processes)
      ]);

      // 计算总速度
      const totalRxSpeed = interfaces.reduce((sum, iface) => sum + iface.rxSpeed, 0);
      const totalTxSpeed = interfaces.reduce((sum, iface) => sum + iface.txSpeed, 0);
      const totalRx = interfaces.reduce((sum, iface) => sum + iface.rx, 0);
      const totalTx = interfaces.reduce((sum, iface) => sum + iface.tx, 0);

      // 更新历史数据
      const now = Date.now();
      const history = [...lastData.history];
      if (needsBasicInfo) {
        history.push({
          timestamp: now,
          rxSpeed: totalRxSpeed,
          txSpeed: totalTxSpeed
        });

        // 保持最近60个数据点
        if (history.length > 60) {
          history.shift();
        }
      }

      // 合并结果，保留未更新的数据
      const result = {
        totalRx,
        totalTx,
        rxSpeed: totalRxSpeed,
        txSpeed: totalTxSpeed,
        interfaces: needsBasicInfo ? interfaces : lastData.interfaces,
        connections: needsConnections ? connections : lastData.connections,
        processes: needsProcesses ? processes : lastData.processes,
        history
      };

      // 保存本次数据
      this.lastNetworkDetailData.set(sessionId, result);

      console.timeEnd(`[NetworkService] collectDetailMetrics ${sessionId}`);
      return result;
    } catch (error) {
      console.error('采集网络详细指标失败:', error);
      return this.lastNetworkDetailData.get(sessionId) || {
        totalRx: 0,
        totalTx: 0,
        rxSpeed: 0,
        txSpeed: 0,
        interfaces: [],
        connections: {
          total: 0,
          tcp: 0,
          udp: 0,
          listening: 0,
          list: [],
          isToolInstalled: false
        },
        processes: {
          isToolInstalled: false,
          list: []
        },
        history: []
      };
    }
  }

  /**
   * 销毁服务实例
   */
  destroy(): void {
    this.networkInterfaceService.destroy();
    this.networkConnectionService.destroy();
    this.networkProcessService.destroy();
    this.previousStats = {};
    this.lastNetworkDetailData.clear();
    NetworkService.instance = null as any;
  }
} 