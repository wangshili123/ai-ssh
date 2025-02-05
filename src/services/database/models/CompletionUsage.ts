/**
 * 补全使用记录模型
 */
export interface CompletionUsage {
  id?: number;
  input: string;
  suggestion: string;
  is_selected: boolean;
  context?: string;
  created_at?: string;
}

export const createCompletionUsageTable = `
  CREATE TABLE IF NOT EXISTS completion_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    input TEXT NOT NULL,
    suggestion TEXT NOT NULL,
    is_selected BOOLEAN DEFAULT 0,
    context TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_completion_usage_input ON completion_usage(input);
  CREATE INDEX IF NOT EXISTS idx_completion_usage_suggestion ON completion_usage(suggestion);
`; 