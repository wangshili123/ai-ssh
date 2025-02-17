import { SSHService } from '../../../../types';
import { NetworkDetailInfo } from '../../../../types/monitor';

/**
 * 网络进程监控服务
 */
export class NetworkProcessService {
  private static instance: NetworkProcessService;
  private sshService: SSHService;
  private previousStats: { [pid: number]: { rx: number; tx: number; timestamp: number } } = {};

  private constructor(sshService: SSHService) {
    this.sshService = sshService;
  }

  static getInstance(sshService: SSHService): NetworkProcessService {
    if (!NetworkProcessService.instance) {
      NetworkProcessService.instance = new NetworkProcessService(sshService);
    }
    return NetworkProcessService.instance;
  }

  /**
   * 获取进程网络使用信息
   */
  async getProcessInfo(sessionId: string): Promise<NetworkDetailInfo['processes']> {
    try {
      console.time(`[NetworkProcessService] getProcessInfo ${sessionId}`);

      // 检查 nethogs 是否安装
      const checkResult = await this.sshService.executeCommandDirect(
        sessionId,
        'which nethogs'
      );

      if (!checkResult.trim()) {
        console.warn('nethogs 未安装');
        return [];
      }

      // 使用 nethogs 获取进程网络使用情况
      // -t 参数输出文本格式，-c 1 只刷新一次
      const nethogsOutput = await this.sshService.executeCommandDirect(
        sessionId,
        'sudo nethogs -t -c 1'
      );

      // 解析进程信息
      const processes = this.parseProcessInfo(nethogsOutput);

      // 获取进程的连接数
      const ssOutput = await this.sshService.executeCommandDirect(
        sessionId,
        'ss -tupn'
      );

      // 统计每个进程的连接数
      const connectionCounts = new Map<number, number>();
      ssOutput.split('\n').forEach(line => {
        const pidMatch = line.match(/pid=(\d+)/);
        if (pidMatch) {
          const pid = parseInt(pidMatch[1], 10);
          connectionCounts.set(pid, (connectionCounts.get(pid) || 0) + 1);
        }
      });

      // 更新进程的连接数
      processes.forEach(proc => {
        proc.connections = connectionCounts.get(proc.pid) || 0;
      });

      console.timeEnd(`[NetworkProcessService] getProcessInfo ${sessionId}`);
      return processes;
    } catch (error) {
      console.error('获取进程网络使用信息失败:', error);
      return [];
    }
  }

  /**
   * 解析进程网络使用信息
   */
  private parseProcessInfo(nethogsOutput: string): NetworkDetailInfo['processes'] {
    const processes: NetworkDetailInfo['processes'] = [];
    const now = Date.now();
    const lines = nethogsOutput.split('\n');

    // 跳过标题行
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('Refreshing')) continue;

      try {
        const parts = line.split(/\s+/);
        if (parts.length < 4) continue;

        const [pid, program, sent, received] = parts;
        const pidNum = parseInt(pid, 10);
        if (isNaN(pidNum)) continue;

        // 解析发送和接收的字节数（nethogs输出的是KB/s）
        const tx = parseFloat(sent) * 1024;
        const rx = parseFloat(received) * 1024;

        // 计算总流量
        let totalBytes = 0;
        if (this.previousStats[pidNum]) {
          const timeDiff = (now - this.previousStats[pidNum].timestamp) / 1000;
          if (timeDiff > 0) {
            totalBytes = (this.previousStats[pidNum].rx + this.previousStats[pidNum].tx) * timeDiff;
          }
        }

        // 更新历史数据
        this.previousStats[pidNum] = {
          rx,
          tx,
          timestamp: now
        };

        processes.push({
          pid: pidNum,
          name: program.split('/').pop() || program,
          command: program,
          rxSpeed: rx,
          txSpeed: tx,
          totalBytes,
          connections: 0 // 连接数将在后续更新
        });
      } catch (error) {
        console.error('解析进程网络使用行失败:', error, line);
      }
    }

    return processes;
  }

  /**
   * 销毁服务实例
   */
  destroy(): void {
    this.previousStats = {};
    NetworkProcessService.instance = null as any;
  }
} 