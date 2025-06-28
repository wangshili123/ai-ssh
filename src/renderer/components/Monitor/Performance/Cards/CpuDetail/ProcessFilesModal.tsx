import React, { useState, useEffect } from 'react';
import { Modal, Table, message, Spin, Tag, Button, Space } from 'antd';
import { ReloadOutlined, FileOutlined, FolderOutlined, LinkOutlined } from '@ant-design/icons';
import { getServiceManager } from '../../../../../services/monitor/serviceManager';

interface ProcessFile {
  fd: string;
  type: string;
  path: string;
  mode: string;
}

interface ProcessFilesModalProps {
  visible: boolean;
  onClose: () => void;
  processName: string;
  pid: number;
  sessionId: string;
}

export const ProcessFilesModal: React.FC<ProcessFilesModalProps> = ({
  visible,
  onClose,
  processName,
  pid,
  sessionId
}) => {
  const [files, setFiles] = useState<ProcessFile[]>([]);
  const [loading, setLoading] = useState(false);

  // 获取进程文件列表
  const fetchProcessFiles = async () => {
    if (!visible || !pid) return;
    
    setLoading(true);
    try {
      const monitorManager = getServiceManager().getMonitorManager();
      const cpuProcessService = monitorManager.getCpuProcessService();
      
      const result = await cpuProcessService.getProcessFiles(sessionId, pid);
      
      if (result.success) {
        setFiles(result.files);
      } else {
        message.error(result.message || '获取进程文件列表失败');
        setFiles([]);
      }
    } catch (error) {
      console.error('获取进程文件列表失败:', error);
      message.error('获取进程文件列表失败');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  // 当Modal显示时获取文件列表
  useEffect(() => {
    if (visible) {
      fetchProcessFiles();
    }
  }, [visible, pid, sessionId]);

  // 格式化文件类型
  const formatFileType = (type: string) => {
    const typeMap: { [key: string]: { text: string; color: string; icon: React.ReactNode } } = {
      'REG': { text: '普通文件', color: 'blue', icon: <FileOutlined /> },
      'DIR': { text: '目录', color: 'green', icon: <FolderOutlined /> },
      'CHR': { text: '字符设备', color: 'orange', icon: <FileOutlined /> },
      'BLK': { text: '块设备', color: 'red', icon: <FileOutlined /> },
      'FIFO': { text: '管道', color: 'purple', icon: <LinkOutlined /> },
      'LINK': { text: '链接', color: 'cyan', icon: <LinkOutlined /> },
      'sock': { text: '套接字', color: 'magenta', icon: <LinkOutlined /> },
      'IPv4': { text: 'IPv4套接字', color: 'geekblue', icon: <LinkOutlined /> },
      'IPv6': { text: 'IPv6套接字', color: 'geekblue', icon: <LinkOutlined /> },
      'unix': { text: 'Unix套接字', color: 'lime', icon: <LinkOutlined /> }
    };

    const info = typeMap[type] || { text: type, color: 'default', icon: <FileOutlined /> };
    
    return (
      <Space size="small">
        {info.icon}
        <Tag color={info.color}>{info.text}</Tag>
      </Space>
    );
  };

  // 格式化文件描述符
  const formatFileDescriptor = (fd: string) => {
    const fdMap: { [key: string]: { text: string; color: string } } = {
      '0': { text: '标准输入', color: 'blue' },
      '1': { text: '标准输出', color: 'green' },
      '2': { text: '标准错误', color: 'red' },
      'cwd': { text: '当前目录', color: 'purple' },
      'rtd': { text: '根目录', color: 'orange' },
      'txt': { text: '程序文本', color: 'cyan' },
      'mem': { text: '内存映射', color: 'magenta' }
    };

    const info = fdMap[fd] || { text: fd, color: 'default' };
    
    return <Tag color={info.color}>{info.text}</Tag>;
  };

  // 表格列定义
  const columns = [
    {
      title: '文件描述符',
      dataIndex: 'fd',
      key: 'fd',
      width: 120,
      render: (fd: string) => formatFileDescriptor(fd),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 150,
      render: (type: string) => formatFileType(type),
    },
    {
      title: '模式',
      dataIndex: 'mode',
      key: 'mode',
      width: 100,
      render: (mode: string) => mode || '-',
    },
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path',
      ellipsis: true,
      render: (path: string) => (
        <span 
          title={path}
          style={{ 
            fontFamily: 'Consolas, Monaco, monospace',
            fontSize: '12px'
          }}
        >
          {path}
        </span>
      ),
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <FileOutlined />
          <span>进程文件 - {processName} (PID: {pid})</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="refresh" icon={<ReloadOutlined />} onClick={fetchProcessFiles} loading={loading}>
          刷新
        </Button>,
        <Button key="close" onClick={onClose}>
          关闭
        </Button>
      ]}
    >
      <Spin spinning={loading}>
        <div style={{ marginBottom: 16 }}>
          <span style={{ color: '#666', fontSize: '12px' }}>
            显示进程打开的文件、套接字和其他资源。需要适当权限才能查看完整信息。
          </span>
        </div>
        
        <Table
          columns={columns}
          dataSource={files}
          rowKey={(record, index) => `${record.fd}-${record.path}-${index}`}
          size="small"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 个文件`
          }}
          scroll={{ y: 400 }}
          locale={{
            emptyText: loading ? '加载中...' : '暂无文件信息'
          }}
        />
      </Spin>
    </Modal>
  );
};
