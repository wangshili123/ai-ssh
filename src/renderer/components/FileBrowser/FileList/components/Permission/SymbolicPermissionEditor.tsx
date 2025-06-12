import React, { useState } from 'react';
import { Input, Typography, Space, Tag, Alert, Divider } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import type { PermissionSet } from '../ContextMenu/actions/permissionAction';
import { permissionAction } from '../ContextMenu/actions/permissionAction';

const { Text, Title, Paragraph } = Typography;

interface SymbolicPermissionEditorProps {
  symbolicValue: string;
  onSymbolicChange: (symbolic: string) => void;
  currentPermissions: PermissionSet;
}

export const SymbolicPermissionEditor: React.FC<SymbolicPermissionEditorProps> = ({
  symbolicValue,
  onSymbolicChange,
  currentPermissions
}) => {
  const [inputValue, setInputValue] = useState(symbolicValue);

  // 处理输入变化
  const handleInputChange = (value: string) => {
    setInputValue(value);
    onSymbolicChange(value);
  };

  // 快速设置符号权限
  const handleQuickSet = (symbolic: string) => {
    setInputValue(symbolic);
    onSymbolicChange(symbolic);
  };

  // 验证符号权限格式
  const isValidSymbolic = permissionAction.validatePermissions(inputValue, 'symbolic');

  // 常用符号权限示例
  const commonSymbolicPermissions = [
    { label: 'u+x', description: '给所有者添加执行权限' },
    { label: 'g-w', description: '移除组的写权限' },
    { label: 'o=r', description: '设置其他用户只有读权限' },
    { label: 'a+r', description: '给所有用户添加读权限' },
    { label: 'u+rw', description: '给所有者添加读写权限' },
    { label: 'go-rwx', description: '移除组和其他用户的所有权限' }
  ];

  // 权限符号说明
  const permissionSymbols = [
    { symbol: 'u', description: '所有者 (user/owner)' },
    { symbol: 'g', description: '组 (group)' },
    { symbol: 'o', description: '其他用户 (others)' },
    { symbol: 'a', description: '所有用户 (all)' }
  ];

  const operationSymbols = [
    { symbol: '+', description: '添加权限' },
    { symbol: '-', description: '移除权限' },
    { symbol: '=', description: '设置权限（覆盖现有权限）' }
  ];

  const permissionTypes = [
    { symbol: 'r', description: '读权限 (read)' },
    { symbol: 'w', description: '写权限 (write)' },
    { symbol: 'x', description: '执行权限 (execute)' }
  ];

  return (
    <div className="symbolic-permission-editor">
      {/* 符号权限输入 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={5}>符号权限表达式</Title>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="输入符号权限，如 u+x, g-w, o=r"
            style={{ width: '100%' }}
            status={inputValue && !isValidSymbolic ? 'error' : undefined}
          />
          <div>
            {inputValue ? (
              <Text type={isValidSymbolic ? 'success' : 'danger'}>
                {isValidSymbolic ? '✓ 格式正确' : '✗ 格式错误'}
              </Text>
            ) : null}
          </div>
        </Space>
      </div>

      {/* 当前权限显示 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={5}>当前权限</Title>
        <div style={{ 
          padding: 16, 
          backgroundColor: '#f5f5f5', 
          borderRadius: 6,
          fontFamily: 'monospace',
          fontSize: '16px'
        }}>
          <Text code style={{ fontSize: '16px' }}>
            {permissionAction.permissionsToSymbolic(currentPermissions)}
          </Text>
          <Text type="secondary" style={{ marginLeft: 16 }}>
            ({permissionAction.permissionsToOctal(currentPermissions)})
          </Text>
        </div>
      </div>

      {/* 常用符号权限示例 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={5}>常用示例</Title>
        <Space wrap>
          {commonSymbolicPermissions.map((example) => (
            <Tag
              key={example.label}
              color={inputValue === example.label ? 'blue' : 'default'}
              style={{ cursor: 'pointer', marginBottom: 8 }}
              onClick={() => handleQuickSet(example.label)}
            >
              {example.label}
            </Tag>
          ))}
        </Space>
        <div style={{ marginTop: 12 }}>
          {commonSymbolicPermissions.map((example) => (
            <div key={example.label} style={{ fontSize: '12px', color: '#666', marginBottom: 4 }}>
              <Text code>{example.label}</Text>: {example.description}
            </div>
          ))}
        </div>
      </div>

      <Divider />

      {/* 符号权限语法说明 */}
      <div style={{ marginBottom: 16 }}>
        <Title level={5}>
          <InfoCircleOutlined style={{ marginRight: 8 }} />
          符号权限语法
        </Title>
        
        <Alert
          message="符号权限格式：[用户类型][操作符][权限类型]"
          description="例如：u+x 表示给所有者添加执行权限，g-w 表示移除组的写权限"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          {/* 用户类型 */}
          <div>
            <Text strong>用户类型</Text>
            {permissionSymbols.map((item) => (
              <div key={item.symbol} style={{ fontSize: '12px', marginTop: 4 }}>
                <Text code>{item.symbol}</Text> - {item.description}
              </div>
            ))}
          </div>

          {/* 操作符 */}
          <div>
            <Text strong>操作符</Text>
            {operationSymbols.map((item) => (
              <div key={item.symbol} style={{ fontSize: '12px', marginTop: 4 }}>
                <Text code>{item.symbol}</Text> - {item.description}
              </div>
            ))}
          </div>

          {/* 权限类型 */}
          <div>
            <Text strong>权限类型</Text>
            {permissionTypes.map((item) => (
              <div key={item.symbol} style={{ fontSize: '12px', marginTop: 4 }}>
                <Text code>{item.symbol}</Text> - {item.description}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 使用说明 */}
      <div>
        <Title level={5}>使用说明</Title>
        <div style={{ fontSize: '12px', color: '#666' }}>
          <Paragraph>
            <Text strong>基本格式：</Text> [用户类型][操作符][权限类型]
          </Paragraph>
          <Paragraph>
            <Text strong>组合使用：</Text> 可以用逗号分隔多个表达式，如：u+x,g-w,o=r
          </Paragraph>
          <Paragraph>
            <Text strong>省略用户类型：</Text> 如果省略用户类型，默认应用到所有用户 (a)
          </Paragraph>
          <Paragraph>
            <Text strong>示例：</Text>
            <br />• <Text code>u+x</Text> - 给所有者添加执行权限
            <br />• <Text code>go-w</Text> - 移除组和其他用户的写权限
            <br />• <Text code>a=r</Text> - 设置所有用户只有读权限
            <br />• <Text code>u+rw,go=r</Text> - 所有者读写，组和其他用户只读
          </Paragraph>
        </div>
      </div>
    </div>
  );
};
