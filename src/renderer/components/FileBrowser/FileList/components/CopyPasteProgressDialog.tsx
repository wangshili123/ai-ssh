/**
 * 复制粘贴进度对话框
 */

import React, { useState } from 'react';
import { Modal, Spin, Typography, Button } from 'antd';
import { CopyOutlined, ScissorOutlined, MinusOutlined, ExpandOutlined } from '@ant-design/icons';

const { Text } = Typography;

export interface CopyPasteProgressDialogProps {
  visible: boolean;
  operation: 'copy' | 'cut';
  currentFile: string;
  totalFiles: number;
  currentIndex: number;
  onCancel?: () => void;
  onMinimize?: () => void;
}

export const CopyPasteProgressDialog: React.FC<CopyPasteProgressDialogProps> = ({
  visible,
  operation,
  currentFile,
  totalFiles,
  currentIndex,
  onCancel,
  onMinimize
}) => {
  const operationText = operation === 'copy' ? '复制' : '剪切';
  const operationIcon = operation === 'copy' ? <CopyOutlined /> : <ScissorOutlined />;

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {operationIcon}
            <span>{operationText}文件</span>
          </div>
          {onMinimize && (
            <Button
              type="text"
              size="small"
              icon={<MinusOutlined />}
              onClick={onMinimize}
              style={{ marginRight: -8 }}
            />
          )}
        </div>
      }
      open={visible}
      footer={null}
      closable={!!onCancel}
      onCancel={onCancel}
      maskClosable={false}
      className="copy-paste-progress-modal"
      width={400}
    >
      <div className="copy-paste-progress-content">
        {/* 转圈圈加载 */}
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Spin size="large" />
        </div>

        {/* 当前文件信息 */}
        <div className="copy-paste-progress-file" style={{ textAlign: 'center', marginTop: 16 }}>
          正在{operationText}: {currentFile}
        </div>

        {/* 文件计数信息 */}
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Text type="secondary">
            {currentIndex} / {totalFiles} 个文件
          </Text>
        </div>

        {/* 提示信息 */}
        {totalFiles > 1 && (
          <div style={{ marginTop: 16, fontSize: 12, color: '#666', textAlign: 'center' }}>
            正在{operationText} {totalFiles} 个文件，请稍候...
          </div>
        )}
      </div>
    </Modal>
  );
};

export default CopyPasteProgressDialog;
