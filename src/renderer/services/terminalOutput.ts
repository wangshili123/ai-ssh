/**
 * 终端输出管理服务
 * 用于收集、处理和管理终端的输出内容
 */

// 终端缓冲区接口
interface TerminalBuffer {
  lines: string[];
  maxLines: number;
  lastPrompt: string; // 记录最后一次的提示符
  currentCommand: string; // 当前正在输入的命令
  isFirstConnect: boolean; // 是否是首次连接
}

/**
 * 终端输出服务类
 * 负责管理所有终端的输出缓冲区
 */
class TerminalOutputService {
  // 使用 Map 存储每个终端的输出缓冲区
  private buffers: Map<string, TerminalBuffer>;
  
  constructor() {
    this.buffers = new Map();
  }

  /**
   * 添加终端输出
   * @param shellId 终端ID
   * @param output 输出内容
   */
  addOutput(shellId: string, output: string) {
    // 获取或创建缓冲区
    let buffer = this.buffers.get(shellId);
    if (!buffer) {
      buffer = {
        lines: [],
        maxLines: 1000, // 每个终端最多保存1000行输出
        lastPrompt: '',
        currentCommand: '',
        isFirstConnect: true
      };
      this.buffers.set(shellId, buffer);
    }

    // 处理输出内容
    const processedOutput = this.processOutput(output, buffer);
    if (processedOutput) {
      const newLines = processedOutput.split('\n').filter(line => line.trim());

      // 添加新行到缓冲区
      buffer.lines.push(...newLines);

      // 如果超出最大行数限制，删除旧的行
      if (buffer.lines.length > buffer.maxLines) {
        buffer.lines = buffer.lines.slice(-buffer.maxLines);
      }
    }
  }

  /**
   * 处理输出内容
   * @param output 原始输出内容
   * @param buffer 当前终端的缓冲区
   * @returns 处理后的输出内容
   */
  private processOutput(output: string, buffer: TerminalBuffer): string {
    // 移除 ANSI 转义序列和其他控制字符
    let processed = output
      .replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '') // 移除 ANSI 颜色代码
      .replace(/\r\n/g, '\n') // 统一换行符
      .replace(/\r/g, '\n')
      .replace(/\u0007/g, '') // 移除 Bell 字符
      .replace(/\u001b\[\??\d+[hl]/g, '') // 移除终端控制字符
      .replace(/\u0000/g, '') // 移除 NULL 字符
      .replace(/\b/g, ''); // 移除退格字符

    // 如果是首次连接，移除欢迎信息
    if (buffer.isFirstConnect) {
      if (processed.includes('Welcome to Alibaba Cloud')) {
        buffer.isFirstConnect = false; // 标记为非首次连接
        return ''; // 跳过欢迎信息
      }
    }

    // 移除登录相关信息
    processed = processed
      .replace(/Welcome to Alibaba Cloud Elastic Compute Service ![\s\S]*?Last login:.*$/m, '')
      .replace(/Last failed login:.*$/m, '')
      .replace(/There were \d+ failed login attempts.*$/m, '')
      .replace(/Last login:.*$/m, '')
      .replace(/Updates Information Summary:[\s\S]*?https:\/\/.*\.html/g, '')
      .replace(/Run ".*" to apply all updates\./, '');

    // 检测提示符
    const promptRegex = /\[.*@.*\][^#]*#/;
    const promptMatch = processed.match(promptRegex);

    if (promptMatch) {
      const newPrompt = promptMatch[0];
      
      // 如果有新的提示符，说明上一个命令已经执行完成
      if (buffer.currentCommand) {
        // 提取命令的输出（从当前命令到新提示符之间的内容）
        const commandOutput = processed
          .split(promptRegex)[0] // 获取提示符之前的内容
          .trim();

        if (commandOutput) {
          // 保存命令和它的输出
          buffer.lines.push(`命令：${buffer.currentCommand}`);
          buffer.lines.push(`输出：${commandOutput}`);
        }
        
        // 清空当前命令
        buffer.currentCommand = '';
      }

      buffer.lastPrompt = newPrompt;
      // 移除提示符
      processed = processed.replace(promptRegex, '');
    } else {
      // 如果没有检测到新的提示符，可能是在输入命令
      // 或者是命令的输出
      if (buffer.lastPrompt) {
        // 如果之前有提示符，说明这是命令输入或命令输出
        if (!buffer.currentCommand) {
          // 如果没有当前命令，说明这是命令输入
          buffer.currentCommand = processed.trim();
          return ''; // 不保存命令输入过程
        }
      }
    }

    // 如果输出中只包含提示符或空白字符，则忽略
    if (!processed.trim() || processed.trim() === buffer.lastPrompt) {
      return '';
    }

    return processed.trim();
  }

  /**
   * 获取指定终端的最近输出
   * @param shellId 终端ID
   * @param lines 获取的行数，默认50行
   * @returns 终端输出内容
   */
  getRecentOutput(shellId: string, lines: number = 50): string {
    const buffer = this.buffers.get(shellId);
    if (!buffer || buffer.lines.length === 0) return '';

    // 获取最近的输出行
    const recentLines = buffer.lines.slice(-lines);
    
    // 如果输出被截断，添加提示
    const output = recentLines.join('\n');
    if (buffer.lines.length > lines) {
      return `[输出已截断，仅显示最近 ${lines} 行]\n${output}`;
    }
    return output;
  }

  /**
   * 清除指定终端的输出缓存
   * @param shellId 终端ID
   */
  clearOutput(shellId: string) {
    this.buffers.delete(shellId);
  }

  /**
   * 清除所有终端的输出缓存
   */
  clearAllOutput() {
    this.buffers.clear();
  }
}

// 导出服务实例
export const terminalOutputService = new TerminalOutputService(); 