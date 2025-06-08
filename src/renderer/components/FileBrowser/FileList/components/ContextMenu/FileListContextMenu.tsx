/**
 * 文件列表右键菜单组件
 */

import React, { useMemo, useEffect, useRef, useState } from 'react';
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
  selectedFiles?: FileEntry[];
  sessionInfo?: SessionInfo;
  tabId: string;
  currentPath: string;
  onClose: () => void;
  onDownloadRequest?: (file: FileEntry, selectedFiles: FileEntry[]) => void;
  onUploadRequest?: (currentPath: string) => void;
}

export const FileListContextMenu: React.FC<FileListContextMenuProps> = ({
  x,
  y,
  file,
  selectedFiles = [file],
  sessionInfo,
  tabId,
  currentPath,
  onClose,
  onDownloadRequest,
  onUploadRequest
}) => {
  // 添加 ref 用于获取菜单 DOM 元素
  const menuRef = useRef<HTMLDivElement>(null);



  // 计算菜单位置，避免超出屏幕
  const [menuPosition, setMenuPosition] = useState({ x, y });

  useEffect(() => {
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = x;
      let adjustedY = y;

      // 检查右边界
      if (x + menuRect.width > viewportWidth) {
        adjustedX = viewportWidth - menuRect.width - 10;
      }

      // 检查底边界
      if (y + menuRect.height > viewportHeight) {
        adjustedY = viewportHeight - menuRect.height - 10;
      }

      // 确保不超出左边界和顶边界
      adjustedX = Math.max(10, adjustedX);
      adjustedY = Math.max(10, adjustedY);

      setMenuPosition({ x: adjustedX, y: adjustedY });
    }
  }, [x, y]);



  // 监听点击事件，处理点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);



  // 使用 useMemo 缓存菜单项配置
  const menuItems = useMemo(() => [
    {
      key: 'upload',
      label: '上传文件到此处',
      onClick: () => {
        console.log('上传文件到:', currentPath);
        onUploadRequest?.(currentPath);
      }
    },
    {
      type: 'divider' as const
    },
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
    // 下载选项 - 支持单个文件和批量下载
    ...(() => {
      const downloadableFiles = selectedFiles.filter(f => !f.isDirectory);
      if (downloadableFiles.length === 0) return [];

      const isBatch = downloadableFiles.length > 1;
      return [{
        key: 'download',
        label: isBatch ? `批量下载 (${downloadableFiles.length}个文件)` : '下载'
      }];
    })()
  ], [file, selectedFiles, sessionInfo, tabId, currentPath]);

  const handleClick: MenuProps['onClick'] = (info) => {
    console.log('菜单点击事件:', info);

    // 处理下载菜单项
    if (info.key === 'download') {
      const downloadableFiles = selectedFiles.filter(f => !f.isDirectory);
      const isBatch = downloadableFiles.length > 1;

      console.log('下载菜单被点击了！', isBatch ? '批量下载' : '单个下载', downloadableFiles.length);

      // 使用回调通知父组件
      if (onDownloadRequest) {
        console.log('调用父组件的下载请求回调');
        onDownloadRequest(file, downloadableFiles);
      }

      // 关闭右键菜单
      onClose();
      return;
    }

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

    console.log('找到的目标菜单项:', targetItem);

    // 如果找到目标菜单项且有点击处理函数，则执行
    if (targetItem?.onClick) {
      console.log('执行菜单项点击处理函数');
      targetItem.onClick();
    }

    // 如果不是子菜单项，则关闭菜单
    if (!targetItem?.children) {
      onClose();
    }
  };

  return (
    <>
      <div
        className="file-list-context-menu"
        style={{
          position: 'fixed',
          left: menuPosition.x,
          top: menuPosition.y,
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


    </>
  );
};