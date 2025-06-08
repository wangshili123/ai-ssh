/**
 * 拖拽上传区域组件
 * 支持文件拖拽、点击选择、文件预览等功能
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  Button,
  List,
  Typography,
  Space,
  Tag,
  Tooltip,
  message
} from 'antd';
import {
  InboxOutlined,
  FileOutlined,
  DeleteOutlined,
  PlusOutlined,
  FolderOpenOutlined
} from '@ant-design/icons';
import './UploadDropZone.css';

const { Text } = Typography;

export interface UploadDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  selectedFiles?: File[];
  accept?: string;
  maxFiles?: number;
  maxSize?: number;
  disabled?: boolean;
  className?: string;
}

const UploadDropZone: React.FC<UploadDropZoneProps> = ({
  onFilesSelected,
  selectedFiles = [],
  accept,
  maxFiles = 50,
  maxSize = 5 * 1024 * 1024 * 1024, // 5GB
  disabled = false,
  className = ''
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * 格式化文件大小
   */
  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  /**
   * 验证文件
   */
  const validateFiles = useCallback((files: FileList | File[]): File[] => {
    const fileArray = Array.from(files);
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of fileArray) {
      // 检查文件大小
      if (file.size > maxSize) {
        errors.push(`文件 ${file.name} 超过最大大小限制 (${formatFileSize(maxSize)})`);
        continue;
      }

      // 检查文件类型（如果指定了 accept）
      if (accept && !accept.split(',').some(type => {
        const trimmedType = type.trim();
        if (trimmedType.startsWith('.')) {
          return file.name.toLowerCase().endsWith(trimmedType.toLowerCase());
        }
        return file.type.match(trimmedType);
      })) {
        errors.push(`文件 ${file.name} 类型不被支持`);
        continue;
      }

      validFiles.push(file);
    }

    // 检查文件数量限制
    const totalFiles = selectedFiles.length + validFiles.length;
    if (totalFiles > maxFiles) {
      const allowedCount = maxFiles - selectedFiles.length;
      errors.push(`最多只能选择 ${maxFiles} 个文件，当前可添加 ${allowedCount} 个`);
      return validFiles.slice(0, allowedCount);
    }

    // 显示错误信息
    if (errors.length > 0) {
      errors.forEach(error => message.warning(error));
    }

    return validFiles;
  }, [accept, maxFiles, maxSize, selectedFiles.length, formatFileSize]);

  /**
   * 处理文件选择
   */
  const handleFileSelect = useCallback((newFiles: File[]) => {
    const validFiles = validateFiles(newFiles);
    if (validFiles.length > 0) {
      // 去重：检查是否已经选择了相同的文件
      const uniqueFiles = validFiles.filter(newFile => 
        !selectedFiles.some(existingFile => 
          existingFile.name === newFile.name && 
          existingFile.size === newFile.size &&
          existingFile.lastModified === newFile.lastModified
        )
      );

      if (uniqueFiles.length !== validFiles.length) {
        message.info('已过滤重复文件');
      }

      if (uniqueFiles.length > 0) {
        onFilesSelected([...selectedFiles, ...uniqueFiles]);
      }
    }
  }, [selectedFiles, validateFiles, onFilesSelected]);

  /**
   * 处理拖拽进入
   */
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  /**
   * 处理拖拽悬停
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragActive(true);
    }
  }, [disabled]);

  /**
   * 处理拖拽离开
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(false);
      setIsDragActive(false);
    }
  }, [disabled]);

  /**
   * 处理文件拖拽放置
   */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (disabled) return;

    setIsDragOver(false);
    setIsDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files);
    }
  }, [disabled, handleFileSelect]);

  /**
   * 处理点击选择文件
   */
  const handleClick = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  /**
   * 处理文件输入变化
   */
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(Array.from(files));
    }
    // 清空 input 值，允许重复选择相同文件
    e.target.value = '';
  }, [handleFileSelect]);

  /**
   * 移除文件
   */
  const handleRemoveFile = useCallback((index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    onFilesSelected(newFiles);
  }, [selectedFiles, onFilesSelected]);

  /**
   * 清空所有文件
   */
  const handleClearAll = useCallback(() => {
    onFilesSelected([]);
  }, [onFilesSelected]);

  /**
   * 获取文件图标
   */
  const getFileIcon = useCallback((fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    // 这里可以根据文件扩展名返回不同的图标
    return <FileOutlined />;
  }, []);

  /**
   * 获取文件类型标签
   */
  const getFileTypeTag = useCallback((fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (!ext) return null;

    const typeColors: { [key: string]: string } = {
      'jpg': 'magenta', 'jpeg': 'magenta', 'png': 'magenta', 'gif': 'magenta',
      'mp4': 'red', 'avi': 'red', 'mov': 'red',
      'pdf': 'volcano',
      'doc': 'blue', 'docx': 'blue',
      'xls': 'green', 'xlsx': 'green',
      'txt': 'default', 'log': 'default',
      'zip': 'purple', 'rar': 'purple', '7z': 'purple'
    };

    return (
      <Tag color={typeColors[ext] || 'default'}>
        {ext.toUpperCase()}
      </Tag>
    );
  }, []);

  const dropZoneClass = [
    'upload-drop-zone',
    isDragOver ? 'drag-over' : '',
    isDragActive ? 'drag-active' : '',
    disabled ? 'disabled' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className="upload-drop-zone-container">
      {/* 拖拽区域 */}
      <div
        className={dropZoneClass}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <div className="drop-zone-content">
          <InboxOutlined className="drop-zone-icon" />
          <div className="drop-zone-text">
            <Text strong>拖拽文件到此处或点击选择</Text>
            <br />
            <Text type="secondary">
              支持单个或批量上传，最多 {maxFiles} 个文件，单文件最大 {formatFileSize(maxSize)}
            </Text>
          </div>
        </div>

        {/* 隐藏的文件输入 */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={accept}
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
        />
      </div>

      {/* 文件列表 */}
      {selectedFiles.length > 0 && (
        <div className="selected-files-section">
          <div className="files-header">
            <Space>
              <Text strong>已选择文件 ({selectedFiles.length})</Text>
              <Button
                type="link"
                size="small"
                icon={<DeleteOutlined />}
                onClick={handleClearAll}
              >
                清空
              </Button>
            </Space>
          </div>

          <List
            className="files-list"
            size="small"
            dataSource={selectedFiles}
            renderItem={(file, index) => (
              <List.Item
                actions={[
                  <Tooltip title="移除文件">
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => handleRemoveFile(index)}
                    />
                  </Tooltip>
                ]}
              >
                <List.Item.Meta
                  avatar={getFileIcon(file.name)}
                  title={
                    <Space>
                      <Text ellipsis style={{ maxWidth: 200 }}>
                        {file.name}
                      </Text>
                      {getFileTypeTag(file.name)}
                    </Space>
                  }
                  description={
                    <Text type="secondary">
                      {formatFileSize(file.size)}
                    </Text>
                  }
                />
              </List.Item>
            )}
          />

          {/* 添加更多文件按钮 */}
          <div className="add-more-files">
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={handleClick}
              disabled={disabled || selectedFiles.length >= maxFiles}
              block
            >
              添加更多文件
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadDropZone;
