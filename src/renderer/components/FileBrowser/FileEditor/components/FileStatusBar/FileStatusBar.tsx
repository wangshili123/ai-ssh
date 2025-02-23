/**
 * 文件编辑器状态栏组件
 */

import React from 'react';
import { observer } from 'mobx-react';
import { Space, Tooltip } from 'antd';
import {
  ClockCircleOutlined,
  FontSizeOutlined,
  LockOutlined,
  FileOutlined,
  ColumnHeightOutlined
} from '@ant-design/icons';
import { useEditorStore } from '../../store/FileEditorStore';
import { formatFileSize, formatPermissions } from '../../../../../utils/fileUtils';
import dayjs from 'dayjs';
import './FileStatusBar.css';

interface FileStatusBarProps {
  cursorPosition?: {
    line: number;
    column: number;
  } | null;
}

export const FileStatusBar: React.FC<FileStatusBarProps> = observer(({ cursorPosition }) => {
  const editorStore = useEditorStore();
  const { fileInfo, currentFile, encoding } = editorStore;

  console.log('FileStatusBar render:', { fileInfo, currentFile, encoding, cursorPosition });

  if (!fileInfo || !currentFile) {
    console.log('Missing data:', { fileInfo, currentFile });
    return null;
  }

  // 获取文件名（不含路径）
  const fileName = currentFile.split(/[/\\]/).pop() || currentFile;

  return (
    <div className="file-status-bar">
      <Space>
        {/* 文件名 */}
        <Tooltip title="文件名">
          <span className="status-item">
            <FileOutlined />
            <span className="status-text">{fileName}</span>
          </span>
        </Tooltip>

        {/* 文件大小 */}
        {fileInfo.size !== undefined && (
          <Tooltip title="文件大小">
            <span className="status-item">
              <span className="status-text">{formatFileSize(fileInfo.size)}</span>
            </span>
          </Tooltip>
        )}

        {/* 文件权限 */}
        {fileInfo.permissions !== undefined && (
          <Tooltip title="文件权限">
            <span className="status-item">
              <LockOutlined />
              <span className="status-text">{formatPermissions(fileInfo.permissions)}</span>
            </span>
          </Tooltip>
        )}

        {/* 修改时间 */}
        {fileInfo.modifyTime && (
          <Tooltip title="最后修改时间">
            <span className="status-item">
              <ClockCircleOutlined />
              <span className="status-text">
                {dayjs(fileInfo.modifyTime).format('YYYY-MM-DD HH:mm:ss')}
              </span>
            </span>
          </Tooltip>
        )}

        {/* 光标位置 */}
        {cursorPosition && (
          <Tooltip title="光标位置">
            <span className="status-item">
              <ColumnHeightOutlined />
              <span className="status-text">
                行 {cursorPosition.line}, 列 {cursorPosition.column}
              </span>
            </span>
          </Tooltip>
        )}

        {/* 编码信息 */}
        {encoding && (
          <Tooltip title="文件编码">
            <span className="status-item">
              <FontSizeOutlined />
              <span className="status-text">{encoding}</span>
            </span>
          </Tooltip>
        )}

        {/* 加载状态 */}
        {fileInfo.isPartiallyLoaded && (
          <Tooltip title="部分加载">
            <span className="status-item warning">
              <span className="status-text">部分加载</span>
            </span>
          </Tooltip>
        )}
      </Space>
    </div>
  );
}); 