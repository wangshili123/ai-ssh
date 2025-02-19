import { SSHService } from '../../../../types';
import { NetworkDetailInfo, NetworkProcess } from '../../../../types/monitor/monitor';

/**
 * 网络进程监控服务
 */
export class NetworkProcessService {
  private static instance: NetworkProcessService;
  private sshService: SSHService;
  private isToolInstalled: boolean | null = null;

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
   * 检查必要工具是否已安装
   */
  private async checkTools(sessionId: string): Promise<boolean> {
    if (this.isToolInstalled !== null && this.isToolInstalled) {
      return this.isToolInstalled;
    }

    try {
      const nethogsCheck = await this.sshService.executeCommandDirect(
        sessionId, 
        'which nethogs >/dev/null 2>&1 && echo "yes" || echo "no"'
      );
      this.isToolInstalled = nethogsCheck.trim() === 'yes';
      return this.isToolInstalled;
    } catch (error) {
      console.error('检查工具安装状态失败:', error);
      return false;
    }
  }

  /**
   * 获取进程网络使用信息
   */
  async getProcessInfo(sessionId: string): Promise<NetworkDetailInfo['processes']> {
    try {
      console.time(`[NetworkProcessService] getProcessInfo ${sessionId}`);

      // 检查工具是否安装
      const isInstalled = await this.checkTools(sessionId);
      if (!isInstalled) {
        return {
          isToolInstalled: false,
          list: []
        };
      }

      // 获取所有网络接口（除lo外）并运行nethogs
      const cmd = `
        # 获取所有网络接口（除lo外）
        interfaces=$(ip -o link show | awk -F': ' '$2 != "lo" {print $2}' | tr '\\n' ' ')
        
        # 使用sudo运行nethogs，每秒更新一次
        sudo nethogs -t -d 1 $interfaces 2>/dev/null | head -n 20`;

      console.log('[NetworkProcessService] 开始获取进程网络信息');
      const output = await this.sshService.executeCommandDirect(sessionId, cmd);
      console.log('[NetworkProcessService] 命令输出:', output);

      // 解析输出
      const processes = new Map<number, NetworkProcess>();

      output.split('\n').forEach(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return;

        // 跳过刷新标记和unknown
        if (trimmedLine.startsWith('Refreshing:') || trimmedLine.startsWith('unknown')) return;

        // 解析行数据
        const parts = trimmedLine.split('\t');
        if (parts.length < 3) return;

        // 解析进程信息
        const processInfo = parts[0];
        const txSpeed = parseFloat(parts[1]); // 发送速度 KB/s
        const rxSpeed = parseFloat(parts[2]); // 接收速度 KB/s

        // 提取PID和进程名 - 格式: 路径/PID/线程ID 或 进程名: 描述/PID/线程ID
        const pidMatch = processInfo.match(/.*?(\d+)\/\d+$/);
        if (!pidMatch) return;

        const pid = parseInt(pidMatch[1], 10);
        
        // 提取进程名和命令
        let name = 'unknown';  // 设置默认值
        let command: string;

        if (processInfo.includes(': ')) {
          // 处理类似 "sshd: root@pts/1" 这样的格式
          const [procName] = processInfo.split(': ');
          name = procName;
          command = processInfo.split('/')[0]; // 保留描述部分
        } else {
          // 处理标准路径格式
          const parts = processInfo.split('/').filter(Boolean);
          // 找到最后一个非数字的部分作为进程名
          for (let i = parts.length - 1; i >= 0; i--) {
            if (!/^\d+$/.test(parts[i])) {
              name = parts[i];
              break;
            }
          }
          // 命令是PID之前的完整路径
          command = processInfo.split('/').slice(0, -2).join('/');
          if (command.startsWith('./')) {
            command = command.substring(2);
          }
        }
        
        // 只处理有效的数据
        if (pid && !isNaN(rxSpeed) && !isNaN(txSpeed)) {
          // 如果进程已存在，更新数据
          const existingProcess = processes.get(pid);
          if (existingProcess) {
            existingProcess.rxSpeed = Math.max(existingProcess.rxSpeed, rxSpeed * 1024);
            existingProcess.txSpeed = Math.max(existingProcess.txSpeed, txSpeed * 1024);
            existingProcess.totalBytes += (rxSpeed + txSpeed) * 1024;
          } else {
            // 创建新的进程记录
            processes.set(pid, {
              pid,
              name,
              command,
              rxSpeed: rxSpeed * 1024, // 转换为bytes/s
              txSpeed: txSpeed * 1024, // 转换为bytes/s
              totalBytes: (rxSpeed + txSpeed) * 1024, // 转换为bytes
              connections: 0 // 不再统计连接数
            });
          }
        }
      });

      const result = {
        isToolInstalled: true,
        list: Array.from(processes.values())
          .sort((a, b) => (b.rxSpeed + b.txSpeed) - (a.rxSpeed + a.txSpeed))
      };

      console.log('[NetworkProcessService] 解析结果:', {
        processCount: result.list.length,
        hasTraffic: result.list.some(p => p.rxSpeed > 0 || p.txSpeed > 0),
        processes: result.list
      });

      console.timeEnd(`[NetworkProcessService] getProcessInfo ${sessionId}`);
      return result;
    } catch (error) {
      console.error('[NetworkProcessService] 获取进程网络使用信息失败:', error);
      return {
        isToolInstalled: false,
        list: []
      };
    }
  }

  /**
   * 获取指定进程的详细网络信息
   */
  async getProcessDetail(sessionId: string, pid: number): Promise<{
    connections: Array<{
      protocol: string;
      localAddr: string;
      remoteAddr: string;
      state: string;
      type: string;
    }>;
    cmdline: string;
  }> {
    try {
      // 使用单个命令获取所需信息
      const cmd = `
        # 获取命令行和连接信息
        {
          echo "=== CMDLINE ===";
          cat /proc/${pid}/cmdline 2>/dev/null | tr '\\0' ' ';
          echo -e "\\n=== CONNECTIONS ===";
          ss -tnp | grep "pid=${pid}," | awk '{
            protocol="TCP";
            state=$1;
            local=$4;
            remote=$5;
            
            # 判断连接类型
            type="外网";
            if (remote ~ /^127\\./ || remote ~ /^192\\.168\\./ || remote ~ /^10\\./ || remote ~ /^172\\.(1[6-9]|2[0-9]|3[0-1])\\./) {
              type="内网";
            }
            
            printf "%s\\t%s\\t%s\\t%s\\t%s\\n", protocol, local, remote, state, type;
          }';
          ss -unp | grep "pid=${pid}," | awk '{
            protocol="UDP";
            state="-";
            local=$4;
            remote=$5;
            
            # 判断连接类型
            type="外网";
            if (remote ~ /^127\\./ || remote ~ /^192\\.168\\./ || remote ~ /^10\\./ || remote ~ /^172\\.(1[6-9]|2[0-9]|3[0-1])\\./) {
              type="内网";
            }
            
            printf "%s\\t%s\\t%s\\t%s\\t%s\\n", protocol, local, remote, state, type;
          }';
        }
      `;

      const output = await this.sshService.executeCommandDirect(sessionId, cmd);
      const sections = output.split('=== ');
      
      // 解析命令行
      const cmdlineSection = sections.find(s => s.startsWith('CMDLINE ==='));
      const cmdline = cmdlineSection ? cmdlineSection.split('===')[1].trim() : '';

      // 解析连接信息
      const connectionsSection = sections.find(s => s.startsWith('CONNECTIONS ==='));
      const connections = connectionsSection 
        ? connectionsSection
            .split('===')[1]
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
              const [protocol, localAddr, remoteAddr, state, type] = line.split('\t');
              return { protocol, localAddr, remoteAddr, state, type };
            })
        : [];

      return {
        connections,
        cmdline
      };
    } catch (error) {
      console.error(`[NetworkProcessService] 获取进程 ${pid} 详情失败:`, error);
      return {
        connections: [],
        cmdline: ''
      };
    }
  }

  /**
   * 销毁服务实例
   */
  destroy(): void {
    NetworkProcessService.instance = null as any;
  }
} 