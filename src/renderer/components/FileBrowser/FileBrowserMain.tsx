import React, { useState } from 'react';
import { SessionInfo } from '../../types';
import { Tree, Table, Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { 
  ArrowLeftOutlined, 
  ArrowRightOutlined, 
  ReloadOutlined,
  FolderOutlined,
  FileOutlined,
} from '@ant-design/icons';
import DirectoryTreeComponent from './DirectoryTree/DirectoryTreeComponent';
import './FileBrowserMain.css';

interface FileBrowserMainProps {
  /**
   * 当前会话信息
   */
  sessionInfo?: SessionInfo & {
    instanceId?: string;  // 添加instanceId
  };
}

/**
 * 文件浏览器主组件
 */
const FileBrowserMain: React.FC<FileBrowserMainProps> = ({
  sessionInfo
}) => {
  // 当前选中的路径
  const [currentPath, setCurrentPath] = useState('/');

  if (!sessionInfo) {
    return null;
  }

  // 生成完整的shellId
  const shellId = sessionInfo.id + (sessionInfo.instanceId ? `-${sessionInfo.instanceId}` : '');
  
  // 右键菜单项
  const contextMenuItems: MenuProps['items'] = [
    {
      key: 'open',
      label: '打开',
    },
    {
      type: 'divider',
    },
    {
      key: 'copy',
      label: '复制',
    },
    {
      key: 'cut',
      label: '剪切',
    },
    {
      key: 'paste',
      label: '粘贴',
    },
    {
      type: 'divider',
    },
    {
      key: 'rename',
      label: '重命名',
    },
    {
      key: 'delete',
      label: '删除',
    },
    {
      type: 'divider',
    },
    {
      key: 'properties',
      label: '属性',
    },
  ];

  // 文件列表列定义
  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: any) => (
        <span>
          {record.isDirectory ? <FolderOutlined /> : <FileOutlined />}
          <span style={{ marginLeft: 8 }}>{text}</span>
        </span>
      ),
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 100,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
    },
    {
      title: '修改时间',
      dataIndex: 'modifiedTime',
      key: 'modifiedTime',
      width: 150,
    },
    {
      title: '权限',
      dataIndex: 'permissions',
      key: 'permissions',
      width: 100,
    },
    {
      title: '用户/用户组',
      dataIndex: 'owner',
      key: 'owner',
      width: 150,
    },
  ];

  // 处理目录选择
  const handleDirectorySelect = (path: string) => {
    setCurrentPath(path);
  };

  return (
    <div className="file-browser-main">
      {/* 顶部导航 */}
      <div className="file-browser-navbar">
        <div className="nav-controls">
          <Button icon={<ArrowLeftOutlined />} />
          <Button icon={<ArrowRightOutlined />} />
          <Button icon={<ReloadOutlined />} />
        </div>
        <div className="nav-path">
          {currentPath}
        </div>
      </div>

      {/* 主内容区 */}
      <div className="file-browser-content">
        {/* 目录树 */}
        <div className="content-tree">
          <DirectoryTreeComponent
            sessionId={shellId}
            onSelect={handleDirectorySelect}
          />
        </div>

        {/* 文件列表 */}
        <div className="content-files">
          <Dropdown menu={{ items: contextMenuItems }} trigger={['contextMenu']}>
            <div style={{ height: '100%' }}>
              <Table 
                size="small"
                columns={columns}
                dataSource={[]}
                pagination={false}
                rowSelection={{
                  type: 'checkbox',
                }}
              />
            </div>
          </Dropdown>
        </div>
      </div>

      {/* 状态栏 */}
      <div className="file-browser-statusbar">
        <div className="status-left">0 个项目</div>
        <div className="status-right">
          {sessionInfo.username}@{sessionInfo.host}
        </div>
      </div>
    </div>
  );
};

export default FileBrowserMain;
