import React from 'react';
import { Spin } from 'antd';
import './LoadingOverlay.css';

interface LoadingOverlayProps {
  tip?: string;
  spinning?: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ 
  tip = '加载中...',
  spinning = true 
}) => {
  console.log('LoadingOverlay render:', { tip, spinning });
  
  if (!spinning) {
    console.log('LoadingOverlay not spinning, returning null');
    return null;
  }
  
  return (
    <div className="loading-overlay">
      <div className="loading-content">
        <Spin size="large" tip={tip} />
      </div>
    </div>
  );
}; 