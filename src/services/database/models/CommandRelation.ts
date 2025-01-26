import { Database } from 'better-sqlite3';
import { DatabaseService } from '../DatabaseService';

export interface ICommandRelation {
  id?: number;
  command1_id: number;
  command2_id: number;
  relation_type: string;
  frequency: number;
}

interface ICommandRelationRow {
  id: number;
  command1_id: number;
  command2_id: number;
  relation_type: string;
  frequency: number;
}

/**
 * 命令关系类型
 */
export enum CommandRelationType {
  SEQUENCE = 'sequence', // 命令执行顺序关系
  SIMILAR = 'similar',   // 相似命令关系
  VARIANT = 'variant'    // 命令变体关系
}

/**
 * 命令关系模型
 * 负责管理命令之间的关联关系
 */
export class CommandRelation {
  private db: Database;

  constructor() {
    this.db = DatabaseService.getInstance().getDatabase();
  }

  /**
   * 添加或更新命令关系
   * @param command1Id 第一个命令ID
   * @param command2Id 第二个命令ID
   * @param relationType 关系类型
   */
  public async addOrUpdate(
    command1Id: number,
    command2Id: number,
    relationType: CommandRelationType
  ): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO command_relations (command1_id, command2_id, relation_type)
      VALUES (?, ?, ?)
      ON CONFLICT(command1_id, command2_id) DO UPDATE SET
        frequency = frequency + 1
    `);

    stmt.run(command1Id, command2Id, relationType);
  }

  /**
   * 获取与指定命令相关的命令
   * @param commandId 命令ID
   * @param relationType 关系类型(可选)
   * @param limit 返回结果数量限制
   */
  public async getRelated(
    commandId: number,
    relationType?: CommandRelationType,
    limit: number = 10
  ): Promise<ICommandRelation[]> {
    const sql = `
      SELECT id, command1_id, command2_id, relation_type, frequency
      FROM command_relations
      WHERE (command1_id = ? OR command2_id = ?)
      ${relationType ? 'AND relation_type = ?' : ''}
      ORDER BY frequency DESC
      LIMIT ?
    `;

    const params = relationType
      ? [commandId, commandId, relationType, limit]
      : [commandId, commandId, limit];

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as ICommandRelationRow[];
    
    return rows.map(row => ({
      id: row.id,
      command1_id: row.command1_id,
      command2_id: row.command2_id,
      relation_type: row.relation_type,
      frequency: row.frequency
    }));
  }

  /**
   * 删除命令关系
   * @param command1Id 第一个命令ID
   * @param command2Id 第二个命令ID
   */
  public async delete(command1Id: number, command2Id: number): Promise<void> {
    const stmt = this.db.prepare(`
      DELETE FROM command_relations
      WHERE command1_id = ? AND command2_id = ?
    `);
    
    stmt.run(command1Id, command2Id);
  }

  /**
   * 清理低频率的命令关系
   * @param minFrequency 最小频率阈值
   */
  public async cleanup(minFrequency: number = 2): Promise<void> {
    const stmt = this.db.prepare(`
      DELETE FROM command_relations
      WHERE frequency < ?
    `);
    
    stmt.run(minFrequency);
  }
} 