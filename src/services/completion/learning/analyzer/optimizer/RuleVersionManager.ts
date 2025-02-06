import { DatabaseService } from '../../../../database/DatabaseService';
import {
  RuleUpdate,
  RuleVersion as RuleVersionType
} from './types/rule-optimizer.types';
import { CompletionRule, CompletionRuleData } from '../../../../database/models/CompletionRule';
import { RuleVersion, RuleVersionData } from '../../../../database/models/RuleVersion';

/**
 * 规则版本管理器
 * 负责管理规则的版本历史
 */
export class RuleVersionManager {
  private static instance: RuleVersionManager;
  private ruleModel: CompletionRule;
  private versionModel: RuleVersion;
  private currentVersion: number = 0;

  private constructor() {
    this.ruleModel = new CompletionRule();
    this.versionModel = new RuleVersion();
  }

  public static getInstance(): RuleVersionManager {
    if (!RuleVersionManager.instance) {
      RuleVersionManager.instance = new RuleVersionManager();
    }
    return RuleVersionManager.instance;
  }

  /**
   * 创建新版本
   */
  public async createVersion(changes: RuleUpdate[]): Promise<RuleVersionType> {
    const version: RuleVersionData = {
      version: ++this.currentVersion,
      changes,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    // 保存版本到数据库
    await this.versionModel.create(version);

    return {
      version: version.version,
      timestamp: version.createdAt,
      changes: version.changes,
      status: version.status
    };
  }

  /**
   * 回滚到指定版本
   */
  public async rollback(version: number): Promise<void> {
    try {
      // 1. 获取版本历史
      const versions = await this.versionModel.findAll();
      
      // 2. 验证版本号
      if (version <= 0 || version > this.currentVersion) {
        throw new Error(`Invalid version number: ${version}`);
      }

      // 3. 获取目标版本
      const targetVersion = versions.find(v => v.version === version);
      if (!targetVersion) {
        throw new Error(`Version ${version} not found`);
      }

      // 4. 获取需要回滚的版本列表
      const versionsToRollback = versions
        .filter(v => v.version > version)
        .sort((a, b) => b.version - a.version);

      // 5. 使用事务执行回滚
      const db = DatabaseService.getInstance().getDatabase();
      await db.transaction(async () => {
        // 回滚每个版本
        for (const v of versionsToRollback) {
          await this.rollbackVersion(v);
        }

        // 更新版本状态
        await this.versionModel.updateStatus(version, 'active');
        for (const v of versionsToRollback) {
          await this.versionModel.updateStatus(v.version, 'rollback');
        }

        // 更新当前版本
        this.currentVersion = version;
      });

    } catch (error) {
      console.error('[RuleVersionManager] Rollback failed:', error);
      throw error;
    }
  }

  /**
   * 获取版本历史
   */
  public async getVersionHistory(): Promise<RuleVersionType[]> {
    const versions = await this.versionModel.findAll();
    return versions.map(v => ({
      version: v.version,
      timestamp: v.createdAt,
      changes: v.changes,
      status: v.status
    }));
  }

  /**
   * 获取当前版本
   */
  public getCurrentVersion(): number {
    return this.currentVersion;
  }

  /**
   * 回滚单个版本
   */
  private async rollbackVersion(version: RuleVersionData): Promise<void> {
    try {
      // 反向应用每个更改
      for (const change of version.changes.reverse()) {
        const rule = await this.ruleModel.findById(change.ruleId);
        
        if (rule) {
          // 如果是新增的规则，则删除
          if (rule.version === 1) {
            await this.ruleModel.delete(rule.id);
          } else {
            // 否则回滚到上一个版本
            const previousVersion = rule.version - 1;
            await this.ruleModel.update(rule.id, {
              ...rule,
              version: previousVersion
            });
          }
        }
      }
    } catch (error) {
      console.error(`[RuleVersionManager] Failed to rollback version ${version.version}:`, error);
      throw error;
    }
  }
} 