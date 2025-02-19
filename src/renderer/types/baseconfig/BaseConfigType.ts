
export interface MonitorConfig {
  refreshInterval: number;     // 刷新间隔(秒)
  autoRefresh: boolean;       // 是否自动刷新
  defaultPage: 'process' | 'performance' | 'history' | 'startup' | 'user' | 'detail' | 'service';  // 默认页面
  collectServiceInfo: boolean;  // 启动时获取服务信息
  recordHistory: boolean;      // 记录历史数据
  enableCache: boolean;       // 是否启用缓存
  cacheExpiration: number;    // 缓存过期时间(秒)
} 

/**
 * AI 配置接口
 */
export interface AIConfig {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens?: number;
  proxy?: string;
  baseURL?: string;
  agentAutoRun?: boolean;
  agentRiskLevel?: 'low' | 'medium' | 'high';
  proxyURL?: string;
}

export interface AppConfig {
  monitor?: MonitorConfig;
  ai?: AIConfig;
}

// 配置键类型
export type ConfigKey = keyof AppConfig; 