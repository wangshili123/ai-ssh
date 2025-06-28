import React, { useState, useEffect, useCallback } from 'react';
import { Card, Descriptions, Table, Tag, Button, Space, Spin, message, Tooltip, Dropdown, Modal } from 'antd';
import { ReloadOutlined, StopOutlined, FileTextOutlined, DownOutlined } from '@ant-design/icons';
import { CpuProcessInfo, CpuThreadInfo } from '../../../../../types/monitor/monitor';
import { getServiceManager } from '../../../../../services/monitor/serviceManager';

interface ProcessDetailViewProps {
  process: CpuProcessInfo;
  sessionId: string;
}

export const ProcessDetailView: React.FC<ProcessDetailViewProps> = ({ 
  process, 
  sessionId 
}) => {
  const [threads, setThreads] = useState<CpuThreadInfo[]>(process.threads || []);
  const [loading, setLoading] = useState(false);
  const [detailInfo, setDetailInfo] = useState<CpuProcessInfo | null>(null);

  // 获取进程详细信息
  const fetchProcessDetail = useCallback(async () => {
    if (!process.pid) return;

    setLoading(true);
    try {
      const monitorManager = getServiceManager().getMonitorManager();
      const cpuProcessService = monitorManager.getCpuProcessService();

      const detail = await cpuProcessService.getProcessDetail(sessionId, process.pid);
      if (detail) {
        setDetailInfo(detail);
      } else {
        // 如果获取失败，使用传入的process数据
        setDetailInfo(process);
      }
    } catch (error) {
      console.error('获取进程详细信息失败:', error);
      message.error('获取进程详细信息失败');
      // 出错时使用传入的process数据
      setDetailInfo(process);
    } finally {
      setLoading(false);
    }
  }, [process.pid, process, sessionId]);

  // 获取线程信息
  const fetchThreads = useCallback(async () => {
    if (!process.pid) return;

    try {
      const monitorManager = getServiceManager().getMonitorManager();
      const cpuProcessService = monitorManager.getCpuProcessService();

      const threadList = await cpuProcessService.getProcessThreads(sessionId, process.pid);
      setThreads(threadList);
    } catch (error) {
      console.error('获取线程信息失败:', error);
      // 出错时使用传入的threads数据
      setThreads(process.threads || []);
    }
  }, [process.pid, process.threads, sessionId]);

  // 初始化时获取详细信息
  useEffect(() => {
    fetchProcessDetail();
    fetchThreads();
  }, [fetchProcessDetail, fetchThreads]);

  // 格式化进程状态
  const formatStatus = (status: string) => {
    const statusMap = {
      'R': { text: '运行', color: 'green', desc: '正在CPU上执行或等待执行' },
      'S': { text: '可中断睡眠', color: 'blue', desc: '等待事件发生，可被信号唤醒' },
      'D': { text: '不可中断睡眠', color: 'orange', desc: '等待I/O操作，不能被信号中断' },
      'Z': { text: '僵尸', color: 'red', desc: '已终止但父进程未回收' },
      'T': { text: '停止', color: 'gray', desc: '被信号停止（如Ctrl+Z）' },
      'I': { text: '空闲', color: 'cyan', desc: '内核线程空闲状态' }
    };
    const info = statusMap[status as keyof typeof statusMap] || { text: status, color: 'default', desc: '未知状态' };
    return (
      <Tooltip title={info.desc}>
        <Tag color={info.color}>{info.text}</Tag>
      </Tooltip>
    );
  };

  // 格式化内存大小
  const formatMemorySize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    } else if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    } else {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
  };

  // 线程表格列定义
  const threadColumns = [
    {
      title: 'TID',
      dataIndex: 'tid',
      key: 'tid',
      width: 80,
    },
    {
      title: '线程名',
      dataIndex: 'name',
      key: 'name',
      width: 150,
    },
    {
      title: 'CPU %',
      dataIndex: 'cpuPercent',
      key: 'cpuPercent',
      width: 100,
      render: (percent: number) => `${percent.toFixed(1)}%`,
      sorter: (a: CpuThreadInfo, b: CpuThreadInfo) => a.cpuPercent - b.cpuPercent,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => formatStatus(status),
    },
  ];

  // 处理刷新
  const handleRefresh = () => {
    fetchProcessDetail();
    fetchThreads();
  };

  // 处理终止进程
  const handleKillProcess = async (force: boolean = false) => {
    const actionText = force ? '强制终止' : '终止';

    Modal.confirm({
      title: `确认${actionText}进程`,
      content: (
        <div>
          <p>确定要{actionText}进程 "{currentProcess.name}" (PID: {currentProcess.pid}) 吗？</p>
          {force ? (
            <p style={{ color: '#ff4d4f', fontSize: '12px' }}>
              ⚠️ 强制终止将立即结束进程，可能导致数据丢失
            </p>
          ) : (
            <p style={{ color: '#1890ff', fontSize: '12px' }}>
              💡 普通终止会发送TERM信号，允许进程优雅退出
            </p>
          )}
        </div>
      ),
      okText: actionText,
      cancelText: '取消',
      okButtonProps: { danger: force },
      onOk: async () => {
        try {
          const monitorManager = getServiceManager().getMonitorManager();
          const cpuProcessService = monitorManager.getCpuProcessService();

          const result = force
            ? await cpuProcessService.forceKillProcess(sessionId, currentProcess.pid)
            : await cpuProcessService.killProcess(sessionId, currentProcess.pid);

          if (result.success) {
            message.success(result.message);
          } else {
            message.error(result.message);
          }
        } catch (error) {
          console.error('终止进程失败:', error);
          message.error('终止进程失败');
        }
      },
    });
  };

  // 处理查看文件
  const handleViewFiles = async () => {
    try {
      const monitorManager = getServiceManager().getMonitorManager();
      const cpuProcessService = monitorManager.getCpuProcessService();

      const result = await cpuProcessService.getProcessFiles(sessionId, currentProcess.pid);

      if (result.success) {
        const fileCount = result.files.length;
        const fileTypes = [...new Set(result.files.map(f => f.type))];

        Modal.info({
          title: `进程文件信息 - ${currentProcess.name} (PID: ${currentProcess.pid})`,
          width: 600,
          content: (
            <div>
              <p><strong>打开文件数量：</strong>{fileCount}</p>
              <p><strong>文件类型：</strong>{fileTypes.join(', ')}</p>
              <div style={{ marginTop: 16, maxHeight: 300, overflowY: 'auto' }}>
                <strong>文件列表：</strong>
                <ul style={{ marginTop: 8, fontSize: '12px', fontFamily: 'monospace' }}>
                  {result.files.slice(0, 20).map((file, index) => (
                    <li key={index} style={{ marginBottom: 4 }}>
                      <span style={{ color: '#1890ff' }}>[{file.fd}]</span>{' '}
                      <span style={{ color: '#52c41a' }}>{file.type}</span>{' '}
                      {file.path}
                    </li>
                  ))}
                  {result.files.length > 20 && (
                    <li style={{ color: '#999' }}>... 还有 {result.files.length - 20} 个文件</li>
                  )}
                </ul>
              </div>
            </div>
          ),
        });
      } else {
        message.error(result.message || '获取进程文件信息失败');
      }
    } catch (error) {
      console.error('获取进程文件信息失败:', error);
      message.error('获取进程文件信息失败');
    }
  };

  const currentProcess = detailInfo || process;

  return (
    <div className="process-detail-view">
      <Card 
        title={`进程详情 - ${currentProcess.name} (${currentProcess.pid})`}
        size="small"
        extra={
          <Space>
            <Button 
              size="small" 
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              loading={loading}
            >
              刷新
            </Button>
            {/* <Button
              size="small"
              icon={<FileTextOutlined />}
              onClick={handleViewFiles}
            >
              文件
            </Button> */}
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'normal',
                    label: '终止进程 (TERM)',
                    icon: <StopOutlined />,
                    onClick: () => handleKillProcess(false),
                  },
                  {
                    key: 'force',
                    label: '强制终止 (KILL)',
                    icon: <StopOutlined />,
                    danger: true,
                    onClick: () => handleKillProcess(true),
                  },
                ]
              }}
              trigger={['click']}
            >
              <Button
                size="small"
                danger
                icon={<StopOutlined />}
              >
                终止 <DownOutlined />
              </Button>
            </Dropdown>
          </Space>
        }
      >
        <Spin spinning={loading}>
          {/* 基本信息 */}
          <div className="process-basic-info">
            <Descriptions 
              title="基本信息" 
              size="small" 
              column={2}
              bordered
            >
              <Descriptions.Item label="进程ID">{currentProcess.pid}</Descriptions.Item>
              <Descriptions.Item label="进程名">{currentProcess.name}</Descriptions.Item>
              <Descriptions.Item label="用户">{currentProcess.user}</Descriptions.Item>
              <Descriptions.Item label="状态">{formatStatus(currentProcess.status)}</Descriptions.Item>
              <Descriptions.Item label="CPU使用率">{currentProcess.cpuPercent.toFixed(1)}%</Descriptions.Item>
              <Descriptions.Item label="内存使用">{formatMemorySize(currentProcess.memoryUsed)}</Descriptions.Item>
              <Descriptions.Item label="内存占比">{currentProcess.memoryPercent.toFixed(1)}%</Descriptions.Item>
              <Descriptions.Item label="启动时间">{currentProcess.startTime}</Descriptions.Item>
              <Descriptions.Item label="优先级">{currentProcess.priority}</Descriptions.Item>
              <Descriptions.Item label="Nice值">{currentProcess.nice}</Descriptions.Item>
              <Descriptions.Item label="命令行" span={2}>
                <div className="command-line" title={currentProcess.command}>
                  {currentProcess.command}
                </div>
              </Descriptions.Item>
            </Descriptions>
          </div>

          {/* 线程信息 */}
          <div className="process-threads" style={{ marginTop: 16 }}>
            <Card 
              title={`线程信息 (${threads.length})`}
              size="small"
            >
              {threads.length > 0 ? (
                <Table
                  columns={threadColumns}
                  dataSource={threads}
                  rowKey="tid"
                  size="small"
                  pagination={false}
                  scroll={{ y: 200 }}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                  暂无线程信息
                </div>
              )}
            </Card>
          </div>
        </Spin>
      </Card>
    </div>
  );
};
