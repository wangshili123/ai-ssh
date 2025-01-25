import React from 'react';
import { Button, Input, Space } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, ReloadOutlined } from '@ant-design/icons';
import { HistoryButton } from './History/HistoryIndex';
import './Navigation.css';

interface NavigationProps {
  currentPath: string;
  history: string[];
  historyIndex: number;
  onPathChange: (path: string) => void;
  onClearHistory?: () => void;
}

const Navigation: React.FC<NavigationProps> = ({
  currentPath,
  history,
  historyIndex,
  onPathChange,
  onClearHistory
}) => {
  // 处理后退
  const handleBack = () => {
    if (historyIndex > 0) {
      onPathChange(history[historyIndex - 1]);
    }
  };

  // 处理前进
  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      onPathChange(history[historyIndex + 1]);
    }
  };

  // 处理路径输入
  const handlePathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onPathChange(e.target.value);
  };

  return (
    <div className="navigation">
      <Space>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={handleBack}
          disabled={historyIndex <= 0}
        />
        <Button
          icon={<ArrowRightOutlined />}
          onClick={handleForward}
          disabled={historyIndex >= history.length - 1}
        />
        <Button
          icon={<ReloadOutlined />}
          onClick={() => onPathChange(currentPath)}
        />
        <Input
          value={currentPath}
          onChange={handlePathChange}
          style={{ width: 400 }}
        />
        <HistoryButton
          history={history}
          historyIndex={historyIndex}
          onSelect={onPathChange}
          onClearHistory={onClearHistory}
        />
      </Space>
    </div>
  );
};

export default Navigation; 