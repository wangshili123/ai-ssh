import { SSHService } from '../../../../types';
import { NetworkDetailInfo, NetworkProcess } from '../../../../types/monitor';

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

      // 1. 获取进程连接信息和基本统计
      const processInfoCmd = `
        ss -tupn | awk '
          # 跳过标题行和本地连接
          NR>1 && !/^127\\.0\\.0\\.1|^::1/ {
            # 提取进程信息
            if(match($0, /pid=([0-9]+).*"([^"]+)".*cmd="([^"]+)"/, arr)) {
              pid=arr[1]
              name=arr[2]
              cmd=arr[3]
              # 排除本地回环和内网地址
              if ($5 !~ /^127\\.|^192\\.168\\.|^10\\.|^172\\.(1[6-9]|2[0-9]|3[0-1])\\./) {
                connections[pid]++
                if(!(pid in pids)) {
                  pids[pid]=name
                  cmds[pid]=cmd  # 保存完整命令
                }
              }
            }
          }
          END {
            # 输出结果，使用制表符分隔以处理命令中的空格
            for(pid in connections) {
              printf "%s\\t%s\\t%s\\t%d\\n", pid, pids[pid], cmds[pid], connections[pid]
            }
          }'
      `;

      const processInfo = await this.sshService.executeCommandDirect(sessionId, processInfoCmd);
      const processes = new Map<number, NetworkProcess>();
      
      // 解析进程信息（使用制表符分隔）
      processInfo.split('\n').forEach(line => {
        const [pid, name, command, connections] = line.trim().split('\t');
        if (pid) {
          processes.set(Number(pid), {
            pid: Number(pid),
            name,
            command,
            rxSpeed: 0,
            txSpeed: 0,
            totalBytes: 0,
            connections: Number(connections)
          });
        }
      });

      // 2. 获取进程网络流量统计
      const now = Date.now();
      const statsCmd = `
        for pid in \`ls -d /proc/[0-9]* 2>/dev/null\`; do
          pid=\${pid##*/}
          if [ -f "/proc/\$pid/net/dev" ]; then
            echo "=== \$pid ==="
            cat "/proc/\$pid/net/dev" 2>/dev/null | grep -v '^[[:space:]]*lo:'
          fi
        done
      `;

      const statsOutput = await this.sshService.executeCommandDirect(sessionId, statsCmd);
      let currentPid: number | null = null;

      // 解析网络统计
      statsOutput.split('\n').forEach(line => {
        const pidMatch = line.match(/^=== (\d+) ===/);
        if (pidMatch) {
          currentPid = Number(pidMatch[1]);
          return;
        }

        if (currentPid && processes.has(currentPid) && line.includes(':')) {
          const [, stats] = line.split(':');
          if (stats) {
            const values = stats.trim().split(/\s+/);
            const rx = Number(values[0]);
            const tx = Number(values[8]);

            const process = processes.get(currentPid)!;
            const prev = this.previousStats[currentPid];

            if (prev) {
              const timeDiff = (now - prev.timestamp) / 1000;
              if (timeDiff > 0) {
                process.rxSpeed = Math.max(0, (rx - prev.rx) / timeDiff);
                process.txSpeed = Math.max(0, (tx - prev.tx) / timeDiff);
                process.totalBytes = (rx - prev.rx) + (tx - prev.tx);
              }
            }

            this.previousStats[currentPid] = { rx, tx, timestamp: now };
          }
        }
      });

      console.timeEnd(`[NetworkProcessService] getProcessInfo ${sessionId}`);
      
      return {
        isToolInstalled: true,
        list: Array.from(processes.values())
          .sort((a, b) => (b.rxSpeed + b.txSpeed) - (a.rxSpeed + a.txSpeed))
      };
    } catch (error) {
      console.error('获取进程网络使用信息失败:', error);
      return {
        isToolInstalled: true,
        list: []
      };
    }
  }

  /**
   * 销毁服务实例
   */
  destroy(): void {
    this.previousStats = {};
    NetworkProcessService.instance = null as any;
  }
} 