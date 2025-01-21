import React, { useState } from 'react';
import { Resizable } from 're-resizable';
import './SplitPaneLayout.css';

interface SplitPaneLayoutProps {
  /**
   * 上方区域内容
   */
  topPane: React.ReactNode;
  
  /**
   * 下方区域内容
   */
  bottomPane: React.ReactNode;
  
  /**
   * 下方区域初始高度
   */
  initialBottomHeight?: number;
  
  /**
   * 下方区域最小高度
   */
  minBottomHeight?: number;
  
  /**
   * 下方区域最大高度
   */
  maxBottomHeight?: number;
}

/**
 * 垂直分割布局组件
 * 用于管理Terminal和FileBrowser的布局
 */
const SplitPaneLayout: React.FC<SplitPaneLayoutProps> = ({
  topPane,
  bottomPane,
  initialBottomHeight = 300,
  minBottomHeight = 100,
  maxBottomHeight = 800
}) => {
  // 底部面板高度状态
  const [bottomHeight, setBottomHeight] = useState(initialBottomHeight);
  
  return (
    <div className="split-pane-layout">
      {/* 上方区域 */}
      <div className="top-pane">
        {topPane}
      </div>
      
      {/* 下方可调整区域 */}
      <Resizable
        size={{ height: bottomHeight, width: '100%' }}
        onResizeStop={(e, direction, ref, d) => {
          setBottomHeight(bottomHeight + d.height);
        }}
        minHeight={minBottomHeight}
        maxHeight={maxBottomHeight}
        enable={{ top: true }}
        className="bottom-pane"
      >
        {bottomPane}
      </Resizable>
    </div>
  );
};

export default SplitPaneLayout; 