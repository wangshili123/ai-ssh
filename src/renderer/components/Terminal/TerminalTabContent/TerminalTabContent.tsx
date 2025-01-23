import React, { useState } from 'react';
import { Resizable } from 're-resizable';
import Terminal from '../../Terminal';
import FileBrowserMain from '../../FileBrowser/FileBrowserMain/FileBrowserMain';
import type { TerminalTabContentProps } from '../types/terminal.types';
import './TerminalTabContent.css';

/**
 * 终端标签页内容组件
 * 负责单个标签页的终端和文件浏览器的上下分栏布局
 */
const TerminalTabContent: React.FC<TerminalTabContentProps> = ({ 
  sessionInfo, 
  instanceId, 
  tabId
}) => {
  // 仅用于布局的状态
  const [splitHeight, setSplitHeight] = useState(300);
  
  return (
    <div className="terminal-tab-content">
      {/* 终端区域 */}
      <div className="terminal-area">
        <Terminal 
          sessionInfo={sessionInfo} 
          instanceId={instanceId}
        />
      </div>
      
      {/* 分隔条 */}
      <Resizable
        size={{ height: splitHeight, width: '100%' }}
        onResizeStop={(e, direction, ref, d) => {
          setSplitHeight(splitHeight + d.height);
        }}
        minHeight={100}
        maxHeight={800}
        enable={{ top: true }}
      >
        {/* 文件浏览器区域 */}
        <div className="file-browser-area">
          <FileBrowserMain
            sessionInfo={sessionInfo}
            tabId={tabId}
          />
        </div>
      </Resizable>
    </div>
  );
};

export default TerminalTabContent; 