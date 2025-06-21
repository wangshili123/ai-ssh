/**
 * 最小化的进度指示器
 */

import React from 'react';
import { Card, Spin, Typography } from 'antd';
import { CopyOutlined, ScissorOutlined, ExpandOutlined } from '@ant-design/icons';

const { Text } = Typography;

export interface MinimizedProgressIndicatorProps {
  visible: boolean;
  operation: 'copy' | 'cut';
  currentFile: string;
  totalFiles: number;
  currentIndex: number;
  onExpand: () => void;
}

export const MinimizedProgressIndicator: React.FC<MinimizedProgressIndicatorProps> = ({
  visible,
  operation,
  currentFile,
  totalFiles,
  currentIndex,
  onExpand
}) => {
  const operationText = operation === 'copy' ? '复制' : '剪切';
  const operationIcon = operation === 'copy' ? <CopyOutlined /> : <ScissorOutlined />;

  if (!visible) return null;

  return (
    <Card
      className="minimized-progress-indicator"
      size="small"
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        width: 280,
        zIndex: 1000,
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        borderRadius: 8
      }}
      onClick={onExpand}
      hoverable
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* 转圈圈 */}
        <Spin size="small" />
        
        {/* 操作图标 */}
        <div style={{ color: operation === 'copy' ? '#1890ff' : '#ff7a00' }}>
          {operationIcon}
        </div>
        
        {/* 信息 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ 
            fontSize: 13, 
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {operationText}中: {currentFile}
          </div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
            {currentIndex} / {totalFiles} 个文件
          </div>
        </div>
        
        {/* 展开按钮 */}
        <div style={{ color: '#666' }}>
          <ExpandOutlined />
        </div>
      </div>
    </Card>
  );
};

export default MinimizedProgressIndicator;
