import React from 'react';
import { Menu } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { HistoryProps } from './HistoryTypes';
import './styles.css';

const HistoryMenu: React.FC<HistoryProps> = ({
  history,
  historyIndex,
  onSelect,
  onClearHistory
}) => {
  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'clear') {
      onClearHistory?.();
    } else {
      onSelect(key);
    }
  };

  const menuItems = [
    ...history.map((path, index) => ({
      key: path,
      label: (
        <div className="history-item">
          <span>{path}</span>
          {index === historyIndex && (
            <span className="current-indicator">(当前)</span>
          )}
        </div>
      ),
      className: index === historyIndex ? 'history-item-active' : ''
    })),
    {
      key: 'clear',
      label: (
        <div className="history-item clear-history">
          <span>清除历史记录</span>
          <DeleteOutlined />
        </div>
      )
    }
  ];

  return (
    <Menu
      items={menuItems}
      onClick={handleMenuClick}
      style={{ minWidth: 200 }}
    />
  );
};

export default HistoryMenu; 