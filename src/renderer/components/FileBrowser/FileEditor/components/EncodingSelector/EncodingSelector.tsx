/**
 * 编码选择器组件
 * 允许用户选择文件编码
 */

import React, { FC, useState } from 'react';
import { Select, Button, Tooltip, Space } from 'antd';
import { SettingOutlined, FileSearchOutlined } from '@ant-design/icons';
import { COMMON_ENCODINGS, ALL_ENCODINGS } from '../../core/EncodingManager';
import './EncodingSelectorStyles.css';

const { Option, OptGroup } = Select;

export interface EncodingSelectorProps {
  /**
   * 当前选中的编码
   */
  value?: string;
  /**
   * 编码变更回调
   */
  onChange?: (encoding: string) => void;
  /**
   * 检测编码回调
   */
  onDetect?: () => void;
  /**
   * 是否禁用
   */
  disabled?: boolean;
  /**
   * 是否显示检测按钮
   */
  showDetectButton?: boolean;
  /**
   * 组件宽度
   */
  width?: number | string;
  /**
   * 自定义类名
   */
  className?: string;
}

/**
 * 文件编码选择器组件
 * 
 * 用于选择文件编码，支持常用编码和所有编码的选择，还可以进行编码自动检测
 */
const EncodingSelector: FC<EncodingSelectorProps> = ({
  value = 'utf8',
  onChange,
  onDetect,
  disabled = false,
  showDetectButton = true,
  width = 150,
  className = ''
}) => {
  // 是否显示所有编码
  const [showAllEncodings, setShowAllEncodings] = useState(false);

  // 切换编码显示模式
  const toggleEncodingMode = () => {
    setShowAllEncodings(!showAllEncodings);
  };

  // 处理编码变更
  const handleEncodingChange = (newEncoding: string) => {
    if (onChange) {
      onChange(newEncoding);
    }
  };

  // 处理编码检测
  const handleDetect = () => {
    if (onDetect) {
      onDetect();
    }
  };

  return (
    <div className={`encoding-selector ${className}`}>
      <Space>
        <Select
          value={value}
          onChange={handleEncodingChange}
          style={{ width }}
          disabled={disabled}
          dropdownMatchSelectWidth={false}
          dropdownClassName="encoding-dropdown"
        >
          <OptGroup label="常用编码">
            {COMMON_ENCODINGS.map(encoding => (
              <Option key={encoding} value={encoding}>
                {encoding}
              </Option>
            ))}
          </OptGroup>

          {showAllEncodings && (
            <OptGroup label="所有编码">
              {ALL_ENCODINGS.filter(encoding => !COMMON_ENCODINGS.includes(encoding)).map(encoding => (
                <Option key={encoding} value={encoding}>
                  {encoding}
                </Option>
              ))}
            </OptGroup>
          )}
        </Select>

        <Tooltip title="显示更多编码">
          <Button
            type="text"
            icon={<SettingOutlined />}
            onClick={toggleEncodingMode}
            disabled={disabled}
            size="small"
          />
        </Tooltip>

        {showDetectButton && (
          <Tooltip title="自动检测编码">
            <Button
              type="text"
              icon={<FileSearchOutlined />}
              onClick={handleDetect}
              disabled={disabled}
              size="small"
            />
          </Tooltip>
        )}
      </Space>
    </div>
  );
};

export default EncodingSelector; 