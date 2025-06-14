export interface MonitorConfig {
  refreshInterval: number;     // 刷新间隔(秒)
  defaultPage: 'process' | 'performance' | 'history' | 'startup' | 'user' | 'detail' | 'service';  // 默认页面
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

/**
 * 终端快捷键配置接口
 */
export interface TerminalShortcutConfig {
  // 智能补全快捷键
  acceptCompletion: string;      // 接受补全建议的快捷键，默认 'Ctrl+Tab'
  acceptCompletionAlt: string;   // 备用接受补全建议的快捷键，默认 'Alt+/'
  clearCompletion: string;       // 清除补全建议的快捷键，默认 'Escape'
  navigateUp: string;            // 向上导航补全建议的快捷键，默认 'Alt+ArrowUp'
  navigateDown: string;          // 向下导航补全建议的快捷键，默认 'Alt+ArrowDown'

  // 终端操作快捷键
  copy: string;                  // 复制快捷键，默认 'Ctrl+Shift+C'
  paste: string;                 // 粘贴快捷键，默认 'Ctrl+Shift+V'
  clear: string;                 // 清空终端快捷键，默认 'Ctrl+Shift+L'
  search: string;                // 搜索快捷键，默认 'Ctrl+Shift+F'
}

export interface AppConfig {
  monitor?: MonitorConfig;
  ai?: AIConfig;
  terminalShortcuts?: TerminalShortcutConfig;
}

// 配置键类型
export type ConfigKey = keyof AppConfig; 