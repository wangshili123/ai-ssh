import { HistoryState } from './HistoryStorageService';

export interface HistoryProps {
  history: HistoryState;
  historyIndex: number;
  onSelect: (path: string) => void;
  onClearHistory?: () => void;
} 