/**
 * 文件编辑器状态栏组件
 * 显示当前编辑器状态信息，包括光标位置、文件信息和模式状态
 */

import React from 'react';
import { Tooltip, Badge } from 'antd';
import { 
  EditOutlined, 
  EyeOutlined, 
  FileOutlined, 
  LockOutlined, 
  ClockCircleOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { EditorMode } from '../../types/FileEditorTypes';
import { FileStatusBarProps } from './FileStatusBarExport';
import './FileStatusBar.css';

/**
 * 格式化文件大小
 * @param bytes 文件字节数
 * @returns 格式化后的文件大小字符串
 */
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

/**
 * 文件编辑器状态栏组件
 */
export const FileStatusBar: React.FC<FileStatusBarProps> = ({
  currentMode,
  cursorPosition,
  fileInfo,
  browseInfo,
  editInfo,
  readOnly = false,
  isDirty = false,
  isAutoScroll = false,
  className = ''
}) => {
  // 获取当前时间
  const now = new Date().toLocaleTimeString();
  
  return (
    <div className={`editor-status-bar ${className}`}>
      {/* 左侧信息区 */}
      <div className="status-left">
        {/* 模式指示器 */}
        <Tooltip title={currentMode === EditorMode.BROWSE ? "浏览模式" : "编辑模式"}>
          <div className="status-item mode-indicator">
            {currentMode === EditorMode.BROWSE ? (
              <><EyeOutlined /> 浏览</>
            ) : (
              <><EditOutlined /> 编辑</>
            )}
          </div>
        </Tooltip>
        
        {/* 文件信息 */}
        {fileInfo && (
          <Tooltip title={`路径: ${fileInfo.path}`}>
            <div className="status-item">
              <FileOutlined /> {fileInfo.path.split('/').pop()} ({formatFileSize(fileInfo.size)})
            </div>
          </Tooltip>
        )}
        
        {/* 只读状态 */}
        {readOnly && (
          <Tooltip title="只读模式">
            <div className="status-item">
              <LockOutlined /> 只读
            </div>
          </Tooltip>
        )}
        
        {/* 未保存状态 */}
        {isDirty && (
          <Tooltip title="有未保存的修改">
            <div className="status-item">
              <Badge status="warning" text="未保存" />
            </div>
          </Tooltip>
        )}
      </div>
      
      {/* 中间信息区 - 模式特有信息 */}
      <div className="status-center">
        {/* 浏览模式信息 */}
        {currentMode === EditorMode.BROWSE && browseInfo && (
          <div className="status-item">
            已加载: {browseInfo.loadedLines}/{browseInfo.totalLines} 行
            {browseInfo.filteredLines !== undefined && (
              <span className="filtered-info">
                (已过滤: {browseInfo.filteredLines} 行)
              </span>
            )}
          </div>
        )}
        
        {/* 编辑模式信息 */}
        {currentMode === EditorMode.EDIT && editInfo && (
          <div className="status-item">
            总行数: {editInfo.totalLines}
            {editInfo.selectedText && (
              <span className="selection-info">
                已选择: {editInfo.selectedText.length} 个字符
              </span>
            )}
          </div>
        )}
        
        {isAutoScroll && <span className="autoscroll-indicator">自动滚动</span>}
      </div>
      
      {/* 右侧信息区 */}
      <div className="status-right">
        {/* 光标位置 */}
        {cursorPosition && (
          <div className="status-item">
            行 {cursorPosition.line}, 列 {cursorPosition.column}
          </div>
        )}
        
        {/* 编码信息 */}
        {fileInfo && (
          <div className="status-item">
            {fileInfo.encoding}
          </div>
        )}
        
        {/* 修改时间信息 */}
        {fileInfo && fileInfo.modified && (
          <Tooltip title="文件修改时间">
            <div className="status-item">
              <ClockCircleOutlined /> {fileInfo.modified.toLocaleString()}
            </div>
          </Tooltip>
        )}
        
        {/* 当前时间信息 */}
        <Tooltip title="当前时间">
          <div className="status-item">
            <ClockCircleOutlined /> {now}
          </div>
        </Tooltip>
      </div>
    </div>
  );
}; 