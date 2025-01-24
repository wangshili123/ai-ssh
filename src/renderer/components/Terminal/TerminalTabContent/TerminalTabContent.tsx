import React, { useState, useEffect } from 'react';
import { Resizable } from 're-resizable';
import Terminal from '../../Terminal';
import FileBrowserMain from '../../FileBrowser/FileBrowserMain/FileBrowserMain';
import type { TerminalTabContentProps } from '../types/terminal.types';
import { eventBus } from '../../../services/eventBus';
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
  
  // 处理分隔条拖动结束
  const handleResizeStop = (e: MouseEvent | TouchEvent, direction: string, ref: HTMLElement, d: { height: number }) => {
    console.log('Resizer stop:', { direction, delta: d.height });
    const newHeight = splitHeight + d.height;
    setSplitHeight(newHeight);
    
    // 使用 setTimeout 确保在 DOM 更新后触发 resize
    setTimeout(() => {
      console.log('Dispatching resize event after stop');
      window.dispatchEvent(new Event('resize'));
    }, 0);
  };

  // 处理分隔条拖动中
  const handleResize = (e: MouseEvent | TouchEvent, direction: string, ref: HTMLElement, d: { height: number }) => {
    console.log('Resizing:', { direction, delta: d.height });
    // 使用 requestAnimationFrame 限制 resize 事件的触发频率
    requestAnimationFrame(() => {
      console.log('Dispatching resize event during drag');
      window.dispatchEvent(new Event('resize'));
    });
  };
  
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
        onResize={handleResize}
        onResizeStop={handleResizeStop}
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