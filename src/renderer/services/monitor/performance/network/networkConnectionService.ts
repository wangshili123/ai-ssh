import { SSHService } from '../../../../types';
import { NetworkDetailInfo } from '../../../../types/monitor';

/**
 * 网络连接监控服务
 */
export class NetworkConnectionService {
  private static instance: NetworkConnectionService;
  private sshService: SSHService;

  private constructor(sshService: SSHService) {
    this.sshService = sshService;
  }

  static getInstance(sshService: SSHService): NetworkConnectionService {
    if (!NetworkConnectionService.instance) {
      NetworkConnectionService.instance = new NetworkConnectionService(sshService);
    }
    return NetworkConnectionService.instance;
  }

  /**
   * 获取连接信息
   */
  async getConnectionInfo(sessionId: string): Promise<NetworkDetailInfo['connections']> {
    try {
      console.time(`[NetworkConnectionService] getConnectionInfo ${sessionId}`);
      
      // 获取连接统计和监听端口数
      const [ssStats, listenPorts] = await Promise.all([
        this.sshService.executeCommandDirect(sessionId, 'ss -s'),
        this.sshService.executeCommandDirect(sessionId, 'ss -l | grep -v "^Netid" | wc -l')
      ]);

      // 解析连接统计
      const connectionStats = this.parseConnectionStats(ssStats, parseInt(listenPorts.trim(), 10));
      
      // 解析连接列表
      const connectionList = this.parseConnectionList(await this.sshService.executeCommandDirect(sessionId, 'ss -tupn state established'));

      // 合并结果
      const result = {
        ...connectionStats,
        list: connectionList
      };

      console.timeEnd(`[NetworkConnectionService] getConnectionInfo ${sessionId}`);
      return result;
    } catch (error) {
      console.error('获取连接信息失败:', error);
      return {
        total: 0,
        tcp: 0,
        udp: 0,
        listening: 0,
        list: []
      };
    }
  }

  /**
   * 解析连接统计信息
   */
  private parseConnectionStats(ssStats: string, listenPorts: number): NetworkDetailInfo['connections'] {
    const connections = {
      total: 0,
      tcp: 0,
      udp: 0,
      listening: listenPorts,
      list: []
    };
    
    try {
      // 解析表格中的连接数
      const lines = ssStats.split('\n');
      for (const line of lines) {
        if (line.startsWith('TCP')) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 2) {
            connections.tcp = parseInt(parts[1], 10);
          }
        } else if (line.startsWith('UDP')) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 2) {
            connections.udp = parseInt(parts[1], 10);
          }
        }
      }

      // 计算总连接数
      connections.total = connections.tcp + connections.udp;
    } catch (error) {
      console.error('解析连接统计信息失败:', error);
    }

    return connections;
  }

  /**
   * 解析详细连接列表
   */
  private parseConnectionList(ssOutput: string): NetworkDetailInfo['connections']['list'] {
    const connections: NetworkDetailInfo['connections']['list'] = [];
    const lines = ssOutput.split('\n');

    // 跳过标题行
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const parts = line.split(/\s+/);
        if (parts.length < 5) continue;

        const [state, recvQ, sendQ, localAddr, remoteAddr, process] = parts;
        
        // 解析本地地址
        const [localAddress, localPort] = localAddr.split(':');
        
        // 解析远程地址
        const [remoteAddress, remotePort] = remoteAddr.split(':');

        // 解析进程信息
        let pid: number | undefined;
        let processName: string | undefined;
        if (process && process !== '-') {
          const processMatch = process.match(/users:\(\("([^"]+)",pid=(\d+)/);
          if (processMatch) {
            processName = processMatch[1];
            pid = parseInt(processMatch[2], 10);
          }
        }

        connections.push({
          protocol: 'TCP', // 根据实际情况判断
          localAddress,
          localPort: parseInt(localPort, 10),
          remoteAddress,
          remotePort: parseInt(remotePort, 10) || 0,
          state,
          pid,
          process: processName
        });
      } catch (error) {
        console.error('解析连接行失败:', error, line);
      }
    }

    return connections;
  }

  /**
   * 销毁服务实例
   */
  destroy(): void {
    NetworkConnectionService.instance = null as any;
  }
} 