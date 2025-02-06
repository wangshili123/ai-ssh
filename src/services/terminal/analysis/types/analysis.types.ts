export interface CommandAnalysis {
  command: string;
  isValid: boolean;
  errorType?: string;
  output: string[];
}

export interface CommandOutput {
  command: string;
  output: string[];
  isComplete: boolean;
  timestamp: Date;
}

export interface AnalyzerOptions {
  shouldCollectHistory?: boolean;  // 是否记录到命令历史
  shouldCollectUsage?: boolean;    // 是否记录到使用统计
} 