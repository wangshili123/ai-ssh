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