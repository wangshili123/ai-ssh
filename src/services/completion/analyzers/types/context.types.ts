import { ShellParserTypes } from '../../../parser/ShellParserTypes';
import { EnhancedPatterns } from './patterns.types';

export interface CommandExecutionResult {
  command: string;
  output: string[];
  exitCode: number;
  timestamp: Date;
}

export interface EnvironmentState {
  currentDirectory: string;
  isGitRepository: boolean;
  recentFiles: string[];
  runningProcesses: string[];
  lastModifiedFiles: string[];
}

export interface SessionState {
  currentWorkingDirectory: string;
}

export interface EnhancedCompletionContext {
  currentCommand: ShellParserTypes.ParseResult;
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
  environment: EnvironmentState;
  userPatterns: {
    commandChains: Record<string, {
      nextCommands: Record<string, number>;
      frequency: number;
      lastUsed: Date;
    }>;
    timePatterns: Record<number, Record<string, number>>;
    contextPatterns: Record<string, Record<string, number>>;
  };
  patterns: EnhancedPatterns;
  cursorPosition: number;
  sessionState: SessionState;
} 