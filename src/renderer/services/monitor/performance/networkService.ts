import { SSHService } from '../../../types';
import { NetworkBasicInfo, NetworkDetailInfo } from '../../../types/monitor';

/**
 * 网络监控服务
 */
export class NetworkService {
  private static instance: NetworkService;
  private sshService: SSHService;
  private previousStats: { [key: string]: { rx: number; tx: number; timestamp: number } } = {};
  private lastNetworkDetailData: Map<string, NetworkDetailInfo> = new Map();

  private constructor(sshService: SSHService) {
    this.sshService = sshService;
  }

  static getInstance(sshService: SSHService): NetworkService {
    if (!NetworkService.instance) {
      NetworkService.instance = new NetworkService(sshService);
    }
    return NetworkService.instance;
  }

  /**
   * 解析网络接口信息
   */
  private parseInterfaceInfo(ipLink: string, ipAddr: string): Array<NetworkDetailInfo['interfaces'][0]> {
    const interfaces: Array<NetworkDetailInfo['interfaces'][0]> = [];
    const now = Date.now();

    // 解析 ip -s link 输出
    const linkBlocks = ipLink.split('\n\n');
    for (const block of linkBlocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 1) continue;

      // 解析接口基本信息
      const firstLine = lines[0];
      const match = firstLine.match(/^\d+:\s+([^:@]+)(?:@\S+)?:\s+<(.+)>/);
      if (!match) continue;

      const name = match[1].trim();
      const flags = match[2].split(',');
      
      // 忽略 lo 接口
      if (name === 'lo') continue;

      // 解析 MAC 地址
      const macLine = lines.find(line => line.includes('link/ether'));
      const mac = macLine ? macLine.split(/\s+/)[1] : '';

      // 解析 MTU
      const mtuMatch = firstLine.match(/mtu\s+(\d+)/);
      const mtu = mtuMatch ? parseInt(mtuMatch[1], 10) : 0;

      // 解析统计信息
      let rx = 0, tx = 0, rxErrors = 0, txErrors = 0;
      const statsStartIndex = lines.findIndex(line => line.includes('RX:'));
      if (statsStartIndex > 0 && lines.length > statsStartIndex + 3) {
        // RX 统计
        const rxStats = lines[statsStartIndex + 1].trim().split(/\s+/);
        rx = parseInt(rxStats[0], 10);
        rxErrors = parseInt(rxStats[2], 10);

        // TX 统计
        const txStats = lines[statsStartIndex + 3].trim().split(/\s+/);
        tx = parseInt(txStats[0], 10);
        txErrors = parseInt(txStats[2], 10);
      }

      // 计算速度
      let rxSpeed = 0, txSpeed = 0;
      if (this.previousStats[name]) {
        const timeDiff = (now - this.previousStats[name].timestamp) / 1000;
        const rxDiff = rx - this.previousStats[name].rx;
        const txDiff = tx - this.previousStats[name].tx;
        
        rxSpeed = rxDiff / timeDiff;
        txSpeed = txDiff / timeDiff;
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

    // 解析 ip -s addr 输出，添加 IP 地址信息
    const addrBlocks = ipAddr.split('\n\n');
    for (const block of addrBlocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 1) continue;

      // 获取接口名
      const firstLine = lines[0];
      const nameMatch = firstLine.match(/^\d+:\s+([^:@]+)(?:@\S+)?:/);
      if (!nameMatch) continue;

      const name = nameMatch[1].trim();
      const iface = interfaces.find(i => i.name === name);
      if (!iface) continue;

      // 解析 IP 地址
      for (const line of lines) {
        if (line.includes('inet ')) {
          const ipv4Match = line.match(/inet\s+([^\/\s]+)/);
          if (ipv4Match) {
            iface.ipv4.push(ipv4Match[1]);
          }
        } else if (line.includes('inet6 ')) {
          const ipv6Match = line.match(/inet6\s+([^\/\s]+)/);
          if (ipv6Match) {
            iface.ipv6.push(ipv6Match[1]);
          }
        }
      }
    }

    return interfaces;
  }

  /**
   * 采集基础网络指标
   */
  async collectBasicMetrics(sessionId: string): Promise<NetworkBasicInfo> {
    try {
      console.time(`[NetworkService] collectBasicMetrics ${sessionId}`);
      // 优化命令：只获取活跃接口的当前数据
      const result = await this.sshService.executeCommandDirect(
        sessionId,
        "cat /proc/net/dev | grep -v 'lo:' | tail -n +3"
      );
      
      let totalRxSpeed = 0;
      let totalTxSpeed = 0;
      const now = Date.now();

      const lines = result.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;

        const [iface, data] = line.split(':');
        if (!data) continue;

        const stats = data.trim().split(/\s+/);
        const rx = parseInt(stats[0], 10);  // 接收字节
        const tx = parseInt(stats[8], 10);  // 发送字节

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
        totalRx: 0,  // 不再需要总计数据
        totalTx: 0,  // 不再需要总计数据
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
  async collectDetailMetrics(sessionId: string): Promise<NetworkDetailInfo> {
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
          list: []
        },
        processes: [],
        history: []
      };

      // 获取基础指标
      const basicInfo = await this.collectBasicMetrics(sessionId);
      
      // 优化命令：合并命令减少执行次数
      const [interfaceInfo, ssStats] = await Promise.all([
        this.sshService.executeCommandDirect(
          sessionId,
          'ip -s link && echo "---SPLIT---" && ip -s addr'
        ),
        this.sshService.executeCommandDirect(
          sessionId,
          'ss -s'
        )
      ]);

      // 分割接口信息
      const [ipLink, ipAddr] = interfaceInfo.split('---SPLIT---');

      // 解析网络接口信息
      const interfaces = this.parseInterfaceInfo(ipLink, ipAddr);

      // 更新历史数据
      const now = Date.now();
      const history = [...lastData.history];
      history.push({
        timestamp: now,
        rxSpeed: basicInfo.rxSpeed,
        txSpeed: basicInfo.txSpeed
      });

      // 保持最近60个数据点
      if (history.length > 60) {
        history.shift();
      }

      const result = {
        ...basicInfo,
        interfaces,
        connections: {
          total: 0,
          tcp: 0,
          udp: 0,
          listening: 0,
          list: []
        },
        processes: [],
        history
      };

      // 保存本次数据用于下次缓存
      this.lastNetworkDetailData.set(sessionId, result);

      console.timeEnd(`[NetworkService] collectDetailMetrics ${sessionId}`);
      return result;
    } catch (error) {
      console.error('采集网络详细指标失败:', error);
      return {
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
          list: []
        },
        processes: [],
        history: []
      };
    }
  }

  /**
   * 销毁服务实例
   */
  destroy(): void {
    this.previousStats = {};
    this.lastNetworkDetailData.clear();
    NetworkService.instance = null as any;
  }
} 