import React, { useState, useEffect } from 'react';
import { Button, Space, AutoComplete } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, ReloadOutlined, SyncOutlined } from '@ant-design/icons';
import { HistoryButton } from './History/HistoryIndex';
import { HistoryState } from './History/HistoryStorageService';
import { searchPaths } from '../../../services/pathSearchService';
import './Navigation.css';

interface NavigationProps {
  currentPath: string;
  history: string[];
  historyIndex: number;
  onPathChange: (path: string) => void;
  onClearHistory?: () => void;
  tabId: string;  // 添加 tabId 参数
  onSyncToTerminal?: (path: string) => void;
}

const Navigation: React.FC<NavigationProps> = ({
  currentPath,
  history: pathHistory,
  historyIndex,
  onPathChange,
  onClearHistory,
  tabId,
  onSyncToTerminal
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

  // 添加搜索选项状态
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [inputValue, setInputValue] = useState(currentPath);

  // 监听 currentPath 的变化
  useEffect(() => {
    setInputValue(currentPath);
  }, [currentPath]);

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

  // 处理路径搜索
  const handleSearch = async (value: string) => {
    if (!value) {
      setOptions([]);
      return;
    }

    try {
      const paths = await searchPaths(tabId, value);
      const newOptions = paths.map(path => ({
        value: path,
        label: path
      }));
      setOptions(newOptions);
    } catch (error) {
      console.error('[Navigation] 搜索路径失败:', error);
      setOptions([]);
    }
  };

  // 处理路径选择
  const handleSelect = (value: string) => {
    // 获取从根目录到目标目录的路径数组
    const pathParts = value.split('/').filter(Boolean);
    const expandKeys = pathParts.reduce((acc: string[], part: string, index: number) => {
      const currentPath = '/' + pathParts.slice(0, index + 1).join('/');
      acc.push(currentPath);
      return acc;
    }, ['/']);

    console.log('[Navigation] 选择路径:', { 
      value, 
      pathParts,
      expandKeys 
    });

    // 更新路径和目录树
    onPathChange(value);
  };

  // 处理同步到终端
  const handleSync = () => {
    if (onSyncToTerminal) {
      onSyncToTerminal(currentPath);
    }
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
        <AutoComplete
          value={inputValue}
          options={options}
          style={{ width: 400 }}
          onSearch={handleSearch}
          onSelect={handleSelect}
          onChange={setInputValue}
          placeholder="输入路径搜索"
          allowClear
        />
        <HistoryButton
          history={historyState}
          historyIndex={historyIndex}
          onSelect={onPathChange}
          onClearHistory={onClearHistory}
        />
        <Button
          icon={<SyncOutlined />}
          onClick={handleSync}
          title="同步到终端"
        />
      </Space>
    </div>
  );
};

export default Navigation; 