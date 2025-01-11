import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// 会话信息接口
export interface SessionInfo {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'privateKey';
  password?: string;
  privateKey?: string;
  group?: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastError?: string;
}

// 加密密钥，实际应用中应该使用更安全的方式存储
const ENCRYPTION_KEY = 'your-secret-key-32-chars-long!!!';
const IV_LENGTH = 16;

class StorageService {
  private storagePath: string;

  constructor() {
    // 在用户数据目录下创建存储文件
    this.storagePath = path.join(app.getPath('userData'), 'sessions.json');
  }

  // 加密数据
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY),
      iv
    );
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  // 解密数据
  private decrypt(text: string): string {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift() || '', 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY),
      iv
    );
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  }

  // 保存会话数据
  async saveSessions(sessions: SessionInfo[]): Promise<void> {
    try {
      // 处理敏感信息
      const processedSessions = sessions.map(session => ({
        ...session,
        password: session.password ? this.encrypt(session.password) : undefined,
        privateKey: session.privateKey ? this.encrypt(session.privateKey) : undefined
      }));

      await fs.promises.writeFile(
        this.storagePath,
        JSON.stringify(processedSessions, null, 2)
      );
    } catch (error) {
      console.error('保存会话数据失败:', error);
      throw error;
    }
  }

  // 读取会话数据
  async loadSessions(): Promise<SessionInfo[]> {
    try {
      if (!fs.existsSync(this.storagePath)) {
        return [];
      }

      const data = await fs.promises.readFile(this.storagePath, 'utf8');
      const sessions = JSON.parse(data);

      // 解密敏感信息
      return sessions.map((session: SessionInfo) => ({
        ...session,
        password: session.password ? this.decrypt(session.password) : undefined,
        privateKey: session.privateKey ? this.decrypt(session.privateKey) : undefined
      }));
    } catch (error) {
      console.error('读取会话数据失败:', error);
      throw error;
    }
  }

  // 导出配置
  async exportConfig(filePath: string): Promise<void> {
    try {
      const sessions = await this.loadSessions();
      await fs.promises.writeFile(filePath, JSON.stringify(sessions, null, 2));
    } catch (error) {
      console.error('导出配置失败:', error);
      throw error;
    }
  }

  // 导入配置
  async importConfig(filePath: string): Promise<void> {
    try {
      const data = await fs.promises.readFile(filePath, 'utf8');
      const sessions = JSON.parse(data) as SessionInfo[];
      await this.saveSessions(sessions);
    } catch (error) {
      console.error('导入配置失败:', error);
      throw error;
    }
  }

  // 备份配置
  async backup(): Promise<void> {
    try {
      const backupDir = path.join(app.getPath('userData'), 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir);
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `sessions-${timestamp}.json`);
      
      const sessions = await this.loadSessions();
      await fs.promises.writeFile(backupPath, JSON.stringify(sessions, null, 2));
    } catch (error) {
      console.error('备份配置失败:', error);
      throw error;
    }
  }
}

export const storageService = new StorageService(); 