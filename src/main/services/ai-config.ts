import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import fetch from 'node-fetch';

// AI配置接口
export interface AIConfig {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens?: number;
  proxy?: string;
  baseURL: string;
}

// 默认配置
const DEFAULT_CONFIG: AIConfig = {
  apiKey: '',
  model: 'gpt-3.5-turbo',
  temperature: 0.7,
  baseURL: ''
};

// 加密密钥，实际应用中应该使用更安全的方式存储
const ENCRYPTION_KEY = 'your-secret-key-32-chars-long!!!';
const IV_LENGTH = 16;

// 测试请求超时时间（毫秒）
const TEST_TIMEOUT = 5000;

export class AIConfigService {
  private configPath: string;

  constructor() {
    // 在用户数据目录下创建配置文件
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, 'ai-config.json');
    console.log('AI 配置文件路径:', this.configPath);
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

  // 保存配置
  async saveConfig(config: AIConfig): Promise<void> {
    console.log('保存配置:', config);
    try {
      // 加密 API Key
      const encryptedConfig = {
        ...config,
        apiKey: config.apiKey ? this.encrypt(config.apiKey) : ''
      };

      await fs.promises.writeFile(
        this.configPath,
        JSON.stringify(encryptedConfig, null, 2)
      );
      console.log('配置保存成功');
    } catch (error) {
      console.error('保存AI配置失败:', error);
      throw error;
    }
  }

  // 加载配置
  async loadConfig(): Promise<AIConfig> {
    console.log('加载配置...');
    try {
      if (!fs.existsSync(this.configPath)) {
        console.log('配置文件不存在，使用默认配置');
        return DEFAULT_CONFIG;
      }

      const data = await fs.promises.readFile(this.configPath, 'utf8');
      const config = JSON.parse(data);

      // 解密 API Key
      const decryptedConfig = {
        ...config,
        apiKey: config.apiKey ? this.decrypt(config.apiKey) : ''
      };
      console.log('配置加载成功:', decryptedConfig);
      return decryptedConfig;
    } catch (error) {
      console.error('加载AI配置失败:', error);
      return DEFAULT_CONFIG;
    }
  }

  // 测试配置
  async testConfig(config: AIConfig): Promise<boolean> {
    console.log('测试配置:', config);
    try {
      if (!config.baseURL) {
        console.error('API URL不能为空');
        return false;
      }

      const url = `${config.baseURL}/chat/completions`;

      // 创建一个带超时的Promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('请求超时')), TEST_TIMEOUT);
      });

      // 创建API请求Promise
      const fetchPromise = fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': config.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'user', content: 'Hello' }
          ],
          temperature: config.temperature,
          max_tokens: config.maxTokens || 50
        })
      });

      // 使用Promise.race来实现超时控制
      const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API测试失败:', errorText);
        return false;
      }

      // 打印响应内容
      const responseData = await response.json();
      console.log('API测试响应:', JSON.stringify(responseData, null, 2));

      return true;
    } catch (error) {
      console.error('测试AI配置失败:', error);
      return false;
    }
  }
}

// 导出服务实例
export const aiConfigService = new AIConfigService(); 