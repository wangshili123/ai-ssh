import React, { useState, useEffect } from 'react';
import { Modal, Radio, Tabs, Alert, Space, Typography } from 'antd';
import { LockOutlined, FileOutlined, FolderOutlined } from '@ant-design/icons';
import type { FileEntry } from '../../../../../../main/types/file';
import type { SessionInfo } from '../../../../../types';
import { permissionAction, type PermissionOptions, type PermissionSet } from '../ContextMenu/actions/permissionAction';
import { OctalPermissionEditor } from './OctalPermissionEditor';
import { SymbolicPermissionEditor } from './SymbolicPermissionEditor';
import { AdvancedOptions } from './AdvancedOptions';
import './PermissionDialog.css';

const { Text, Title } = Typography;

interface PermissionDialogProps {
  visible: boolean;
  files: FileEntry[];
  sessionInfo: SessionInfo;
  currentPath: string;
  onConfirm: (options: PermissionOptions) => void;
  onCancel: () => void;
}

interface PermissionDialogState {
  mode: 'octal' | 'symbolic';
  permissions: PermissionSet;
  octalValue: string;
  symbolicValue: string;
  recursive: boolean;
  applyToFiles: boolean;
  applyToDirectories: boolean;
}

export const PermissionDialog: React.FC<PermissionDialogProps> = ({
  visible,
  files,
  sessionInfo,
  currentPath,
  onConfirm,
  onCancel
}) => {
  const [state, setState] = useState<PermissionDialogState>({
    mode: 'octal',
    permissions: {
      owner: { read: true, write: true, execute: true },
      group: { read: true, write: false, execute: true },
      others: { read: true, write: false, execute: true }
    },
    octalValue: '755',
    symbolicValue: 'rwxr-xr-x',
    recursive: false,
    applyToFiles: false,
    applyToDirectories: false
  });

  // 初始化权限值（基于第一个文件的当前权限）
  useEffect(() => {
    if (files.length > 0 && visible) {
      const firstFile = files[0];
      const currentPermissions = permissionAction.numericToPermissions(firstFile.permissions);
      const octal = permissionAction.permissionsToOctal(currentPermissions);
      const symbolic = permissionAction.permissionsToSymbolic(currentPermissions);
      
      setState(prev => ({
        ...prev,
        permissions: currentPermissions,
        octalValue: octal,
        symbolicValue: symbolic
      }));
    }
  }, [files, visible]);

  // 更新权限状态
  const updatePermissions = (newPermissions: PermissionSet) => {
    const octal = permissionAction.permissionsToOctal(newPermissions);
    const symbolic = permissionAction.permissionsToSymbolic(newPermissions);
    
    setState(prev => ({
      ...prev,
      permissions: newPermissions,
      octalValue: octal,
      symbolicValue: symbolic
    }));
  };

  // 处理八进制值变化
  const handleOctalChange = (octal: string) => {
    if (permissionAction.validatePermissions(octal, 'octal')) {
      const permissions = permissionAction.octalToPermissions(octal);
      const symbolic = permissionAction.permissionsToSymbolic(permissions);
      
      setState(prev => ({
        ...prev,
        permissions,
        octalValue: octal,
        symbolicValue: symbolic
      }));
    } else {
      setState(prev => ({
        ...prev,
        octalValue: octal
      }));
    }
  };

  // 处理符号值变化
  const handleSymbolicChange = (symbolic: string) => {
    setState(prev => ({
      ...prev,
      symbolicValue: symbolic
    }));
  };

  // 处理模式切换
  const handleModeChange = (mode: 'octal' | 'symbolic') => {
    setState(prev => ({
      ...prev,
      mode
    }));
  };

  // 处理高级选项变化
  const handleAdvancedOptionsChange = (options: {
    recursive: boolean;
    applyToFiles: boolean;
    applyToDirectories: boolean;
  }) => {
    setState(prev => ({
      ...prev,
      ...options
    }));
  };

  // 处理确认
  const handleConfirm = () => {
    const { mode, octalValue, symbolicValue, recursive, applyToFiles, applyToDirectories } = state;
    
    // 验证权限格式
    const permissions = mode === 'octal' ? octalValue : symbolicValue;
    if (!permissionAction.validatePermissions(permissions, mode)) {
      return;
    }

    const options: PermissionOptions = {
      files,
      permissions,
      recursive,
      sessionInfo,
      currentPath,
      mode,
      applyToFiles,
      applyToDirectories
    };

    onConfirm(options);
  };

  // 获取文件信息显示
  const getFileInfo = () => {
    if (files.length === 0) return '';
    
    if (files.length === 1) {
      const file = files[0];
      return (
        <Space>
          {file.isDirectory ? <FolderOutlined /> : <FileOutlined />}
          <Text>{file.name}</Text>
        </Space>
      );
    } else {
      const fileCount = files.filter(f => !f.isDirectory).length;
      const dirCount = files.filter(f => f.isDirectory).length;
      
      return (
        <Space>
          <Text>已选择 {files.length} 个项目</Text>
          {fileCount > 0 ? <Text>({fileCount} 个文件)</Text> : null}
          {dirCount > 0 ? <Text>({dirCount} 个文件夹)</Text> : null}
        </Space>
      );
    }
  };

  // 检查是否有危险权限
  const hasDangerousPermissions = () => {
    const { octalValue } = state;
    // 777 权限被认为是危险的
    return octalValue === '777';
  };

  // 检查权限格式是否有效
  const isValidPermissions = () => {
    const { mode, octalValue, symbolicValue } = state;
    const permissions = mode === 'octal' ? octalValue : symbolicValue;
    return permissionAction.validatePermissions(permissions, mode);
  };

  return (
    <Modal
      title={
        <Space>
          <LockOutlined />
          <span>设置文件权限</span>
        </Space>
      }
      open={visible}
      onOk={handleConfirm}
      onCancel={onCancel}
      okText="确定"
      cancelText="取消"
      width={600}
      okButtonProps={{
        disabled: !isValidPermissions()
      }}
      className="permission-dialog"
    >
      <div className="permission-dialog-content">
        {/* 文件信息 */}
        <div className="permission-dialog-file-info">
          <Title level={5}>目标文件</Title>
          {getFileInfo()}
        </div>

        {/* 危险权限警告 */}
        {hasDangerousPermissions() ? (
          <Alert
            message="危险权限警告"
            description="777 权限将允许所有用户读写执行此文件，这可能存在安全风险。"
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        ) : null}

        {/* 权限编辑模式选择 */}
        <div className="permission-dialog-mode-selector">
          <Title level={5}>编辑模式</Title>
          <Radio.Group
            value={state.mode}
            onChange={(e) => handleModeChange(e.target.value)}
            style={{ marginBottom: 16 }}
          >
            <Radio value="octal">八进制模式</Radio>
            <Radio value="symbolic">符号模式</Radio>
          </Radio.Group>
        </div>

        {/* 权限编辑器 */}
        <div className="permission-dialog-editor">
          <Tabs
            activeKey={state.mode}
            onChange={(key) => handleModeChange(key as 'octal' | 'symbolic')}
            items={[
              {
                key: 'octal',
                label: '八进制权限',
                children: (
                  <OctalPermissionEditor
                    permissions={state.permissions}
                    octalValue={state.octalValue}
                    onPermissionsChange={updatePermissions}
                    onOctalChange={handleOctalChange}
                  />
                )
              },
              {
                key: 'symbolic',
                label: '符号权限',
                children: (
                  <SymbolicPermissionEditor
                    symbolicValue={state.symbolicValue}
                    onSymbolicChange={handleSymbolicChange}
                    currentPermissions={state.permissions}
                  />
                )
              }
            ]}
          />
        </div>

        {/* 高级选项 */}
        <div className="permission-dialog-advanced">
          <AdvancedOptions
            recursive={state.recursive}
            applyToFiles={state.applyToFiles}
            applyToDirectories={state.applyToDirectories}
            hasDirectories={files.some(f => f.isDirectory)}
            onChange={handleAdvancedOptionsChange}
          />
        </div>

        {/* 权限预览 */}
        <div className="permission-dialog-preview">
          <Title level={5}>权限预览</Title>
          <div className="permission-preview-display">
            <Text code>{state.symbolicValue}</Text>
            <Text type="secondary" style={{ marginLeft: 16 }}>
              ({state.octalValue})
            </Text>
          </div>
        </div>
      </div>
    </Modal>
  );
};
