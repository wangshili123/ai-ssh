import type { SessionInfo } from '../../../../main/services/storage';

export interface TerminalTab {
  key: string;
  title: string;
  sessionInfo?: SessionInfo;
  instanceId: string;
  tabId: string;
  connected: boolean;
}

export interface TerminalTabsManagerProps {
  sessionInfo?: SessionInfo;
  triggerNewTab?: number;
  onTabChange?: (session: SessionInfo) => void;
}

export interface TerminalTabContentProps {
  sessionInfo: SessionInfo;
  instanceId: string;
  tabId: string;
} 