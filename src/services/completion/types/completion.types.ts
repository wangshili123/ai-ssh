export enum CompletionSource {
  HISTORY = 'history',
  RELATION = 'relation',
  LOCAL = 'local'
}

export interface CompletionSuggestion {
  fullCommand: string;
  suggestion: string;
  source: CompletionSource;
  score: number;
  details?: {
    frequency?: number;
    lastUsed?: Date;
    contextScore?: number;
    chainScore?: number;
    timeScore?: number;
    envScore?: number;
  };
}

export interface CompletionContext {
  tabId: string;
  sshSession?: any;  // 根据实际SSH会话类型定义
  recentCommands: string[];
  commandHistory: {
    frequency: number;
    lastUsed: Date;
  };
  currentCommand: {
    name: string;
    args: string[];
    options: string[];
    isIncomplete: boolean;
  };
} 