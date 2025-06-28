import React, { useState, useCallback, useMemo } from 'react';
import { Table, Button, Space, Empty, Progress, Tag, Tooltip, Modal, message, Card, Dropdown } from 'antd';
import { ReloadOutlined, SettingOutlined, InfoCircleOutlined, StopOutlined, DownOutlined, FileTextOutlined } from '@ant-design/icons';
import { CpuDetailInfo, CpuProcessInfo, CpuThreadInfo } from '../../../../../types/monitor/monitor';
import { ProcessDetailView } from './ProcessDetailView';
import { getServiceManager } from '../../../../../services/monitor/serviceManager';
import './CpuProcessAnalysis.css';

interface CpuProcessAnalysisProps {
  cpuInfo: CpuDetailInfo;
  sessionId: string;
}

export const CpuProcessAnalysis: React.FC<CpuProcessAnalysisProps> = ({
  cpuInfo,
  sessionId
}) => {
  const [selectedProcess, setSelectedProcess] = useState<CpuProcessInfo | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // 获取进程分析数据
  const processAnalysis = cpuInfo.processAnalysis;

  // 处理进程选择
  const handleProcessSelect = useCallback((process: CpuProcessInfo) => {
    setSelectedProcess(process);
  }, []);

  // 处理刷新
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    // 刷新逻辑由父组件的监控管理器处理
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  // 处理设置
  const handleSettings = useCallback(() => {
    Modal.info({
      title: '进程监控设置',
      content: (
        <div>
          <p>• 自动刷新间隔：3秒</p>
          <p>• 显示进程数量：前15个</p>
          <p>• 排序方式：按CPU使用率降序</p>
        </div>
      ),
    });
  }, []);

  // 处理终止进程
  const handleKillProcess = useCallback(async (pid: number, name: string, force: boolean = false) => {
    const actionText = force ? '强制终止' : '终止';

    Modal.confirm({
      title: `确认${actionText}进程`,
      content: (
        <div>
          <p>确定要{actionText}进程 "{name}" (PID: {pid}) 吗？</p>
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
            ? await cpuProcessService.forceKillProcess(sessionId, pid)
            : await cpuProcessService.killProcess(sessionId, pid);

          if (result.success) {
            message.success(result.message);
            // 刷新进程列表
            handleRefresh();
          } else {
            message.error(result.message);
          }
        } catch (error) {
          console.error('终止进程失败:', error);
          message.error('终止进程失败');
        }
      },
    });
  }, [sessionId, handleRefresh]);

  // 处理查看文件
  const handleViewFiles = useCallback(async (pid: number, name: string) => {
    try {
      const monitorManager = getServiceManager().getMonitorManager();
      const cpuProcessService = monitorManager.getCpuProcessService();

      const result = await cpuProcessService.getProcessFiles(sessionId, pid);

      if (result.success) {
        const fileCount = result.files.length;
        const fileTypes = [...new Set(result.files.map(f => f.type))];

        Modal.info({
          title: `进程文件信息 - ${name} (PID: ${pid})`,
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
  }, [sessionId]);

  // 格式化进程状态
  const formatProcessStatus = useCallback((status: string) => {
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
  }, []);

  // 格式化内存大小
  const formatMemorySize = useCallback((bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    } else if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    } else {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
  }, []);

  // 表格列定义
  const columns = useMemo(() => [
    {
      title: 'PID',
      dataIndex: 'pid',
      key: 'pid',
      width: 80,
      sorter: (a: CpuProcessInfo, b: CpuProcessInfo) => a.pid - b.pid,
    },
    {
      title: '进程名',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (name: string, record: CpuProcessInfo) => (
        <Tooltip title={record.command} placement="topLeft">
          <span className="process-name">{name}</span>
        </Tooltip>
      ),
    },
    {
      title: 'CPU %',
      dataIndex: 'cpuPercent',
      key: 'cpuPercent',
      width: 120,
      sorter: (a: CpuProcessInfo, b: CpuProcessInfo) => a.cpuPercent - b.cpuPercent,
      render: (percent: number) => (
        <div className="cpu-progress">
          <Progress 
            percent={Math.min(percent, 100)} 
            size="small" 
            format={(percent) => `${percent?.toFixed(1)}%`}
            strokeColor={percent > 80 ? '#ff4d4f' : percent > 50 ? '#faad14' : '#52c41a'}
          />
        </div>
      ),
    },
    {
      title: '内存',
      dataIndex: 'memoryUsed',
      key: 'memoryUsed',
      width: 100,
      sorter: (a: CpuProcessInfo, b: CpuProcessInfo) => a.memoryUsed - b.memoryUsed,
      render: (memory: number, record: CpuProcessInfo) => (
        <div>
          <div>{formatMemorySize(memory)}</div>
          <div className="memory-percent">{record.memoryPercent.toFixed(1)}%</div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => formatProcessStatus(status),
    },
    {
      title: '用户',
      dataIndex: 'user',
      key: 'user',
      width: 100,
    },
    {
      title: '启动时间',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 100,
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_: any, record: CpuProcessInfo) => {
        const killMenuItems = [
          {
            key: 'normal',
            label: '终止进程 (TERM)',
            icon: <StopOutlined />,
            onClick: () => handleKillProcess(record.pid, record.name, false),
          },
          {
            key: 'force',
            label: '强制终止 (KILL)',
            icon: <StopOutlined />,
            danger: true,
            onClick: () => handleKillProcess(record.pid, record.name, true),
          },
        ];

        return (
          <Space size="small">
            <Tooltip title="查看详情">
              <Button
                type="text"
                size="small"
                icon={<InfoCircleOutlined />}
                onClick={() => handleProcessSelect(record)}
              />
            </Tooltip>
            <Tooltip title="查看文件">
              <Button
                type="text"
                size="small"
                icon={<FileTextOutlined />}
                onClick={() => handleViewFiles(record.pid, record.name)}
              />
            </Tooltip>
            <Dropdown
              menu={{ items: killMenuItems }}
              trigger={['click']}
              placement="bottomRight"
            >
              <Button
                type="text"
                size="small"
                danger
                icon={<StopOutlined />}
              />
            </Dropdown>
          </Space>
        );
      },
    },
  ], [formatProcessStatus, formatMemorySize, handleProcessSelect, handleKillProcess]);

  // 如果没有安装必要工具
  if (processAnalysis && !processAnalysis.isToolInstalled) {
    return (
      <div className="cpu-process-analysis">
        <div className="tool-not-installed">
          <Empty 
            description="系统缺少必要的监控工具，无法获取进程信息"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="cpu-process-analysis">
      <div className="process-list-panel">
        <Card
          title={
            <div className="card-header">
              <span>CPU占用TOP进程</span>
              {processAnalysis && (
                <div className="process-stats">
                  <span>总进程: {processAnalysis.totalProcesses}</span>
                  <span>运行中: {processAnalysis.runningProcesses}</span>
                </div>
              )}
            </div>
          }
          size="small"
          extra={
            <Space>
              <Button
                size="small"
                icon={<ReloadOutlined />}
                loading={refreshing}
                onClick={handleRefresh}
              >
                刷新
              </Button>
              <Button
                size="small"
                icon={<SettingOutlined />}
                onClick={handleSettings}
              >
                设置
              </Button>
            </Space>
          }
        >
          <div className="table-container">
          <Table
            columns={columns}
            dataSource={processAnalysis?.topProcesses || []}
            rowKey="pid"
            size="small"
            pagination={false}
            scroll={{ y: 'calc(100vh - 350px)' }}
            loading={!processAnalysis}
            onRow={(record) => ({
              onClick: () => handleProcessSelect(record),
              className: selectedProcess?.pid === record.pid ? 'selected-row' : '',
            })}
            locale={{
              emptyText: processAnalysis ? '暂无进程数据' : '加载中...'
            }}
          />
          </div>
        </Card>
      </div>

      <div className="process-detail-panel">
        {selectedProcess ? (
          <ProcessDetailView 
            process={selectedProcess}
            sessionId={sessionId}
          />
        ) : (
          <div className="no-selection">
            <Empty 
              description="请选择一个进程查看详情"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </div>
        )}
      </div>
    </div>
  );
};
