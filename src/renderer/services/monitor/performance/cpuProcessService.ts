import { SSHService } from '../../../types';
import { CpuProcessAnalysis, CpuProcessInfo, CpuThreadInfo } from '../../../types/monitor/monitor';

/**
 * CPU进程分析服务
 * 负责采集CPU占用最高的进程和线程信息
 */
export class CpuProcessService {
  private static instance: CpuProcessService;
  private sshService: SSHService;
  
  // 缓存上次的进程数据
  private lastProcessData = new Map<string, CpuProcessAnalysis>();

  private constructor(sshService: SSHService) {
    this.sshService = sshService;
  }

  /**
   * 获取单例实例
   */
  static getInstance(sshService: SSHService): CpuProcessService {
    if (!CpuProcessService.instance) {
      CpuProcessService.instance = new CpuProcessService(sshService);
    }
    return CpuProcessService.instance;
  }

  /**
   * 获取CPU占用最高的进程列表
   */
  async getTopCpuProcesses(sessionId: string): Promise<CpuProcessAnalysis> {
    try {
      console.time(`[CpuProcessService] getTopCpuProcesses ${sessionId}`);

      // 检查工具是否可用
      const isInstalled = await this.checkTools(sessionId);
      if (!isInstalled) {
        return {
          topProcesses: [],
          totalProcesses: 0,
          runningProcesses: 0,
          isToolInstalled: false
        };
      }

      // 获取进程信息，按CPU使用率排序，显示前15个进程
      const cmd = `
        # 获取进程总数和运行中的进程数
        echo "=== PROCESS_COUNT ==="
        ps aux | wc -l
        echo "=== RUNNING_COUNT ==="
        ps aux | awk '$8 ~ /^R/ {count++} END {print count+0}'
        
        # 获取CPU占用最高的进程，显示详细信息
        echo "=== TOP_PROCESSES ==="
        ps aux --sort=-%cpu | head -n 16 | tail -n +2
      `;

      const output = await this.sshService.executeCommandDirect(sessionId, cmd);
      const result = this.parseProcessOutput(output);

      // 缓存结果
      this.lastProcessData.set(sessionId, result);

      console.timeEnd(`[CpuProcessService] getTopCpuProcesses ${sessionId}`);
      return result;
    } catch (error) {
      console.error('[CpuProcessService] 获取进程信息失败:', error);
      // 返回缓存的数据或默认值
      return this.lastProcessData.get(sessionId) || {
        topProcesses: [],
        totalProcesses: 0,
        runningProcesses: 0,
        isToolInstalled: false
      };
    }
  }

  /**
   * 获取指定进程的线程信息
   */
  async getProcessThreads(sessionId: string, pid: number): Promise<CpuThreadInfo[]> {
    try {
      console.log(`[CpuProcessService] 获取进程 ${pid} 的线程信息`);
      
      // 获取进程线程信息
      const cmd = `ps -T -p ${pid} -o tid,comm,%cpu,stat --no-headers 2>/dev/null || echo "NO_THREADS"`;
      const output = await this.sshService.executeCommandDirect(sessionId, cmd);
      
      if (output.trim() === 'NO_THREADS' || !output.trim()) {
        return [];
      }

      return this.parseThreadOutput(output);
    } catch (error) {
      console.error(`[CpuProcessService] 获取进程 ${pid} 线程信息失败:`, error);
      return [];
    }
  }

  /**
   * 获取进程详细信息
   */
  async getProcessDetail(sessionId: string, pid: number): Promise<CpuProcessInfo | null> {
    try {
      console.log(`[CpuProcessService] 获取进程 ${pid} 详细信息`);
      
      const cmd = `
        # 获取进程详细信息
        ps -p ${pid} -o pid,ppid,comm,user,pri,ni,%cpu,%mem,stat,etime,cmd --no-headers 2>/dev/null || echo "NO_PROCESS"
      `;
      
      const output = await this.sshService.executeCommandDirect(sessionId, cmd);
      
      if (output.trim() === 'NO_PROCESS' || !output.trim()) {
        return null;
      }

      // 同时获取线程信息
      const threads = await this.getProcessThreads(sessionId, pid);
      
      return this.parseProcessDetailOutput(output, threads);
    } catch (error) {
      console.error(`[CpuProcessService] 获取进程 ${pid} 详细信息失败:`, error);
      return null;
    }
  }

