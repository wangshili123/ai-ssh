import React from 'react';
import { Button, Input } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, ReloadOutlined } from '@ant-design/icons';
import './Navigation.css';

export interface NavigationProps {
  currentPath: string;
  onPathChange: (path: string) => void;
  loading?: boolean;
}

const Navigation: React.FC<NavigationProps> = ({
  currentPath,
  onPathChange,
  loading = false
}) => {
  return (
    <div className="navigation-bar">
      <div className="navigation-buttons">
        <Button
          icon={<ArrowLeftOutlined />}
          disabled={loading}
          onClick={() => {/* TODO: 实现后退功能 */}}
        />
        <Button
          icon={<ArrowRightOutlined />}
          disabled={loading}
          onClick={() => {/* TODO: 实现前进功能 */}}
        />
        <Button
          icon={<ReloadOutlined />}
          disabled={loading}
          onClick={() => onPathChange(currentPath)}
        />
      </div>
      <Input
        className="path-input"
        value={currentPath}
        onChange={(e) => onPathChange(e.target.value)}
        disabled={loading}
      />
    </div>
  );
};

export default Navigation; 