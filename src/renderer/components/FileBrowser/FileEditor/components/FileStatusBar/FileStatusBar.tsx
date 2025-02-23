/**
 * 文件编辑器状态栏组件
 * 显示文件信息、编码、光标位置和内存使用情况
 */

import React, { useCallback } from 'react';
import { observer } from 'mobx-react';
import { useEditorStore } from '../../store/FileEditorStore';
import { getSupportedEncodings, EncodingType } from '../../utils/FileEncodingUtils';
import './FileStatusBar.less';

interface FileStatusBarProps {
  fileName: string;
  encoding: EncodingType;
  cursorPosition: {
    line: number;
    column: number;
  };
  memoryStats: {
    loadedSize: number;
    totalSize: number;
  };
  onEncodingChange: (encoding: EncodingType) => void;
}

export const FileStatusBar: React.FC<FileStatusBarProps> = observer((props) => {
  const {
    fileName,
    encoding,
    cursorPosition,
    memoryStats,
    onEncodingChange
  } = props;

  const editorStore = useEditorStore();

  // 格式化文件大小
  const formatSize = (size: number): string => {
    if (size < 1024) {
      return `${size}B`;
    } else if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)}KB`;
    } else {
      return `${(size / 1024 / 1024).toFixed(1)}MB`;
    }
  };

  // 获取文件名（不含路径）
  const getDisplayFileName = (path: string): string => {
    return path.split(/[/\\]/).pop() || path;
  };

  // 处理编码变更
  const handleEncodingChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onEncodingChange(e.target.value as EncodingType);
  }, [onEncodingChange]);

  return (
    <div className="file-status-bar">
      {/* 文件信息 */}
      <div className="status-item file-info" title={fileName}>
        <span className="icon">📁</span>
        <span className="text">{getDisplayFileName(fileName)}</span>
      </div>

      {/* 编码信息 */}
      <div className="status-item encoding-info" title="文件编码">
        <select
          value={encoding}
          onChange={handleEncodingChange}
          className="encoding-select"
        >
          {getSupportedEncodings().map(enc => (
            <option key={enc} value={enc}>{enc}</option>
          ))}
        </select>
      </div>

      {/* 光标位置 */}
      <div className="status-item cursor-info" title="光标位置">
        <span className="text">
          行:{cursorPosition.line} 列:{cursorPosition.column}
        </span>
      </div>

      {/* 内存使用 */}
      <div className="status-item memory-info" title="内存使用">
        <span className="text">
          已加载:{formatSize(memoryStats.loadedSize)}/
          总共:{formatSize(memoryStats.totalSize)}
        </span>
      </div>

      {/* 加载状态 */}
      {editorStore.isLoading && (
        <div className="status-item loading-info">
          <span className="loading-indicator" />
          <span className="text">加载中...</span>
        </div>
      )}

      {/* 实时模式状态 */}
      {editorStore.isRealtime && (
        <div className="status-item realtime-info" title="实时模式已开启">
          <span className="icon">📡</span>
          <span className="text">实时</span>
        </div>
      )}

      {/* 过滤状态 */}
      {editorStore.filterActive && (
        <div className="status-item filter-info" title="过滤已启用">
          <span className="icon">🔍</span>
          <span className="text">
            已过滤: {editorStore.filterStats.matchedLines}/{editorStore.filterStats.totalLines}
          </span>
        </div>
      )}
    </div>
  );
}); 