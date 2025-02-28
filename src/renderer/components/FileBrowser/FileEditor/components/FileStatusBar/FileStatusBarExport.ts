import { FileStatusBar } from './FileStatusBar';

export interface FileStatusBarProps {
  currentMode: string;
  cursorPosition: {
    line: number;
    column: number;
  };
  fileInfo: {
    path: string;
    size: number;
    encoding: string;
    modified?: Date;
  };
  className?: string;
  isDirty?: boolean;
  readOnly?: boolean;
  isAutoScroll?: boolean;
  browseInfo?: {
    loadedLines: number;
    totalLines: number;
    filteredLines?: number;
  };
  editInfo?: {
    totalLines: number;
    selectedText?: string;
  };
}

export default FileStatusBar; 