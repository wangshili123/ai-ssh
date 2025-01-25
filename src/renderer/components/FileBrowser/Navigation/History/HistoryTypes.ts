export interface HistoryProps {
  history: string[];
  historyIndex: number;
  onSelect: (path: string) => void;
  onClearHistory?: () => void;
} 