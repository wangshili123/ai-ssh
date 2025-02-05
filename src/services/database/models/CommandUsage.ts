/**
 * 命令使用记录模型
 */
export interface CommandUsage {
  id?: number;
  command: string;
  context?: string;
  frequency: number;
  success_count: number;
  fail_count: number;
  last_used?: string;
  created_at?: string;
}

export const createCommandUsageTable = `
  CREATE TABLE IF NOT EXISTS command_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    command TEXT NOT NULL,
    context TEXT,
    frequency INTEGER DEFAULT 1,
    success_count INTEGER DEFAULT 0,
    fail_count INTEGER DEFAULT 0,
    last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(command)
  );

  CREATE INDEX IF NOT EXISTS idx_command_usage_command ON command_usage(command);
  CREATE INDEX IF NOT EXISTS idx_command_usage_frequency ON command_usage(frequency DESC);
`; 