  /**
   * 检查必要的工具是否安装
   */
  private async checkTools(sessionId: string): Promise<boolean> {
    try {
      const cmd = 'which ps > /dev/null 2>&1 && echo "installed" || echo "not_installed"';
      const result = await this.sshService.executeCommandDirect(sessionId, cmd);
      return result.trim() === 'installed';
    } catch (error) {
      console.error('[CpuProcessService] 检查工具安装状态失败:', error);
      return false;
    }
  }

  /**
   * 解析进程输出
   */
  private parseProcessOutput(output: string): CpuProcessAnalysis {
    const sections = output.split('=== ');
    
    // 解析进程总数
    const processCountSection = sections.find(s => s.startsWith('PROCESS_COUNT ==='));
    const totalProcesses = processCountSection 
      ? parseInt(processCountSection.split('===')[1].trim()) - 1 // 减去header行
      : 0;

    // 解析运行中进程数
    const runningCountSection = sections.find(s => s.startsWith('RUNNING_COUNT ==='));
    const runningProcesses = runningCountSection 
      ? parseInt(runningCountSection.split('===')[1].trim()) || 0
      : 0;

    // 解析TOP进程
    const topProcessesSection = sections.find(s => s.startsWith('TOP_PROCESSES ==='));
    const topProcesses: CpuProcessInfo[] = [];
    
    if (topProcessesSection) {
      const lines = topProcessesSection
        .split('===')[1]
        .split('\n')
        .filter(line => line.trim());

      for (const line of lines) {
        const process = this.parseProcessLine(line);
        if (process) {
          topProcesses.push(process);
        }
      }
    }

    return {
      topProcesses,
      totalProcesses,
      runningProcesses,
      isToolInstalled: true
    };
  }

  /**
   * 解析单行进程信息
   */
  private parseProcessLine(line: string): CpuProcessInfo | null {
    try {
      // ps aux 输出格式: USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND
      const parts = line.trim().split(/\s+/);
      if (parts.length < 11) return null;

      const user = parts[0];
      const pid = parseInt(parts[1]);
      const cpuPercent = parseFloat(parts[2]);
      const memoryPercent = parseFloat(parts[3]);
      const vsz = parseInt(parts[4]); // 虚拟内存大小(KB)
      const rss = parseInt(parts[5]); // 物理内存大小(KB)
      const stat = parts[7];
      const startTime = parts[8];
      const command = parts.slice(10).join(' ');

      // 提取进程名（命令的第一部分）
      const name = command.split(' ')[0].split('/').pop() || command;

      return {
        pid,
        name,
        command,
        cpuPercent,
        memoryUsed: rss * 1024, // 转换为bytes
        memoryPercent,
        status: this.parseProcessStatus(stat),
        startTime,
        user,
        priority: 0, // ps aux不直接提供，需要单独获取
        nice: 0,     // ps aux不直接提供，需要单独获取
        threads: []  // 初始为空，需要单独获取
      };
    } catch (error) {
      console.error('[CpuProcessService] 解析进程行失败:', line, error);
      return null;
    }
  }

  /**
   * 解析进程状态
   */
  private parseProcessStatus(stat: string): 'R' | 'S' | 'D' | 'Z' | 'T' | 'I' {
    const firstChar = stat.charAt(0).toUpperCase();
    switch (firstChar) {
      case 'R': return 'R'; // 运行
      case 'S': return 'S'; // 睡眠
      case 'D': return 'D'; // 不可中断睡眠
      case 'Z': return 'Z'; // 僵尸
      case 'T': return 'T'; // 停止
      case 'I': return 'I'; // 空闲
      default: return 'S';  // 默认为睡眠
    }
  }

