/**
 * 文件列表右键菜单组件
 */

import React from 'react';
import { Menu } from 'antd';
import type { MenuProps } from 'antd';
import './FileListContextMenu.css';

interface MenuItem {
  label: string;
  type?: 'checkbox';
  checked?: boolean;
  onClick: () => void;
}

export interface FileListContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export const FileListContextMenu: React.FC<FileListContextMenuProps> = ({
  x,
  y,
  items,
  onClose
}) => {
  const handleClick: MenuProps['onClick'] = ({ key }) => {
    const item = items[parseInt(key)];
    if (item) {
      item.onClick();
    }
    onClose();
  };

  const menuItems = items.map((item, index) => ({
    key: index.toString(),
    label: item.label,
    className: item.type === 'checkbox' ? `menu-item-checkbox ${item.checked ? 'checked' : ''}` : ''
  }));

  return (
    <div
      className="file-list-context-menu"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 1000
      }}
    >
      <Menu
        items={menuItems}
        onClick={handleClick}
        onBlur={onClose}
      />
    </div>
  );
}; 