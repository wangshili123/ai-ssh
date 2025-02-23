/**
 * 编辑器右键菜单组件
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { observer } from 'mobx-react';
import { Menu } from 'antd';
import type { MenuProps } from 'antd';
import './EditorContextMenu.css';

interface EditorContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onCut: () => void;
  onSelectAll: () => void;
  hasSelection: boolean;
  isReadOnly: boolean;
}

export const EditorContextMenu: React.FC<EditorContextMenuProps> = observer((props) => {
  const {
    x,
    y,
    onClose,
    onCopy,
    onPaste,
    onCut,
    onSelectAll,
    hasSelection,
    isReadOnly
  } = props;

  const menuRef = useRef<HTMLDivElement>(null);

  // 处理点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // 处理ESC键关闭菜单
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // 菜单项点击处理
  const handleMenuItemClick = useCallback((action: () => void) => {
    action();
    onClose();
  }, [onClose]);

  return (
    <div
      className="editor-context-menu"
      style={{ left: x, top: y }}
      ref={menuRef}
    >
      <div
        className={`menu-item ${!hasSelection ? 'disabled' : ''}`}
        onClick={() => hasSelection && handleMenuItemClick(onCopy)}
      >
        <span className="menu-item-text">复制</span>
        <span className="shortcut">Ctrl+C</span>
      </div>

      {!isReadOnly && (
        <>
          <div
            className={`menu-item ${!hasSelection ? 'disabled' : ''}`}
            onClick={() => hasSelection && handleMenuItemClick(onCut)}
          >
            <span className="menu-item-text">剪切</span>
            <span className="shortcut">Ctrl+X</span>
          </div>

          <div
            className="menu-item"
            onClick={() => handleMenuItemClick(onPaste)}
          >
            <span className="menu-item-text">粘贴</span>
            <span className="shortcut">Ctrl+V</span>
          </div>
        </>
      )}

      <div className="menu-separator" />

      <div
        className="menu-item"
        onClick={() => handleMenuItemClick(onSelectAll)}
      >
        <span className="menu-item-text">全选</span>
        <span className="shortcut">Ctrl+A</span>
      </div>
    </div>
  );
}); 