  /**
   * 解析线程输出
   */
  private parseThreadOutput(output: string): CpuThreadInfo[] {
    const threads: CpuThreadInfo[] = [];
    const lines = output.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        // ps -T 输出格式: TID COMMAND %CPU STAT
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 4) {
          const tid = parseInt(parts[0]);
          const name = parts[1];
          const cpuPercent = parseFloat(parts[2]);
          const status = parts[3];

          threads.push({
            tid,
            name,
            cpuPercent,
            status
          });
        }
      } catch (error) {
        console.error('[CpuProcessService] 解析线程行失败:', line, error);
      }
    }

    return threads;
  }

  /**
   * 解析进程详细信息输出
   */
  private parseProcessDetailOutput(output: string, threads: CpuThreadInfo[]): CpuProcessInfo | null {
    try {
      const line = output.trim();
      // ps 详细输出格式: PID PPID COMM USER PRI NI %CPU %MEM STAT ETIME CMD
      const parts = line.split(/\s+/);
      if (parts.length < 11) return null;

      const pid = parseInt(parts[0]);
      const user = parts[3];
      const priority = parseInt(parts[4]);
      const nice = parseInt(parts[5]);
      const cpuPercent = parseFloat(parts[6]);
      const memoryPercent = parseFloat(parts[7]);
      const stat = parts[8];
      const startTime = parts[9];
      const command = parts.slice(10).join(' ');
      const name = command.split(' ')[0].split('/').pop() || command;

      return {
        pid,
        name,
        command,
        cpuPercent,
        memoryUsed: 0, // 需要从其他地方获取
        memoryPercent,
        status: this.parseProcessStatus(stat),
        startTime,
        user,
        priority,
        nice,
        threads
      };
    } catch (error) {
      console.error('[CpuProcessService] 解析进程详细信息失败:', output, error);
      return null;
    }
  }

  /**
   * 终止进程
   */
  async killProcess(sessionId: string, pid: number, signal: string = 'TERM'): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      console.log(`[CpuProcessService] 终止进程 ${pid}，信号: ${signal}`);

      // 使用kill命令终止进程
      const cmd = `kill -${signal} ${pid} 2>&1 && echo "SUCCESS" || echo "FAILED"`;
      const output = await this.sshService.executeCommandDirect(sessionId, cmd);

      if (output.includes('SUCCESS')) {
        return {
          success: true,
          message: `进程 ${pid} 已成功终止`
        };
      } else {
        return {
          success: false,
          message: `终止进程失败: ${output.replace('FAILED', '').trim()}`
        };
      }
    } catch (error) {
      console.error(`[CpuProcessService] 终止进程 ${pid} 失败:`, error);
      return {
        success: false,
        message: `终止进程失败: ${error instanceof Error ? error.message : '未知错误'}`
      };
    }
  }

  /**
   * 强制终止进程
   */
  async forceKillProcess(sessionId: string, pid: number): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.killProcess(sessionId, pid, 'KILL');
  }

  /**
   * 获取进程打开的文件列表
   */
  async getProcessFiles(sessionId: string, pid: number): Promise<{
    success: boolean;
    files: Array<{
      fd: string;
      type: string;
      path: string;
      mode: string;
    }>;
    message?: string;
  }> {
    try {
      console.log(`[CpuProcessService] 获取进程 ${pid} 的文件列表`);

      // 使用lsof命令获取进程打开的文件
      const cmd = `lsof -p ${pid} 2>/dev/null | tail -n +2 || echo "NO_FILES"`;
      const output = await this.sshService.executeCommandDirect(sessionId, cmd);

      if (output.trim() === 'NO_FILES' || !output.trim()) {
        return {
          success: false,
          files: [],
          message: '无法获取进程文件信息，可能需要更高权限或进程不存在'
        };
      }

      const files = this.parseLsofOutput(output);

      return {
        success: true,
        files
      };
    } catch (error) {
      console.error(`[CpuProcessService] 获取进程 ${pid} 文件列表失败:`, error);
      return {
        success: false,
        files: [],
        message: `获取文件列表失败: ${error instanceof Error ? error.message : '未知错误'}`
      };
    }
  }

  /**
   * 解析lsof输出
   */
  private parseLsofOutput(output: string): Array<{
    fd: string;
    type: string;
    path: string;
    mode: string;
  }> {
    const files: Array<{
      fd: string;
      type: string;
      path: string;
      mode: string;
    }> = [];

    const lines = output.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        // lsof输出格式: COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 9) {
          const fd = parts[3];
          const type = parts[4];
          const mode = parts[5] || '';
          const path = parts.slice(8).join(' ');

          // 过滤一些常见的系统文件描述符
          if (!fd.match(/^(cwd|rtd|txt|mem|DEL)$/)) {
            files.push({
              fd,
              type,
              path,
              mode
            });
          }
        }
      } catch (error) {
        console.error('[CpuProcessService] 解析lsof行失败:', line, error);
      }
    }

    return files;
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.lastProcessData.clear();
    CpuProcessService.instance = null as any;
  }
}
