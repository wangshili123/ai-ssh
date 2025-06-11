# 上传功能使用示例

本文档展示如何在应用中使用新开发的上传功能组件。

## 📋 组件概览

### 1. 核心组件

- **UploadDialog**: 上传配置对话框
- **UploadDropZone**: 拖拽上传区域
- **TransferProgress**: 统一传输进度显示
- **TransferManager**: 统一传输管理器
- **TransferHistory**: 传输历史记录
- **TransferNotification**: 传输通知

### 2. 服务层

- **UploadService**: 上传服务
- **TransferService**: 统一传输服务基类
- **CompressionStrategy**: 压缩策略选择器

## 🚀 基础使用

### 1. 上传对话框

```tsx
import React, { useState } from 'react';
import { Button } from 'antd';
import { UploadDialog } from '../components/Upload';

const MyComponent: React.FC = () => {
  const [uploadVisible, setUploadVisible] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleUpload = () => {
    setUploadVisible(true);
  };

  const handleUploadConfirm = (config) => {
    console.log('上传配置:', config);
    setUploadVisible(false);
  };

  return (
    <div>
      <Button onClick={handleUpload}>
        上传文件
      </Button>
      
      <UploadDialog
        visible={uploadVisible}
        selectedFiles={selectedFiles}
        defaultRemotePath="/home/user/uploads/"
        sessionInfo={{
          id: 'session-1',
          host: 'example.com',
          username: 'user'
        }}
        onConfirm={handleUploadConfirm}
        onCancel={() => setUploadVisible(false)}
      />
    </div>
  );
};
```

### 2. 拖拽上传区域

```tsx
import React, { useState } from 'react';
import { UploadDropZone } from '../components/Upload';

const FileUploadArea: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);

  const handleFilesSelected = (newFiles: File[]) => {
    setFiles(newFiles);
    console.log('选择的文件:', newFiles);
  };

  return (
    <UploadDropZone
      onFilesSelected={handleFilesSelected}
      selectedFiles={files}
      maxFiles={20}
      maxSize={1024 * 1024 * 1024} // 1GB
      accept=".jpg,.png,.pdf,.txt"
    />
  );
};
```

### 3. 传输管理器

```tsx
import React, { useState } from 'react';
import { Button } from 'antd';
import { TransferManager } from '../components/Transfer';

const TransferControl: React.FC = () => {
  const [managerVisible, setManagerVisible] = useState(false);

  return (
    <div>
      <Button onClick={() => setManagerVisible(true)}>
        传输管理
      </Button>
      
      <TransferManager
        visible={managerVisible}
        onClose={() => setManagerVisible(false)}
        defaultTab="all" // 'all' | 'download' | 'upload'
      />
    </div>
  );
};
```

## 🔧 高级配置

### 1. 启用压缩传输

```tsx
const uploadConfig = {
  remotePath: '/home/user/uploads/',
  overwrite: false,
  preservePermissions: true,
  sessionId: 'session-1',
  // 启用压缩
  useCompression: true,
  compressionMethod: 'auto', // 'auto' | 'gzip' | 'bzip2' | 'xz'
};
```

### 2. 启用并行传输

```tsx
const uploadConfig = {
  remotePath: '/home/user/uploads/',
  overwrite: false,
  preservePermissions: true,
  sessionId: 'session-1',
  // 启用并行传输
  useParallelTransfer: true,
  maxParallelChunks: 4, // 最大并行块数
};
```

### 3. 同时启用压缩和并行

```tsx
const uploadConfig = {
  remotePath: '/home/user/uploads/',
  overwrite: false,
  preservePermissions: true,
  sessionId: 'session-1',
  // 同时启用压缩和并行传输
  useCompression: true,
  compressionMethod: 'gzip',
  useParallelTransfer: true,
  maxParallelChunks: 6,
};
```

## 📊 服务层使用

### 1. 直接使用上传服务

