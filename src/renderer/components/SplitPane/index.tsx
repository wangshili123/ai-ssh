import React, { useState } from 'react';
import { Button } from 'antd';
import { BorderHorizontalOutlined } from '@ant-design/icons';
import Terminal from '../Terminal';
import type { SessionInfo } from '../../../main/services/storage';
import './index.css';

interface SplitPaneProps {
  sessionInfo?: SessionInfo;
}

const SplitPane: React.FC<SplitPaneProps> = ({ sessionInfo }) => {
  const [splitDirection, setSplitDirection] = useState<'horizontal' | 'vertical'>('horizontal');
  const [panes, setPanes] = useState([{ id: '1' }]);

  // 切换分屏方向
  const toggleSplitDirection = () => {
    setSplitDirection(prev => prev === 'horizontal' ? 'vertical' : 'horizontal');
  };

  // 添加新窗格
  const addPane = () => {
    setPanes(prev => [...prev, { id: String(prev.length + 1) }]);
  };

  // 移除窗格
  const removePane = (id: string) => {
    setPanes(prev => prev.filter(pane => pane.id !== id));
  };

  return (
    <div className="split-pane-container">
      <div className="split-pane-toolbar">
        <Button
          icon={<BorderHorizontalOutlined rotate={splitDirection === 'vertical' ? 90 : 0} />}
          onClick={toggleSplitDirection}
          title={splitDirection === 'vertical' ? '水平分屏' : '垂直分屏'}
        />
        <Button onClick={addPane}>添加窗格</Button>
      </div>
      <div className={`split-pane-content ${splitDirection}`}>
        {panes.map(pane => (
          <div key={pane.id} className="split-pane">
            <Terminal sessionInfo={sessionInfo} />
            {panes.length > 1 && (
              <Button
                className="close-button"
                onClick={() => removePane(pane.id)}
                size="small"
              >
                关闭
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SplitPane; 