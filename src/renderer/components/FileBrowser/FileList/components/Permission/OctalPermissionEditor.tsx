import React from 'react';
import { Table, Checkbox, Input, Space, Typography, Tag, Divider } from 'antd';
import type { PermissionSet } from '../ContextMenu/actions/permissionAction';
import { permissionAction } from '../ContextMenu/actions/permissionAction';

const { Text, Title } = Typography;

interface OctalPermissionEditorProps {
  permissions: PermissionSet;
  octalValue: string;
  onPermissionsChange: (permissions: PermissionSet) => void;
  onOctalChange: (octal: string) => void;
}

export const OctalPermissionEditor: React.FC<OctalPermissionEditorProps> = ({
  permissions,
  octalValue,
  onPermissionsChange,
  onOctalChange
}) => {
  // 处理权限复选框变化
  const handlePermissionChange = (
    userType: 'owner' | 'group' | 'others',
    permType: 'read' | 'write' | 'execute',
    checked: boolean
  ) => {
    const newPermissions = {
      ...permissions,
      [userType]: {
        ...permissions[userType],
        [permType]: checked
      }
    };
    onPermissionsChange(newPermissions);
  };

  // 处理八进制输入变化
  const handleOctalInputChange = (value: string) => {
    // 只允许输入数字，最多4位
    const cleanValue = value.replace(/[^0-7]/g, '').slice(0, 4);
    onOctalChange(cleanValue);
  };

  // 快速设置常用权限
  const handleQuickSet = (octal: string) => {
    onOctalChange(octal);
  };

  // 权限表格数据
  const tableData = [
    {
      key: 'owner',
      user: '所有者 (Owner)',
      userType: 'owner' as const,
      description: '文件的拥有者'
    },
    {
      key: 'group',
      user: '组 (Group)',
      userType: 'group' as const,
      description: '文件所属的用户组'
    },
    {
      key: 'others',
      user: '其他 (Others)',
      userType: 'others' as const,
      description: '其他所有用户'
    }
  ];

  // 权限表格列定义
  const columns = [
    {
      title: '用户类型',
      dataIndex: 'user',
      key: 'user',
      width: 150,
      render: (text: string, record: any) => (
        <div>
          <Text strong>{text}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.description}
          </Text>
        </div>
      )
    },
    {
      title: '读 (r)',
      key: 'read',
      width: 80,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Checkbox
          checked={permissions[record.userType].read}
          onChange={(e) => handlePermissionChange(record.userType, 'read', e.target.checked)}
        />
      )
    },
    {
      title: '写 (w)',
      key: 'write',
      width: 80,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Checkbox
          checked={permissions[record.userType].write}
          onChange={(e) => handlePermissionChange(record.userType, 'write', e.target.checked)}
        />
      )
    },
    {
      title: '执行 (x)',
      key: 'execute',
      width: 80,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Checkbox
          checked={permissions[record.userType].execute}
          onChange={(e) => handlePermissionChange(record.userType, 'execute', e.target.checked)}
        />
      )
    },
    {
      title: '八进制值',
      key: 'octal',
      width: 80,
      align: 'center' as const,
      render: (_: any, record: any) => {
        const userPermissions = permissions[record.userType];
        let value = 0;
        if (userPermissions.read) value += 4;
        if (userPermissions.write) value += 2;
        if (userPermissions.execute) value += 1;
        return <Text code>{value}</Text>;
      }
    }
  ];

  // 获取常用权限预设
  const commonPermissions = permissionAction.getCommonPermissions();

  return (
    <div className="octal-permission-editor">
      {/* 权限表格 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={5}>权限设置</Title>
        <Table
          dataSource={tableData}
          columns={columns}
          pagination={false}
          size="small"
          bordered
          className="permission-table"
        />
      </div>

      {/* 八进制输入 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={5}>八进制权限值</Title>
        <Space>
          <Input
            value={octalValue}
            onChange={(e) => handleOctalInputChange(e.target.value)}
            placeholder="输入八进制权限值，如 755"
            style={{ width: 200 }}
            maxLength={4}
          />
          <Text type="secondary">
            {permissionAction.validatePermissions(octalValue, 'octal') ? 
              '✓ 格式正确' : 
              '✗ 格式错误'
            }
          </Text>
        </Space>
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            八进制权限值由3-4位数字组成，每位数字代表一种用户类型的权限
          </Text>
        </div>
      </div>

      {/* 常用权限快速设置 */}
      <div style={{ marginBottom: 16 }}>
        <Title level={5}>常用权限</Title>
        <Space wrap>
          {commonPermissions.map((preset) => (
            <Tag
              key={preset.octal}
              color={octalValue === preset.octal ? 'blue' : 'default'}
              style={{ cursor: 'pointer', marginBottom: 8 }}
              onClick={() => handleQuickSet(preset.octal)}
            >
              {preset.label}
            </Tag>
          ))}
        </Space>
        <div style={{ marginTop: 8 }}>
          {commonPermissions.map((preset) => (
            <div key={preset.octal} style={{ fontSize: '12px', color: '#666', marginBottom: 4 }}>
              <Text code>{preset.octal}</Text>: {preset.description}
            </div>
          ))}
        </div>
      </div>

      <Divider />

      {/* 权限说明 */}
      <div>
        <Title level={5}>权限说明</Title>
        <div style={{ fontSize: '12px', color: '#666' }}>
          <div style={{ marginBottom: 4 }}>
            <Text strong>读 (r, 4)</Text>: 允许读取文件内容或列出目录内容
          </div>
          <div style={{ marginBottom: 4 }}>
            <Text strong>写 (w, 2)</Text>: 允许修改文件内容或在目录中创建/删除文件
          </div>
          <div style={{ marginBottom: 4 }}>
            <Text strong>执行 (x, 1)</Text>: 允许执行文件或进入目录
          </div>
          <div style={{ marginTop: 8 }}>
            <Text type="secondary">
              八进制值是各权限数值的和，例如：读(4) + 写(2) + 执行(1) = 7
            </Text>
          </div>
        </div>
      </div>
    </div>
  );
};
