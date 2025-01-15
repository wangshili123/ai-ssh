/**
 * 终端输出管理服务
 * 用于收集、处理和管理终端的输出内容
 */

// 终端缓冲区接口
export interface TerminalHistory {
  command?: string;
  output?: string;
  timestamp: number;
}

interface TerminalBufferData {
  lines: string[];
  maxLines: number;
}

class TerminalBuffer implements TerminalBufferData {
  lines: string[] = [];
  maxLines = 1000;

  append(output: string): void {
    const newLines = output.split('\n');
    this.lines.push(...newLines);

    // 保持行数在限制内
    if (this.lines.length > this.maxLines) {
      this.lines = this.lines.slice(-this.maxLines);
    }
  }

  getLines(): string[] {
    return this.lines;
  }

  clear(): void {
    this.lines = [];
  }
}

export interface TerminalOutputService {
  addOutput: (shellId: string, output: string) => void;
  addCommand: (command: string) => void;
  getHistory: () => TerminalHistory[];
  getRecentOutput: () => string;
  clear: () => void;
  clearOutput: (shellId: string) => void;
}

class TerminalOutputServiceImpl implements TerminalOutputService {
  private history: TerminalHistory[] = [];
  private maxHistoryLength = 10;
  private buffers: Map<string, TerminalBuffer> = new Map();

  constructor() {
    this.buffers = new Map();
  }

  addOutput(shellId: string, output: string): void {
    // 更新缓冲区
    let buffer = this.buffers.get(shellId);
    if (!buffer) {
      buffer = new TerminalBuffer();
      this.buffers.set(shellId, buffer);
    }
    buffer.append(output);

    // 更新历史记录
    if (this.history.length > 0) {
      const lastEntry = this.history[this.history.length - 1];
      lastEntry.output = lastEntry.output ? lastEntry.output + output : output;
    }
  }

  addCommand(command: string): void {
    this.history.push({
      command,
      timestamp: Date.now()
    });

    // 保持历史记录在限定长度内
    if (this.history.length > this.maxHistoryLength) {
      this.history = this.history.slice(-this.maxHistoryLength);
    }
  }

  getHistory(): TerminalHistory[] {
    return this.history;
  }

  clear(): void {
    this.history = [];
    this.buffers.clear();
  }

  clearOutput(shellId: string): void {
    // 清除指定终端的缓冲区
    const buffer = this.buffers.get(shellId);
    if (buffer) {
      buffer.clear();
    }
    this.buffers.delete(shellId);

    // 清除相关的历史记录
    this.history = this.history.filter(entry => !entry.output);
  }

  getRecentOutput(): string {
    // 获取最近的历史记录
    const recentHistory = this.history.slice(-5);
    
    // 构建输出字符串
    const output = recentHistory.map(entry => {
      let result = '';
      if (entry.command) {
        // 只记录命令内容，不包含提示符
        result += `$ ${entry.command}\n`;
      }
      if (entry.output) {
        // 过滤掉命令提示符行
        const filteredOutput = entry.output
          .split('\n')
          .filter(line => {
            // 过滤掉以下内容：
            // 1. [user@host path]# 格式的提示符
            // 2. 空行
            // 3. 只包含 $ 或 # 的行
            return !line.match(/^\[.*@.*\s+.*\][#\$]\s*$/) && 
                   line.trim() !== '' &&
                   !line.match(/^[\$#]\s*$/);
          })
          .join('\n');
        
        if (filteredOutput.trim()) {
          result += filteredOutput + '\n';
        }
      }
      return result;
    }).filter(output => output.trim() !== '').join('\n');

    return output;
  }
}

export const terminalOutputService = new TerminalOutputServiceImpl(); 