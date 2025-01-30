import { Database } from 'better-sqlite3';
import { DatabaseService } from '../DatabaseService';

export interface ICommandHistory {
  id?: number;
  command: string;
  context?: string;
  frequency: number;
  last_used: Date;
  success: boolean;
  outputs?: string[];
}

interface ICommandHistoryRow {
  id: number;
  command: string;
  context: string | null;
  frequency: number;
  last_used: string;
  success: number;
  outputs?: string;
}

/**
 * 命令历史模型
 * 负责管理命令历史记录的增删改查
 */
export class CommandHistory {
  private db: Database;

  constructor() {
    this.db = DatabaseService.getInstance().getDatabase();
  }

  private getDatabase(): Database {
    return this.db;
  }

  /**
   * 添加或更新命令历史
   * @param command 命令内容
   * @param context 命令上下文(可选)
   * @param success 命令是否执行成功
   * @param outputs 命令输出内容(可选)
   */
  public async addOrUpdate(
    command: string,
    context?: string,
    success: boolean = true,
    outputs: string[] = []
  ): Promise<void> {
    console.log('CommandHistory.addOrUpdate called:', { command, context, success, outputs });
    
    try {
      const db = this.getDatabase();
      console.log('Got database connection');

      // 查找是否已存在相同的命令
      const existing = await this.search(command, 1);
      console.log('Checked existing command:', existing);

      if (existing.length > 0) {
        // 更新已存在的记录
        const sql = `
          UPDATE command_history
          SET frequency = frequency + 1,
              last_used = datetime('now'),
              success = ?,
              outputs = ?
          WHERE id = ?
        `;
        console.log('Updating existing command:', sql, { success, outputs, id: existing[0].id });
        const stmt = db.prepare(sql);
        const result = stmt.run(success ? 1 : 0, JSON.stringify(outputs), existing[0].id);
        console.log('Update result:', result);
      } else {
        // 插入新记录
        const sql = `
          INSERT INTO command_history (command, context, frequency, last_used, success, outputs)
          VALUES (?, ?, 1, datetime('now'), ?, ?)
        `;
        console.log('Inserting new command:', sql, { command, context, success, outputs });
        const stmt = db.prepare(sql);
        const result = stmt.run(command, context || null, success ? 1 : 0, JSON.stringify(outputs));
        console.log('Insert result:', result);
      }
    } catch (error) {
      console.error('Error in addOrUpdate:', error);
      throw error;
    }
  }

  /**
   * 查询命令历史
   * @param prefix 命令前缀
   * @param limit 返回结果数量限制
   */
  public async search(prefix: string, limit: number = 10): Promise<ICommandHistory[]> {
    console.log('CommandHistory.search called:', { prefix, limit });
    
    try {
      let sql: string;
      let params: any[];

      if (!prefix) {
        // 如果前缀为空，返回最近使用的命令
        sql = `
          SELECT id, command, context, frequency, last_used, success, outputs
          FROM command_history
          ORDER BY last_used DESC, frequency DESC
          LIMIT ?
        `;
        params = [limit];
      } else {
        // 如果有前缀，进行多级匹配
        sql = `
          SELECT id, command, context, frequency, last_used, success, outputs
          FROM command_history
          WHERE command LIKE ?
          ORDER BY
            CASE 
              WHEN command = ? THEN 3        -- 完全匹配最高优先级
              WHEN command LIKE ? THEN 2     -- 前缀匹配次优先级 
              ELSE 1                         -- 包含匹配最低优先级
            END DESC,
            frequency DESC,
            last_used DESC
          LIMIT ?
        `;
        params = [
          `%${prefix}%`,  // LIKE 模式匹配
          prefix,         // 完全匹配
          `${prefix}%`,   // 前缀匹配
          limit
        ];
      }

      console.log('Executing search query:', sql, { params });
      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...params) as ICommandHistoryRow[];
      console.log('Search results:', rows);

      const results = rows.map(row => ({
        id: row.id,
        command: row.command,
        context: row.context || undefined,
        frequency: row.frequency,
        last_used: new Date(row.last_used),
        success: Boolean(row.success),
        outputs: row.outputs ? JSON.parse(row.outputs) : []
      }));

      console.log('Mapped results:', results);
      return results;
    } catch (error) {
      console.error('Error in search:', error);
      throw error;
    }
  }

  /**
   * 获取最常用的命令
   * @param limit 返回结果数量限制
   */
  public async getMostUsed(limit: number = 10): Promise<ICommandHistory[]> {
    const stmt = this.db.prepare(`
      SELECT id, command, context, frequency, last_used, success, outputs
      FROM command_history
      ORDER BY frequency DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as ICommandHistoryRow[];
    return rows.map(row => ({
      id: row.id,
      command: row.command,
      context: row.context || undefined,
      frequency: row.frequency,
      last_used: new Date(row.last_used),
      success: Boolean(row.success),
      outputs: row.outputs ? JSON.parse(row.outputs) : []
    }));
  }

  /**
   * 删除命令历史
   * @param command 要删除的命令
   */
  public async delete(command: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM command_history WHERE command = ?');
    stmt.run(command);
  }

  /**
   * 清理旧的命令历史
   * @param days 保留最近几天的记录
   */
  public async cleanup(days: number = 30): Promise<void> {
    const stmt = this.db.prepare(`
      DELETE FROM command_history
      WHERE last_used < datetime('now', ?)
    `);
    
    stmt.run(`-${days} days`);
  }
} 
