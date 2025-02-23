/**
 * 文件列表右键菜单组件
 */

import React, { useMemo, useEffect, useRef } from 'react';
import { Menu } from 'antd';
import type { MenuProps } from 'antd';
import type { FileEntry } from '../../../../../../main/types/file';
import type { SessionInfo } from '../../../../../types';
import { fileOpenManager } from '../../core/FileOpenManager';
import './FileListContextMenu.css';

export interface FileListContextMenuProps {
  x: number;
  y: number;
  file: FileEntry;
  sessionInfo?: SessionInfo;
  tabId: string;
  currentPath: string;
  onClose: () => void;
}

export const FileListContextMenu: React.FC<FileListContextMenuProps> = ({
  x,
  y,
  file,
  sessionInfo,
  tabId,
  currentPath,
  onClose
}) => {
  // 添加 ref 用于获取菜单 DOM 元素
  const menuRef = useRef<HTMLDivElement>(null);

  // 监听点击事件，处理点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // 添加点击事件监听
    document.addEventListener('mousedown', handleClickOutside);

    // 添加 ESC 键关闭功能
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    // 清理事件监听
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // 使用 useMemo 缓存菜单项配置
  const menuItems = useMemo(() => [
    {
      key: 'delete',
      label: '删除',
      danger: true,
      onClick: () => {
        // TODO: 实现删除功能
        console.log('删除文件:', file.name);
      }
    },
    {
      key: 'open',
      label: '打开方式',
      children: [
        {
          key: 'open-internal',
          label: '内置编辑器',
          onClick: () => {
            fileOpenManager.openFile(file, sessionInfo!, tabId, 'built-in');
          }
        },
        {
          key: 'open-external',
          label: '外部编辑器',
          disabled: true, // 暂时禁用
          onClick: () => {
            // TODO: 实现外部编辑器打开
          }
        },
        {
          type: 'divider'
        },
        {
          key: 'set-editor',
          label: '设置外部编辑器',
          onClick: () => {
            // TODO: 实现设置外部编辑器
          }
        }
      ]
    },
    {
      key: 'copy-path',
      label: '复制路径',
      onClick: () => {
        const fullPath = `${currentPath}/${file.name}`.replace(/\/+/g, '/');
        navigator.clipboard.writeText(fullPath);
      }
    },
    {
      key: 'download',
      label: '下载',
      onClick: () => {
        // TODO: 实现下载功能
        console.log('下载文件:', file.name);
      }
    }
  ], [file, sessionInfo, tabId, currentPath]);

  const handleClick: MenuProps['onClick'] = (info) => {
    const keys = info.keyPath.reverse();
    let currentItems: any[] = menuItems;
    let targetItem: any;

    // 遍历键路径找到目标菜单项
    for (const key of keys) {
      targetItem = currentItems.find(item => item.key === key);
      if (targetItem?.children) {
        currentItems = targetItem.children;
      }
    }

    // 如果找到目标菜单项且有点击处理函数，则执行
    if (targetItem?.onClick) {
      targetItem.onClick();
    }

    // 如果不是子菜单项，则关闭菜单
    if (!targetItem?.children) {
      onClose();
    }
  };

  return (
    <div
      className="file-list-context-menu"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 1000
      }}
      ref={menuRef}
    >
      <Menu
        mode="vertical"
        items={menuItems}
        onClick={handleClick}
        className="context-menu"
      />
    </div>
  );
}; 