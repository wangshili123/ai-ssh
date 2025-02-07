import { ShellParserTypes } from '../../../parser/ShellParserTypes';

/**
 * 命令执行结果
 */
export interface CommandExecutionResult {
  command: string;
  output: string[];
  exitCode: number;
  timestamp: Date;
}

/**
 * 命令历史记录
 */
export interface CommandHistoryEntry {
  command: string;
  frequency: number;
  lastUsed: Date;
  avgExitCode: number;
  outputs: string[];
}

/**
 * 环境状态
 */
export interface EnvironmentState {
  currentDirectory: string;
  isGitRepository: boolean;
  recentFiles: string[];
  runningProcesses: string[];
  lastModifiedFiles: string[];
}

/**
 * 用户行为模式
 */
export interface UserPattern {
  commandChains: { [key: string]: CommandChainStats };
  timePatterns: { [hour: number]: { [command: string]: number } };
  contextPatterns: { [context: string]: { [command: string]: number } };
}

export interface CommandChainStats {
  nextCommands: { [command: string]: number };
  frequency: number;
  lastUsed: Date;
}

export interface ArgumentPattern {
  value: string;
  frequency: number;
  lastUsed: Date;
  successRate: number;
}

export interface DirectoryPattern {
  path: string;
  commands: { [command: string]: number };
  lastUsed: Date;
}

export interface FileTypePattern {
  extension: string;
  commands: { [command: string]: number };
  lastUsed: Date;
}

export interface ErrorCorrectionPattern {
  originalCommand: string;
  correctedCommand: string;
  frequency: number;
  lastUsed: Date;
}

export interface EnhancedPatterns {
  argumentPatterns: ArgumentPattern[];
  directoryPatterns: string[];
  fileTypePatterns: string[];
  errorCorrections: string[];
}

/**
 * SSH会话状态
 */
export interface SessionState {
  sessionId: string;
  currentWorkingDirectory: string;
  environment: { [key: string]: string };
}

/**
 * 增强的补全上下文
 */
export interface EnhancedCompletionContext {
  // 当前命令解析结果
  currentCommand: ShellParserTypes.ParseResult;
  
  // 命令执行历史
  commandHistory: {
    recent: CommandExecutionResult[];
    statistics: Array<{
      command: string;
      frequency: number;
      lastUsed: Date;
      avgExitCode: number;
      outputs: string[];
    }>;
  };
  
  // 环境状态
  environment: EnvironmentState;
  
  // 用户行为模式
  userPatterns: UserPattern;
  
  // 光标位置
  cursorPosition: number;
  
  // 会话状态
  sessionState: SessionState;
  
  // 增强的模式
  patterns: EnhancedPatterns;
}

/**
 * 增强的上下文信息
 * 包含补全所需的各种上下文数据
 */
export interface EnhancedContext {
  // 当前工作目录
  currentDirectory: string;
  
  // Shell类型（bash/zsh等）
  shellType: string;
  
  // 命令历史
  commandHistory?: {
    // 最近的命令
    recent: Array<{
      command: string;
      timestamp: string;
      success: boolean;
    }>;
    // 命令使用统计
    statistics: Array<{
      command: string;
      frequency: number;
      lastUsed: Date;
    }>;
  };

  // 环境变量
  environmentVars?: Record<string, string>;
}

/**
 * 补全建议
 */
export interface CompletionSuggestion {
  // 完整的命令
  fullCommand: string;
  
  // 建议的补全部分
  suggestion: string;
  
  // 建议来源
  source: 'history' | 'syntax' | 'rule';
  
  // 建议得分
  score: number;
} 