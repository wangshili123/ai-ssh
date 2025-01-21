import React from 'react';
import { SessionInfo } from '../../types';
import './FileBrowserMain.css';

interface FileBrowserMainProps {
  /**
   * 当前会话信息
   */
  sessionInfo?: SessionInfo;
}

/**
 * 文件浏览器主组件
 */
const FileBrowserMain: React.FC<FileBrowserMainProps> = ({
  sessionInfo
}) => {
  if (!sessionInfo) {
    return null;
  }

  return (
    <div className="file-browser-main">
      <div className="file-browser-header">
        <span className="connection-info">
          {sessionInfo.username}@{sessionInfo.host}
        </span>
      </div>
      <div className="file-browser-content">
        {/* 文件浏览器内容区域 - 后续实现 */}
      </div>
    </div>
  );
};

export default FileBrowserMain;
