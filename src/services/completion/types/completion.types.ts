export enum CompletionSource {
  HISTORY = 'history',
  RELATION = 'relation',
  LOCAL = 'local',
  RULE = 'rule',
  SYNTAX = 'syntax',
  AI = 'ai'
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

export interface AICompletionResult {
  command: string;
  parts: string | null;
  confidence: number;
  context: string;
  frequency: number;
} 