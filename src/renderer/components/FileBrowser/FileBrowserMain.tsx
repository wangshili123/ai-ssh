import React from 'react';
import { SessionInfo } from '../../types';
import './FileBrowserMain.css';

interface FileBrowserMainProps {
  /**
   * 当前会话信息
   */
  sessionInfo?: SessionInfo & {
    instanceId?: string;  // 添加instanceId
  };
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

  // 生成完整的shellId
  const shellId = sessionInfo.id + (sessionInfo.instanceId ? `-${sessionInfo.instanceId}` : '');

  return (
    <div className="file-browser-main">
      <div className="file-browser-header">
        <span className="connection-info">
          {sessionInfo.username}@{sessionInfo.host}
        </span>
      </div>
      <div className="file-browser-content">
        {/* 文件浏览器内容区域 - 后续实现 */}
        <div style={{ padding: '8px', color: '#969696' }}>
          会话ID: {sessionInfo.id}<br/>
          Shell ID: {shellId}
        </div>
      </div>
    </div>
  );
};

export default FileBrowserMain;
