import React from 'react';
import { Button, Input, Space } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, ReloadOutlined } from '@ant-design/icons';
import { HistoryButton } from './History/HistoryIndex';
import { HistoryState } from './History/HistoryStorageService';
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
  history: pathHistory,
  historyIndex,
  onPathChange,
  onClearHistory
}) => {
  // 将旧的历史记录格式转换为新格式
  const historyState: HistoryState = {
    items: pathHistory.map((path, index) => ({
      id: `${path}-${index}`,
      path,
      timestamp: Date.now() - (pathHistory.length - index) * 1000 // 模拟时间戳
    })),
    currentIndex: historyIndex
  };

  // 处理后退
  const handleBack = () => {
    if (historyIndex > 0) {
      onPathChange(pathHistory[historyIndex - 1]);
    }
  };

  // 处理前进
  const handleForward = () => {
    if (historyIndex < pathHistory.length - 1) {
      onPathChange(pathHistory[historyIndex + 1]);
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
          disabled={historyIndex >= pathHistory.length - 1}
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
          history={historyState}
          historyIndex={historyIndex}
          onSelect={onPathChange}
          onClearHistory={onClearHistory}
        />
      </Space>
    </div>
  );
};

export default Navigation; 