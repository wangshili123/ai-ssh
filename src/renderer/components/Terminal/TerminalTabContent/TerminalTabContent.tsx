import React, { useState, useCallback, useRef } from 'react';
import { Resizable } from 're-resizable';
import Terminal from '../../Terminal';
import FileBrowserMain from '../../FileBrowser/FileBrowserMain/FileBrowserMain';
import type { TerminalTabContentProps } from '../types/terminal.types';
import './TerminalTabContent.css';

/**
 * 节流函数
 */
function throttle<T extends (...args: any[]) => void>(func: T, limit: number): T {
  let inThrottle = false;
  return ((...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  }) as T;
}

/**
 * 终端标签页内容组件
 * 负责单个标签页的终端和文件浏览器的上下分栏布局
 */
const TerminalTabContent: React.FC<TerminalTabContentProps> = ({ 
  sessionInfo, 
  instanceId, 
  tabId,
  isFileBrowserVisible
}) => {
  // 仅用于布局的状态
  const [splitHeight, setSplitHeight] = useState(300);
  const resizeTimeoutRef = useRef<number>();

  // 处理分隔条拖动结束
  const handleResizeStop = (e: MouseEvent | TouchEvent, direction: string, ref: HTMLElement, d: { height: number }) => {
    console.log('Resizer stop:', { direction, delta: d.height });
    const newHeight = splitHeight + d.height;
    setSplitHeight(newHeight);
    
    // 清除之前的 timeout
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }
    
    // 使用 setTimeout 确保在 DOM 更新后触发 resize
    resizeTimeoutRef.current = window.setTimeout(() => {
      console.log('Dispatching final resize event');
      window.dispatchEvent(new Event('resize'));
    }, 100);
  };

  // 使用节流函数处理拖动过程中的 resize
  const throttledResize = useCallback(
    throttle(() => {
      console.log('Throttled resize event');
      window.dispatchEvent(new Event('resize'));
    }, 100),
    []
  );

  // 处理分隔条拖动中
  const handleResize = (e: MouseEvent | TouchEvent, direction: string, ref: HTMLElement, d: { height: number }) => {
    console.log('Resizing:', { direction, delta: d.height });
    throttledResize();
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
      
      {isFileBrowserVisible && (
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
      )}
    </div>
  );
};

export default TerminalTabContent; 