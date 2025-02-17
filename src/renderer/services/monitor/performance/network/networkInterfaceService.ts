import { SSHService } from '../../../../types';
import { NetworkDetailInfo } from '../../../../types/monitor';

/**
 * 网络接口监控服务
 */
export class NetworkInterfaceService {
  private static instance: NetworkInterfaceService;
  private sshService: SSHService;
  private previousStats: { [key: string]: { rx: number; tx: number; timestamp: number } } = {};

  private constructor(sshService: SSHService) {
    this.sshService = sshService;
  }

  static getInstance(sshService: SSHService): NetworkInterfaceService {
    if (!NetworkInterfaceService.instance) {
      NetworkInterfaceService.instance = new NetworkInterfaceService(sshService);
    }
    return NetworkInterfaceService.instance;
  }

  /**
   * 获取网络接口信息
   */
  async getInterfaceInfo(sessionId: string): Promise<Array<NetworkDetailInfo['interfaces'][0]>> {
    try {
      console.time(`[NetworkInterfaceService] getInterfaceInfo ${sessionId}`);
      
      // 使用合并命令获取接口信息
      const interfaceInfo = await this.sshService.executeCommandDirect(
        sessionId,
        'ip -s link && echo "---SPLIT---" && ip -s addr'
      );

      // 分割接口信息
      const [ipLink, ipAddr] = interfaceInfo.split('---SPLIT---');

      // 解析接口信息
      const interfaces = this.parseInterfaceInfo(ipLink, ipAddr);

      console.timeEnd(`[NetworkInterfaceService] getInterfaceInfo ${sessionId}`);
      return interfaces;
    } catch (error) {
      console.error('获取网络接口信息失败:', error);
      return [];
    }
  }

  /**
   * 解析网络接口信息
   */
  private parseInterfaceInfo(ipLink: string, ipAddr: string): Array<NetworkDetailInfo['interfaces'][0]> {
    const interfaces: Array<NetworkDetailInfo['interfaces'][0]> = [];
    const now = Date.now();

    // 规范化换行符
    const normalizedIpLink = ipLink.replace(/\r\n/g, '\n');
    
    // 使用正则表达式分割数据块
    const linkBlocks = normalizedIpLink.split(/(?=^\d+:)/m).filter(block => block.trim());
    
    console.log('数据块数量:', linkBlocks.length);
    
    for (const block of linkBlocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 1) {
        console.log('跳过空数据块');
        continue;
      }

      // 解析接口基本信息
      const firstLine = lines[0].trim();
      const match = firstLine.match(/^\d+:\s*([\w\-]+)(?:@[\w\-]+)?:?\s*<(.+)>/);
      if (!match) {
        console.log('无法匹配接口行:', firstLine);
        continue;
      }

      const name = match[1].trim();
      const flags = match[2].split(',').map(f => f.trim());
      
      // 忽略 lo 接口
      if (name === 'lo') {
        console.log('跳过lo接口');
        continue;
      }

      // 解析 MAC 地址
      const macLine = lines.find(line => line.includes('link/ether'));
      const mac = macLine ? macLine.split(/\s+/)[1].trim() : '';

      // 解析 MTU
      const mtuMatch = firstLine.match(/mtu\s+(\d+)/);
      const mtu = mtuMatch ? parseInt(mtuMatch[1], 10) : 0;

      // 解析统计信息
      let rx = 0, tx = 0, rxErrors = 0, txErrors = 0;
      const statsStartIndex = lines.findIndex(line => line.includes('RX:'));
      if (statsStartIndex > 0 && lines.length > statsStartIndex + 3) {
        try {
          // RX 统计
          const rxStats = lines[statsStartIndex + 1].trim().split(/\s+/);
          rx = parseInt(rxStats[0], 10);
          rxErrors = parseInt(rxStats[2], 10);

          // TX 统计
          const txStats = lines[statsStartIndex + 3].trim().split(/\s+/);
          tx = parseInt(txStats[0], 10);
          txErrors = parseInt(txStats[2], 10);
        } catch (error) {
          console.error('解析流量统计失败:', error);
        }
      }

      // 计算速度
      let rxSpeed = 0, txSpeed = 0;
      if (this.previousStats[name]) {
        const timeDiff = (now - this.previousStats[name].timestamp) / 1000;
        const rxDiff = rx - this.previousStats[name].rx;
        const txDiff = tx - this.previousStats[name].tx;
        
        if (timeDiff > 0) {
          rxSpeed = rxDiff / timeDiff;
          txSpeed = txDiff / timeDiff;
        }
      }

      // 更新历史数据
      this.previousStats[name] = { rx, tx, timestamp: now };

      // 创建接口对象
      const iface: NetworkDetailInfo['interfaces'][0] = {
        name,
        status: flags.includes('UP') ? 'UP' : 'DOWN',
        ipv4: [],
        ipv6: [],
        mac,
        mtu,
        rx,
        tx,
        rxSpeed: Math.max(0, rxSpeed),
        txSpeed: Math.max(0, txSpeed),
        errors: {
          rx: rxErrors,
          tx: txErrors
        }
      };

      interfaces.push(iface);
    }

    // 规范化换行符
    const normalizedIpAddr = ipAddr.replace(/\r\n/g, '\n');
    
    // 使用相同的分割逻辑处理IP地址数据
    const addrBlocks = normalizedIpAddr.split(/(?=^\d+:)/m).filter(block => block.trim());

    for (const block of addrBlocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 1) continue;

      // 获取接口名
      const firstLine = lines[0].trim();
      const nameMatch = firstLine.match(/^\d+:\s*([\w\-]+)(?:@[\w\-]+)?:?/);
      if (!nameMatch) continue;

      const name = nameMatch[1].trim();
      const iface = interfaces.find(i => i.name === name);
      if (!iface || name === 'lo') continue;

      // 解析 IP 地址
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.includes('inet ') && !trimmedLine.includes('inet6')) {
          const ipv4Match = trimmedLine.match(/inet\s+([^\/\s]+)/);
          if (ipv4Match && !ipv4Match[1].startsWith('127.')) {
            iface.ipv4.push(ipv4Match[1]);
          }
        } else if (trimmedLine.includes('inet6 ')) {
          const ipv6Match = trimmedLine.match(/inet6\s+([^\/\s]+)/);
          if (ipv6Match && !ipv6Match[1].startsWith('::1')) {
            iface.ipv6.push(ipv6Match[1]);
          }
        }
      }
    }

    return interfaces;
  }

  /**
   * 销毁服务实例
   */
  destroy(): void {
    this.previousStats = {};
    NetworkInterfaceService.instance = null as any;
  }
} 