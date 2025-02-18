import React, { useEffect, useRef, useMemo } from 'react';
import { Table, Card, Alert } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import * as echarts from 'echarts';
import { NetworkDetailInfo } from '../../../../../types/monitor';
import { formatBytes } from '../../../../../utils/format';

interface NetworkProcessesProps {
  networkInfo: NetworkDetailInfo;
}

interface ProcessTableItem {
  key: string;
  pid: number;
  name: string;
  command: string;
  rxSpeed: number;
  txSpeed: number;
  totalBytes: number;
  connections: number;
}

export const NetworkProcesses: React.FC<NetworkProcessesProps> = React.memo(({ networkInfo }) => {

  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts>();

  const columns: ColumnsType<ProcessTableItem> = useMemo(() => [
    {
      title: '进程',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: ProcessTableItem) => (
        <span title={record.command}>{text}</span>
      ),
    },
    {
      title: 'PID',
      dataIndex: 'pid',
      key: 'pid',
      width: 100,
    },
    {
      title: '下载速度',
      dataIndex: 'rxSpeed',
      key: 'rxSpeed',
      width: 120,
      render: (value: number) => formatBytes(value) + '/s',
      sorter: (a, b) => a.rxSpeed - b.rxSpeed,
    },
    {
      title: '上传速度',
      dataIndex: 'txSpeed',
      key: 'txSpeed',
      width: 120,
      render: (value: number) => formatBytes(value) + '/s',
      sorter: (a, b) => a.txSpeed - b.txSpeed,
    },
    {
      title: '总流量',
      dataIndex: 'totalBytes',
      key: 'totalBytes',
      width: 120,
      render: (value: number) => formatBytes(value),
      sorter: (a, b) => a.totalBytes - b.totalBytes,
    },
    {
      title: '连接数',
      dataIndex: 'connections',
      key: 'connections',
      width: 100,
      sorter: (a, b) => a.connections - b.connections,
    },
  ], []);

  const data: ProcessTableItem[] = useMemo(() => 
    networkInfo.processes.list.map((proc, index) => ({
      key: `${index}`,
      ...proc
    })),
    [networkInfo.processes.list]
  );

  const getChartOption = useMemo(() => {
    // 计算总带宽使用
    const totalBandwidth = networkInfo.processes.list.reduce(
      (sum, proc) => sum + proc.rxSpeed + proc.txSpeed,
      0
    );

    // 准备饼图数据
    const pieData = networkInfo.processes.list
      .map(proc => ({
        name: proc.name,
        value: proc.rxSpeed + proc.txSpeed,
        itemStyle: {
          opacity: 0.8
        }
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // 只显示前10个进程

    return {
      title: {
        text: '进程带宽占用',
        left: 'center'
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const percentage = ((params.value / totalBandwidth) * 100).toFixed(1);
          return `${params.name}<br/>
            带宽: ${formatBytes(params.value)}/s<br/>
            占比: ${percentage}%`;
        }
      },
      legend: {
        type: 'scroll',
        orient: 'vertical',
        right: 10,
        top: 20,
        bottom: 20,
      },
      series: [
        {
          name: '带宽占用',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 4,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: false
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold'
            }
          },
          data: pieData
        }
      ]
    };
  }, [networkInfo.processes.list]);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    chartInstance.current.setOption(getChartOption);

    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = undefined;
    };
  }, [getChartOption]);

  useEffect(() => {
    const handleResize = () => {
      chartInstance.current?.resize();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="network-processes">
      <div className="process-table">
        <Table<ProcessTableItem>
          columns={columns}
          dataSource={data}
          pagination={false}
          scroll={{ y: 'calc(100vh - 700px)' }}
          size="middle"
          virtual
        />
      </div>

      <Card className="bandwidth-chart">
        <div ref={chartRef} style={{ width: '100%', height: '100%' }} />
      </Card>
    </div>
  );
}); 