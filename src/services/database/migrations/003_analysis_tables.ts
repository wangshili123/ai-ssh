import { Database } from 'better-sqlite3';

export async function up(db: Database): Promise<void> {
  // 创建分析状态表
  await db.exec(`
    CREATE TABLE IF NOT EXISTS analysis_state (
      id INTEGER PRIMARY KEY,
      component TEXT NOT NULL,
      last_processed_id INTEGER,
      last_analysis_time TIMESTAMP,
      processed_count INTEGER,
      analysis_metrics TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP,
      UNIQUE(component)
    );

    CREATE INDEX IF NOT EXISTS idx_analysis_state_component ON analysis_state(component);
  `);

  // 创建补全规则表
  await db.exec(`
    CREATE TABLE IF NOT EXISTS completion_rules (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('parameter', 'context', 'sequence')),
      pattern TEXT NOT NULL,
      weight REAL NOT NULL CHECK (weight >= 0 AND weight <= 1),
      confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
      version INTEGER NOT NULL,
      metadata JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_completion_rules_type ON completion_rules(type);
    CREATE INDEX IF NOT EXISTS idx_completion_rules_weight ON completion_rules(weight DESC);
  `);

  // 创建规则版本表
  await db.exec(`
    CREATE TABLE IF NOT EXISTS rule_versions (
      version INTEGER PRIMARY KEY,
      changes JSON NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('active', 'rollback', 'deprecated')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_rule_versions_status ON rule_versions(status);
  `);

  // 创建规则性能表
  await db.exec(`
    CREATE TABLE IF NOT EXISTS rule_performance (
      rule_id TEXT PRIMARY KEY,
      usage_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      adoption_count INTEGER DEFAULT 0,
      total_latency INTEGER DEFAULT 0,
      last_used_at TIMESTAMP,
      FOREIGN KEY (rule_id) REFERENCES completion_rules(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_rule_performance_usage ON rule_performance(usage_count DESC);
  `);
}

export async function down(db: Database): Promise<void> {
  await db.exec(`
    DROP INDEX IF EXISTS idx_rule_performance_usage;
    DROP TABLE IF EXISTS rule_performance;
    
    DROP INDEX IF EXISTS idx_rule_versions_status;
    DROP TABLE IF EXISTS rule_versions;
    
    DROP INDEX IF EXISTS idx_completion_rules_type;
    DROP INDEX IF EXISTS idx_completion_rules_weight;
    DROP TABLE IF EXISTS completion_rules;
    
    DROP INDEX IF EXISTS idx_analysis_state_component;
    DROP TABLE IF EXISTS analysis_state;
  `);
} 