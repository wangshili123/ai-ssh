import React from 'react';
import { Spin } from 'antd';
import './DetailLoadingOverlay.css';

interface DetailLoadingOverlayProps {
  tip?: string;
  spinning?: boolean;
}

export const DetailLoadingOverlay: React.FC<DetailLoadingOverlayProps> = ({ 
  tip = '加载中...',
  spinning = true 
}) => {
  if (!spinning) {
    return null;
  }
  
  return (
    <div className="detail-loading-overlay">
      <div className="detail-loading-content">
        <Spin size="large" tip={tip} />
      </div>
    </div>
  );
}; 