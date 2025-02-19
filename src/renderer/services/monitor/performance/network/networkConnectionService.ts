import { SSHService } from '../../../../types';
import { NetworkDetailInfo } from '../../../../types/monitor/monitor';

/**
 * 网络连接监控服务
 */
export class NetworkConnectionService {
  private static instance: NetworkConnectionService;
  private sshService: SSHService;
  private isToolInstalled: boolean | null = null;

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
   * 检查必要工具是否已安装
   */
  private async checkTools(sessionId: string): Promise<boolean> {
    if (this.isToolInstalled !== null) {
      return this.isToolInstalled;
    }

    try {
      // 检查 lsof 是否安装
      const lsofCheck = await this.sshService.executeCommandDirect(
        sessionId,
        'which lsof >/dev/null 2>&1 && echo "yes" || echo "no"'
      );
      this.isToolInstalled = lsofCheck.trim() === 'yes';
      return this.isToolInstalled;
    } catch (error) {
      console.error('检查工具安装状态失败:', error);
      return false;
    }
  }

  /**
   * 获取连接信息
   */
  async getConnectionInfo(sessionId: string): Promise<NetworkDetailInfo['connections']> {
    try {
      console.time(`[NetworkConnectionService] getConnectionInfo ${sessionId}`);

      // 检查工具是否安装
      const isInstalled = await this.checkTools(sessionId);
      if (!isInstalled) {
        return {
          total: 0,
          tcp: 0,
          udp: 0,
          listening: 0,
          list: [],
          isToolInstalled: false
        };
      }

      // 使用 lsof 获取网络连接信息
      const cmd = `
        # 获取TCP连接
        echo "=== TCP ==="
        lsof -i TCP -n -P 2>/dev/null;
        
        # 获取UDP连接
        echo "=== UDP ==="
        lsof -i UDP -n -P 2>/dev/null;
      `;

      const output = await this.sshService.executeCommandDirect(sessionId, cmd);
      console.log('[NetworkConnectionService] 命令输出:', output);
      const [tcpSection, udpSection] = output.split('=== UDP ===');

      // 初始化结果
      const result: NetworkDetailInfo['connections'] = {
        total: 0,
        tcp: 0,
        udp: 0,
        listening: 0,
        list: [],
        isToolInstalled: true
      };

      // 解析TCP连接
      const tcpConnections = this.parseConnections(tcpSection, 'TCP');
      result.tcp = tcpConnections.length;
      result.list.push(...tcpConnections);

      // 解析UDP连接
      const udpConnections = this.parseConnections(udpSection, 'UDP');
      result.udp = udpConnections.length;
      result.list.push(...udpConnections);

      // 计算总数和监听数
      result.total = result.tcp + result.udp;
      result.listening = result.list.filter(conn => conn.state === 'LISTEN').length;

      console.timeEnd(`[NetworkConnectionService] getConnectionInfo ${sessionId}`);
      return result;
    } catch (error) {
      console.error('[NetworkConnectionService] 获取连接信息失败:', error);
      return {
        total: 0,
        tcp: 0,
        udp: 0,
        listening: 0,
        list: [],
        isToolInstalled: false
      };
    }
  }

  /**
   * 解析连接信息
   */
  private parseConnections(output: string, protocol: 'TCP' | 'UDP'): NetworkDetailInfo['connections']['list'] {
    const connections: NetworkDetailInfo['connections']['list'] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      if (!line.trim() || line.startsWith('COMMAND')) continue;

      try {
        // 使用正则表达式匹配 NAME 字段中的连接信息
        const nameMatch = line.match(/(\S+)\s+(\d+)\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+(.*)/);
        if (!nameMatch) continue;

        const [, command, pidStr, connectionInfo] = nameMatch;
        
        // 解析连接状态
        const stateMatch = connectionInfo.match(/\((.*?)\)$/);
        const state = stateMatch ? stateMatch[1] : protocol === 'UDP' ? '-' : 'ESTABLISHED';

        // 解析地址信息
        const addressInfo = connectionInfo.replace(/\s*\([^)]+\)\s*$/, '').trim();
        const [local, remote] = addressInfo.split('->').map(addr => addr.trim());

        if (!local) continue;

        // 解析本地地址
        const [localAddr, localPortStr] = this.parseAddress(local);
        const localPort = parseInt(localPortStr, 10);
        if (isNaN(localPort)) continue;

        // 解析远程地址
        let remoteAddr = '*';
        let remotePort = 0;

        if (remote) {
          const [remoteAddrParsed, remotePortStr] = this.parseAddress(remote);
          remoteAddr = remoteAddrParsed;
          remotePort = parseInt(remotePortStr || '0', 10);
        }

        // 确定连接类型
        let type: '内网' | '外网' | '监听';
        if (state === 'LISTEN') {
          type = '监听';
        } else if (this.isInternalIP(remoteAddr)) {
          type = '内网';
        } else {
          type = '外网';
        }

        const pid = parseInt(pidStr, 10);
        if (isNaN(pid)) continue;

        connections.push({
          protocol,
          localAddress: localAddr,
          localPort,
          remoteAddress: remoteAddr,
          remotePort,
          state,
          type,
          process: command,
          pid
        });
      } catch (error) {
        console.error('[NetworkConnectionService] 解析连接信息失败:', error, line);
        continue;
      }
    }

    return connections;
  }

  /**
   * 解析地址和端口
   */
  private parseAddress(addr: string): [string, string] {
    // 处理 IPv4 和 IPv6 地址
    const ipv4Match = addr.match(/([0-9.]+):([0-9]+)/);
    if (ipv4Match) {
      return [ipv4Match[1], ipv4Match[2]];
    }

    const ipv6Match = addr.match(/\[([0-9a-fA-F:]+)\]:([0-9]+)/);
    if (ipv6Match) {
      return [ipv6Match[1], ipv6Match[2]];
    }

    return [addr, '0'];
  }

  /**
   * 判断是否为内网IP
   */
  private isInternalIP(ip: string): boolean {
    if (ip === '*' || ip === 'localhost' || ip === '127.0.0.1') return true;
    
    const parts = ip.split('.');
    if (parts.length !== 4) return false;

    return (
      parts[0] === '10' ||
      (parts[0] === '172' && parseInt(parts[1], 10) >= 16 && parseInt(parts[1], 10) <= 31) ||
      (parts[0] === '192' && parts[1] === '168')
    );
  }

  /**
   * 销毁服务实例
   */
  destroy(): void {
    this.isToolInstalled = null;
    NetworkConnectionService.instance = null as any;
  }
} 