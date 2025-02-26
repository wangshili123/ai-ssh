/**
 * 模式切换按钮组件
 * 用于在浏览模式和编辑模式之间切换
 */

import React, { useState, useCallback } from 'react';
import { Button, Tooltip, message } from 'antd';
import { EditOutlined, EyeOutlined, LoadingOutlined } from '@ant-design/icons';
import { EditorMode, ModeSwitchOptions, useEditor } from '../../types/FileEditorTypes';
import { ModeSwitchButtonProps } from './ModeSwitchButtonTypes';
import './ModeSwitchButtonStyles.css';

/**
 * 模式切换按钮组件
 * 允许用户在浏览模式和编辑模式之间切换
 */
const ModeSwitchButton: React.FC<ModeSwitchButtonProps> = ({
  currentMode,
  fileSize,
  disabled = false,
  onModeSwitch,
  className = ''
}) => {
  // 获取编辑器上下文
  const editor = useEditor();
  
  // 切换状态
  const [isSwitching, setIsSwitching] = useState(false);
  
  // 获取按钮文本和图标
  const getButtonProps = () => {
    if (isSwitching) {
      return {
        icon: <LoadingOutlined />,
        text: '切换中...'
      };
    }
    
    if (currentMode === EditorMode.BROWSE) {
      return {
        icon: <EditOutlined />,
        text: '切换到编辑模式',
        tooltip: '切换到编辑模式以修改文件内容'
      };
    } else {
      return {
        icon: <EyeOutlined />,
        text: '切换到浏览模式',
        tooltip: '切换到浏览模式以高效浏览大文件'
      };
    }
  };
  
  // 处理模式切换
  const handleModeSwitch = useCallback(async () => {
    if (isSwitching || disabled) {
      return;
    }
    
    // 目标模式
    const targetMode = currentMode === EditorMode.BROWSE 
      ? EditorMode.EDIT 
      : EditorMode.BROWSE;
    
    // 如果文件过大且要切换到编辑模式，显示警告
    const MAX_SAFE_EDIT_SIZE = 10 * 1024 * 1024; // 10MB
    if (targetMode === EditorMode.EDIT && fileSize && fileSize > MAX_SAFE_EDIT_SIZE) {
      const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);
      const confirm = window.confirm(
        `文件大小为 ${fileSizeMB}MB，加载到编辑模式可能会导致性能问题。确定要继续吗？`
      );
      
      if (!confirm) {
        return;
      }
    }
    
    setIsSwitching(true);
    
    try {
      // 切换选项
      const options: ModeSwitchOptions = {
        saveOnSwitch: true
      };
      
      // 执行模式切换
      const result = await editor.switchToMode(targetMode, options);
      
      if (result.success) {
        message.success(`已切换到${targetMode === EditorMode.BROWSE ? '浏览' : '编辑'}模式`);
        onModeSwitch && onModeSwitch(targetMode, true);
      } else {
        message.error(`模式切换失败: ${result.error}`);
        onModeSwitch && onModeSwitch(currentMode, false);
      }
    } catch (error: any) {
      message.error(`模式切换出错: ${error.message}`);
      onModeSwitch && onModeSwitch(currentMode, false);
    } finally {
      setIsSwitching(false);
    }
  }, [currentMode, disabled, editor, fileSize, isSwitching, onModeSwitch]);
  
  const buttonProps = getButtonProps();
  
  return (
    <Tooltip title={buttonProps.tooltip}>
      <Button
        type="primary"
        icon={buttonProps.icon}
        onClick={handleModeSwitch}
        loading={isSwitching}
        disabled={disabled}
        className={`mode-switch-button ${className} ${currentMode === EditorMode.BROWSE ? 'browse-mode' : 'edit-mode'} ${isSwitching ? 'switching' : ''}`}
      >
        {buttonProps.text}
      </Button>
    </Tooltip>
  );
};

export default ModeSwitchButton; 