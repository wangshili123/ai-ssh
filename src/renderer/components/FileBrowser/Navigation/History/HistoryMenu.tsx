import React from 'react';
import { Menu } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { HistoryProps } from './HistoryTypes';
import './HistoryStyles.css';

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
      const item = history.items.find(item => item.id === key);
      if (item) {
        onSelect(item.path);
      }
    }
  };

  const menuItems = [
    ...history.items.map((item, index) => ({
      key: item.id,
      label: (
        <div className="history-item">
          <span>{item.path}</span>
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