```tsx
import { uploadService } from '../services/uploadService';

const startUpload = async (files: File[]) => {
  try {
    const config = {
      remotePath: '/home/user/uploads/',
      overwrite: false,
      preservePermissions: true,
      sessionId: 'session-1',
      useCompression: true,
      useParallelTransfer: true,
      maxParallelChunks: 4
    };

    const taskId = await uploadService.startUpload(files, config);
    console.log('上传任务ID:', taskId);
    
    // 监听上传进度
    uploadService.on('upload-progress', (task) => {
      if (task.id === taskId) {
        console.log('上传进度:', task.progress.percentage + '%');
      }
    });
    
    // 监听上传完成
    uploadService.on('upload-completed', (task) => {
      if (task.id === taskId) {
        console.log('上传完成:', task.file.name);
      }
    });
    
  } catch (error) {
    console.error('上传失败:', error);
  }
};
```

### 2. 控制上传任务

```tsx
import { uploadService } from '../services/uploadService';

// 暂停上传
const pauseUpload = async (taskId: string) => {
  try {
    await uploadService.pauseTransfer(taskId);
    console.log('上传已暂停');
  } catch (error) {
    console.error('暂停失败:', error);
  }
};

// 恢复上传
const resumeUpload = async (taskId: string) => {
  try {
    await uploadService.resumeTransfer(taskId);
    console.log('上传已恢复');
  } catch (error) {
    console.error('恢复失败:', error);
  }
};

// 取消上传
const cancelUpload = async (taskId: string) => {
  try {
    await uploadService.cancelTransfer(taskId);
    console.log('上传已取消');
  } catch (error) {
    console.error('取消失败:', error);
  }
};
```

## 🎨 自定义样式

### 1. 自定义拖拽区域样式

```css
.custom-upload-zone {
  border: 2px dashed #52c41a;
  border-radius: 12px;
  background: linear-gradient(135deg, #f6ffed 0%, #f0f9ff 100%);
}

.custom-upload-zone:hover {
  border-color: #389e0d;
  background: linear-gradient(135deg, #f0f9ff 0%, #e6f7ff 100%);
}
```

### 2. 自定义进度条样式

```css
.custom-transfer-progress {
  background: linear-gradient(135deg, #1f1f1f 0%, #2d2d2d 100%);
  border: 1px solid #52c41a;
  border-radius: 8px;
}

.custom-transfer-progress .ant-progress-bg {
  background: linear-gradient(90deg, #52c41a 0%, #73d13d 100%);
}
```

## 🔔 事件监听

### 1. 监听所有传输事件

```tsx
import { uploadService, downloadService } from '../services';

useEffect(() => {
  // 上传事件
  const handleUploadStarted = (task) => console.log('上传开始:', task);
  const handleUploadProgress = (task) => console.log('上传进度:', task.progress);
  const handleUploadCompleted = (task) => console.log('上传完成:', task);
  const handleUploadError = (task) => console.log('上传错误:', task.error);

  uploadService.on('upload-started', handleUploadStarted);
  uploadService.on('upload-progress', handleUploadProgress);
  uploadService.on('upload-completed', handleUploadCompleted);
  uploadService.on('upload-error', handleUploadError);

  return () => {
    uploadService.off('upload-started', handleUploadStarted);
    uploadService.off('upload-progress', handleUploadProgress);
    uploadService.off('upload-completed', handleUploadCompleted);
    uploadService.off('upload-error', handleUploadError);
  };
}, []);
```

## 🚨 错误处理

### 1. 处理上传错误

```tsx
const handleUploadError = (error: Error, taskId: string) => {
  console.error('上传错误:', error);
  
  // 根据错误类型进行不同处理
  if (error.message.includes('网络')) {
    // 网络错误，可以重试
    message.error('网络连接失败，请检查网络后重试');
  } else if (error.message.includes('权限')) {
    // 权限错误
    message.error('没有上传权限，请联系管理员');
  } else {
    // 其他错误
    message.error(`上传失败: ${error.message}`);
  }
};
```

## 📱 响应式设计

所有组件都支持响应式设计，在移动设备上会自动调整布局：

- 拖拽区域在小屏幕上会调整大小
- 传输管理器会使用全屏模式
- 进度条会垂直堆叠显示信息
- 按钮会增大触摸区域

## 🎯 最佳实践

1. **文件大小限制**: 建议设置合理的文件大小限制
2. **并发控制**: 避免同时启动过多传输任务
3. **错误重试**: 实现自动重试机制
4. **进度反馈**: 及时向用户反馈传输状态
5. **资源清理**: 及时清理已完成的传输任务
