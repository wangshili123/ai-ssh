import React, { useMemo } from 'react';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getUserName, getGroupName } from '../../../../utils';
import type { FileEntry } from '../../../../../main/types/file';
import type { SorterResult } from 'antd/es/table/interface';

interface UseFileListColumnsProps {
  columnWidths: {
    name: number;
    size: number;
    type: number;
    modifyTime: number;
    permissions: number;
    ownership: number;
  };
  sortedInfo: SorterResult<FileEntry>;
  openingFiles: Set<string>;
  highlightedFiles: Set<string>;
  handleResize: (index: number) => { immediateUpdate: (width: number) => void };
  formatPermissions: (permissions: number) => string;
  formatFileSize: (size: number) => string;
  getFileIcon: (file: FileEntry) => string;
  containerRef?: React.RefObject<HTMLDivElement>;
}

export const useFileListColumns = ({
  columnWidths,
  sortedInfo,
  openingFiles,
  highlightedFiles,
  handleResize,
  formatPermissions,
  formatFileSize,
  getFileIcon,
  containerRef
}: UseFileListColumnsProps) => {
  return useMemo(() => [
    {
      title: '文件名',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: FileEntry, b: FileEntry) => {
        // 目录优先排序
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      },
      sortOrder: sortedInfo.columnKey === 'name' ? sortedInfo.order : null,
      render: (text: string, record: FileEntry) => {
        const isOpening = openingFiles.has(record.path);
        return (
          <span className={`file-list-name-cell ${highlightedFiles.has(record.name) ? 'file-list-highlighted' : ''}`}>
            <span className="file-list-icon">{getFileIcon(record)}</span>
            <span className="file-list-name">{text}</span>
            {isOpening && (
              <Spin
                size="small"
                style={{ marginLeft: 8 }}
                indicator={<LoadingOutlined style={{ fontSize: 12 }} spin />}
              />
            )}
          </span>
        );
      },
      width: columnWidths.name,
      ellipsis: true,
      onHeaderCell: () => {
        const { immediateUpdate } = handleResize(0);
        return {
          width: columnWidths.name,
          columnIndex: 0,
          onResizeStop: immediateUpdate,
          containerRef,
        } as any;
      },
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      sorter: (a: FileEntry, b: FileEntry) => a.size - b.size,
      sortOrder: sortedInfo.columnKey === 'size' ? sortedInfo.order : null,
      render: (size: number, record: FileEntry) =>
        record.isDirectory ? '-' : formatFileSize(size),
      width: columnWidths.size,
      onHeaderCell: () => {
        const { immediateUpdate } = handleResize(1);
        return {
          width: columnWidths.size,
          columnIndex: 1,
          onResizeStop: immediateUpdate,
          containerRef,
        } as any;
      },
    },
    {
      title: '类型',
      key: 'type',
      render: (_: unknown, record: FileEntry) =>
        record.isDirectory ? '文件夹' : '文件',
      width: columnWidths.type,
      onHeaderCell: () => {
        const { immediateUpdate } = handleResize(2);
        return {
          width: columnWidths.type,
          columnIndex: 2,
          onResizeStop: immediateUpdate,
          containerRef,
        } as any;
      },
    },
    {
      title: '修改时间',
      dataIndex: 'modifyTime',
      key: 'modifyTime',
      sorter: (a: FileEntry, b: FileEntry) => a.modifyTime - b.modifyTime,
      sortOrder: sortedInfo.columnKey === 'modifyTime' ? sortedInfo.order : null,
      render: (time: number) => dayjs(time).format('YYYY-MM-DD HH:mm:ss'),
      width: columnWidths.modifyTime,
      onHeaderCell: () => {
        const { immediateUpdate } = handleResize(3);
        return {
          width: columnWidths.modifyTime,
          columnIndex: 3,
          onResizeStop: immediateUpdate,
          containerRef,
        } as any;
      },
    },
    {
      title: '权限',
      dataIndex: 'permissions',
      key: 'permissions',
      render: (permissions: number) => formatPermissions(permissions),
      width: columnWidths.permissions,
      onHeaderCell: () => {
        const { immediateUpdate } = handleResize(4);
        return {
          width: columnWidths.permissions,
          columnIndex: 4,
          onResizeStop: immediateUpdate,
          containerRef,
        } as any;
      },
    },
    {
      title: '用户/组',
      key: 'ownership',
      render: (_: unknown, record: FileEntry) => {
        const owner = record.owner !== undefined ? getUserName(record.owner) : '-';
        const group = record.group !== undefined ? getGroupName(record.group) : '-';
        return `${owner}/${group}`;
      },
      width: columnWidths.ownership,
      onHeaderCell: () => {
        const { immediateUpdate } = handleResize(5);
        return {
          width: columnWidths.ownership,
          columnIndex: 5,
          onResizeStop: immediateUpdate,
          containerRef,
        } as any;
      },
    },
  ], [columnWidths, sortedInfo, openingFiles, highlightedFiles, handleResize, formatPermissions, formatFileSize, getFileIcon, containerRef]);
};
