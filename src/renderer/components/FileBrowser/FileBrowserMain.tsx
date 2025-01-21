import React from 'react';
import { SessionInfo } from '../../types';
import { Breadcrumb, Button, Input, Select, Table } from 'antd';
import { 
  ArrowLeftOutlined, 
  ArrowRightOutlined, 
  ReloadOutlined,
  FolderOutlined,
  FileOutlined,
  SearchOutlined,
  UnorderedListOutlined,
  AppstoreOutlined
} from '@ant-design/icons';
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
  if (!sessionInfo) {
    return null;
  }

  // 生成完整的shellId
  const shellId = sessionInfo.id + (sessionInfo.instanceId ? `-${sessionInfo.instanceId}` : '');

  return (
    <div className="file-browser-main">
      {/* 导航栏 */}
      <div className="file-browser-navbar">
        <div className="nav-controls">
          <Button icon={<ArrowLeftOutlined />} />
          <Button icon={<ArrowRightOutlined />} />
          <Button icon={<ReloadOutlined />} />
        </div>
        <Breadcrumb className="nav-breadcrumb">
          <Breadcrumb.Item><FolderOutlined /> Home</Breadcrumb.Item>
          <Breadcrumb.Item><FolderOutlined /> Documents</Breadcrumb.Item>
        </Breadcrumb>
        <Input 
          prefix={<SearchOutlined />}
          placeholder="搜索文件..."
          className="nav-search"
        />
      </div>

      {/* 工具栏 */}
      <div className="file-browser-toolbar">
        <div className="toolbar-left">
          <Button>新建</Button>
          <Button>复制</Button>
          <Button>粘贴</Button>
          <Button>删除</Button>
          <Button>重命名</Button>
        </div>
        <div className="toolbar-right">
          <Select defaultValue="list" style={{ width: 100 }}>
            <Select.Option value="list"><UnorderedListOutlined /> 列表</Select.Option>
            <Select.Option value="grid"><AppstoreOutlined /> 网格</Select.Option>
          </Select>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="file-browser-content">
        {/* 侧边栏 */}
        <div className="content-sidebar">
          <div className="sidebar-section">
            <div className="sidebar-title">快速访问</div>
            <div className="sidebar-item">
              <FolderOutlined /> 桌面
            </div>
            <div className="sidebar-item">
              <FolderOutlined /> 下载
            </div>
            <div className="sidebar-item">
              <FolderOutlined /> 文档
            </div>
          </div>
        </div>

        {/* 文件列表 */}
        <div className="content-files">
          <Table 
            size="small"
            columns={[
              { title: '名称', dataIndex: 'name', key: 'name' },
              { title: '修改日期', dataIndex: 'modifiedTime', key: 'modifiedTime' },
              { title: '类型', dataIndex: 'type', key: 'type' },
              { title: '大小', dataIndex: 'size', key: 'size' },
            ]}
            dataSource={[]}
            pagination={false}
          />
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
