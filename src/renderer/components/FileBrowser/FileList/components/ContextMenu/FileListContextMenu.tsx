/**
 * 文件列表右键菜单组件
 */

import React, { useMemo, useEffect, useRef, useState } from 'react';
import { Menu } from 'antd';
import type { MenuProps } from 'antd';
import type { FileEntry } from '../../../../../../main/types/file';
import type { SessionInfo } from '../../../../../types';
import { fileOpenManager } from '../../core/FileOpenManager';
import { downloadService } from '../../../../../services/downloadService';
import DownloadDialog, { type DownloadConfig } from '../../../../Download/DownloadDialog';
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

  // 下载对话框状态
  const [downloadDialogVisible, setDownloadDialogVisible] = useState(false);

  // 调试：监听下载对话框状态变化
  useEffect(() => {
    console.log('下载对话框状态变化:', downloadDialogVisible);
  }, [downloadDialogVisible]);

  // 监听点击事件，处理点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // 如果下载对话框正在显示，不处理外部点击
      if (downloadDialogVisible) {
        return;
      }

      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // 添加点击事件监听
    document.addEventListener('mousedown', handleClickOutside);

    // 添加 ESC 键关闭功能
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // 如果下载对话框正在显示，优先关闭对话框
        if (downloadDialogVisible) {
          setDownloadDialogVisible(false);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    // 清理事件监听
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, downloadDialogVisible]);

  // 处理下载确认
  const handleDownloadConfirm = async (config: DownloadConfig) => {
    console.log('下载确认被调用:', config);
    try {
      if (!sessionInfo) {
        console.error('没有会话信息');
        return;
      }

      // 开始下载，使用tabId作为connectionId
      console.log('下载参数:', { fileName: file.name, tabId, sessionId: sessionInfo.id });
      await downloadService.startDownload(file, {
        ...config,
        sessionId: tabId // 使用tabId，这样主进程可以构造正确的connectionId
      });

      setDownloadDialogVisible(false);
      onClose(); // 关闭右键菜单
    } catch (error) {
      console.error('下载失败:', error);
    }
  };

  // 处理下载取消
  const handleDownloadCancel = () => {
    console.log('下载取消被调用');
    setDownloadDialogVisible(false);
    onClose(); // 关闭右键菜单
  };

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
    // 只对文件显示下载选项
    ...(!file.isDirectory ? [{
      key: 'download',
      label: '下载',
      onClick: () => {
        console.log('下载菜单被点击了！', file.name, file.isDirectory);
        console.log('准备显示下载对话框...');
        console.log('当前对话框状态:', downloadDialogVisible);

        // 使用setTimeout确保状态更新不被阻止
        setTimeout(() => {
          console.log('设置对话框可见状态为true');
          setDownloadDialogVisible(true);
        }, 0);
      }
    }] : [])
  ], [file, sessionInfo, tabId, currentPath, downloadDialogVisible]);

  const handleClick: MenuProps['onClick'] = (info) => {
    console.log('菜单点击事件:', info);
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

    // 对于下载菜单项，不立即关闭菜单
    if (targetItem?.key === 'download') {
      console.log('下载菜单项，不关闭菜单');
      return;
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

      {/* 下载对话框 */}
      {sessionInfo && (
        <DownloadDialog
          visible={downloadDialogVisible}
          file={file}
          sessionInfo={sessionInfo}
          defaultSavePath={process.env.USERPROFILE ? `${process.env.USERPROFILE}\\Downloads` : ''} // Windows默认下载路径
          onConfirm={handleDownloadConfirm}
          onCancel={handleDownloadCancel}
        />
      )}
    </>
  );
};