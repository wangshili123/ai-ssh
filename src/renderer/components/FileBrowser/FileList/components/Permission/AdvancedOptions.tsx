import React from 'react';
import { Checkbox, Space, Typography, Alert, Divider } from 'antd';
import { SettingOutlined, FolderOutlined, FileOutlined, WarningOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

interface AdvancedOptionsProps {
  recursive: boolean;
  applyToFiles: boolean;
  applyToDirectories: boolean;
  hasDirectories: boolean;
  onChange: (options: {
    recursive: boolean;
    applyToFiles: boolean;
    applyToDirectories: boolean;
  }) => void;
}

export const AdvancedOptions: React.FC<AdvancedOptionsProps> = ({
  recursive,
  applyToFiles,
  applyToDirectories,
  hasDirectories,
  onChange
}) => {
  // 处理选项变化
  const handleOptionChange = (option: string, checked: boolean) => {
    const newOptions = {
      recursive,
      applyToFiles,
      applyToDirectories
    };

    switch (option) {
      case 'recursive':
        newOptions.recursive = checked;
        break;
      case 'applyToFiles':
        newOptions.applyToFiles = checked;
        // 如果选择了仅文件，取消仅目录选项
        if (checked) {
          newOptions.applyToDirectories = false;
        }
        break;
      case 'applyToDirectories':
        newOptions.applyToDirectories = checked;
        // 如果选择了仅目录，取消仅文件选项
        if (checked) {
          newOptions.applyToFiles = false;
        }
        break;
    }

    onChange(newOptions);
  };

  // 检查是否有冲突的选项组合
  const hasConflictingOptions = () => {
    return applyToFiles && applyToDirectories;
  };

  // 检查是否有危险的递归操作
  const hasDangerousRecursive = () => {
    return recursive && hasDirectories && !applyToFiles && !applyToDirectories;
  };

  return (
    <div className="advanced-options">
      <Title level={5}>
        <SettingOutlined style={{ marginRight: 8 }} />
        高级选项
      </Title>

      <Space direction="vertical" style={{ width: '100%' }}>
        {/* 递归选项 */}
        {hasDirectories ? (
          <div>
            <Checkbox
              checked={recursive}
              onChange={(e) => handleOptionChange('recursive', e.target.checked)}
            >
              <Space>
                <FolderOutlined />
                <Text>递归应用到子目录和文件</Text>
              </Space>
            </Checkbox>
            <div style={{ marginLeft: 24, marginTop: 4 }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                将权限设置应用到选中目录内的所有子目录和文件
              </Text>
            </div>
          </div>
        ) : null}

        <Divider style={{ margin: '12px 0' }} />

        {/* 应用范围选项 */}
        <div>
          <Text strong style={{ marginBottom: 8, display: 'block' }}>应用范围</Text>
          
          <Space direction="vertical">
            <Checkbox
              checked={applyToFiles}
              onChange={(e) => handleOptionChange('applyToFiles', e.target.checked)}
            >
              <Space>
                <FileOutlined />
                <Text>仅应用到文件</Text>
              </Space>
            </Checkbox>
            
            <Checkbox
              checked={applyToDirectories}
              onChange={(e) => handleOptionChange('applyToDirectories', e.target.checked)}
            >
              <Space>
                <FolderOutlined />
                <Text>仅应用到目录</Text>
              </Space>
            </Checkbox>
          </Space>

          <div style={{ marginLeft: 0, marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {!applyToFiles && !applyToDirectories ?
                '默认：应用到所有选中的文件和目录' :
                applyToFiles && !applyToDirectories ?
                '只修改文件的权限，忽略目录' :
                !applyToFiles && applyToDirectories ?
                '只修改目录的权限，忽略文件' : ''
              }
            </Text>
          </div>
        </div>
      </Space>

      {/* 警告信息 */}
      {hasConflictingOptions() ? (
        <Alert
          message="选项冲突"
          description="不能同时选择「仅应用到文件」和「仅应用到目录」选项。"
          type="error"
          showIcon
          style={{ marginTop: 16 }}
        />
      ) : null}

      {hasDangerousRecursive() ? (
        <Alert
          message="递归操作警告"
          description="递归权限修改将影响目录内的所有文件和子目录，请谨慎操作。"
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginTop: 16 }}
        />
      ) : null}

      {/* 选项说明 */}
      <div style={{ marginTop: 16 }}>
        <Title level={5}>选项说明</Title>
        <div style={{ fontSize: '12px', color: '#666' }}>
          <div style={{ marginBottom: 8 }}>
            <Text strong>递归应用：</Text>
            <br />
            • 选中时：权限设置会应用到目录内的所有子目录和文件
            <br />
            • 未选中时：只修改直接选中的文件和目录
          </div>
          
          <div style={{ marginBottom: 8 }}>
            <Text strong>仅应用到文件：</Text>
            <br />
            • 只修改文件的权限，跳过所有目录
            <br />
            • 对于选中的目录，会使用 find 命令查找其中的文件
          </div>
          
          <div style={{ marginBottom: 8 }}>
            <Text strong>仅应用到目录：</Text>
            <br />
            • 只修改目录的权限，跳过所有文件
            <br />
            • 结合递归选项可以修改所有子目录的权限
          </div>

          <div style={{ marginTop: 12, padding: 8, backgroundColor: '#f0f0f0', borderRadius: 4 }}>
            <Text strong>使用建议：</Text>
            <br />
            • 对于目录，通常设置 755 (rwxr-xr-x) 权限
            <br />
            • 对于文件，通常设置 644 (rw-r--r--) 权限
            <br />
            • 可执行文件通常设置 755 (rwxr-xr-x) 权限
          </div>
        </div>
      </div>
    </div>
  );
};
