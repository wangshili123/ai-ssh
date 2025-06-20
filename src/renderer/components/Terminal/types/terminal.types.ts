import type { SessionInfo } from '../../../../renderer/types/index';

export interface TerminalTab {
  key: string;
  title: string;
  sessionInfo?: SessionInfo;
  instanceId: string;
  tabId: string;
  connected: boolean;
  connecting?: boolean;
}

export interface TerminalTabsManagerProps {
  sessionInfo?: SessionInfo;
  triggerNewTab?: number;
  onTabChange?: (session: SessionInfo) => void;
  isFileBrowserVisible: boolean;
}

export interface TerminalTabContentProps {
  sessionInfo: SessionInfo;
  instanceId: string;
  tabId: string;
  isFileBrowserVisible: boolean;
}

export interface TerminalProps {
  sessionInfo?: SessionInfo;
  config?: {
    fontSize?: number;
    fontFamily?: string;
    theme?: {
      background?: string;
      foreground?: string;
      cursor?: string;
      selectionBackground?: string;
    };
  };
  instanceId?: string;
}

// 补全建议的类型定义
export interface CompletionSuggestion {
  suggestion: string;
  source: string;
}

// 终端上下文菜单项的类型定义
export interface TerminalMenuItem {
  key: string;
  label: string;
  onClick: () => void;
} 