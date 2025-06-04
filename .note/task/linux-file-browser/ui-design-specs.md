# 文件下载功能UI设计规范

## 🎨 设计理念

### 核心原则
- **简洁直观**: 操作流程简单明了，用户一看就懂
- **信息透明**: 实时反馈下载状态和进度信息
- **视觉统一**: 与现有深色主题保持一致
- **响应迅速**: 界面响应快速，操作反馈及时

### 设计目标
- 降低用户学习成本
- 提升操作效率
- 增强用户信任感
- 保持视觉美观

## 🎯 组件设计详解

### 1. DownloadDialog - 下载配置对话框

#### 布局结构
```
┌─────────────────────────────────────────────┐
│ 📥 下载文件                    [×]           │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │ 📄 example.txt                         │ │
│ │ 📊 2.5 MB                              │ │
│ │ 📁 /home/user/documents/example.txt    │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ 保存位置                                     │
│ ┌─────────────────────────────┐ ┌─────────┐ │
│ │ C:\Users\Username\Downloads │ │ 浏览... │ │
│ └─────────────────────────────┘ └─────────┘ │
│                                             │
│ 文件名                                       │
│ ┌─────────────────────────────────────────┐ │
│ │ example.txt                             │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ☑️ 覆盖同名文件                              │
│ ☑️ 下载完成后打开文件夹                       │
│                                             │
│                           ┌───────┐ ┌─────┐ │
│                           │ 取消  │ │下载 │ │
│                           └───────┘ └─────┘ │
└─────────────────────────────────────────────┘
```

#### 样式规范
```css
.download-dialog {
  width: 480px;
  background: #1E1E1E;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.dialog-header {
  padding: 16px 24px;
  border-bottom: 1px solid #333;
  display: flex;
  align-items: center;
  gap: 8px;
}

.dialog-title {
  font-size: 16px;
  font-weight: 500;
  color: #D4D4D4;
}

.file-info-card {
  margin: 16px 24px;
  padding: 16px;
  background: #2D2D2D;
  border-radius: 6px;
  border-left: 3px solid #1890ff;
}

.file-name {
  font-size: 14px;
  font-weight: 500;
  color: #D4D4D4;
  margin-bottom: 4px;
}

.file-size {
  font-size: 12px;
  color: #8C8C8C;
  margin-bottom: 4px;
}

.file-path {
  font-size: 11px;
  color: #666;
  font-family: 'Consolas', monospace;
}
```

### 2. DownloadProgress - 进度显示组件

#### 布局结构
```
┌─────────────────────────────────────────────┐
│ 正在下载: example.txt               [_] [×] │
├─────────────────────────────────────────────┤
│                                             │
│        ●●●●●●●○○○ 65%                      │
│                                             │
│ 速度: 1.2 MB/s    剩余时间: 00:15           │
│ 已下载: 1.6 MB / 2.5 MB                    │
│                                             │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│ │  暂停   │ │  取消   │ │ 后台运行 │        │
│ └─────────┘ └─────────┘ └─────────┘        │
└─────────────────────────────────────────────┘
```

#### 进度条设计
```css
.progress-circle {
  width: 120px;
  height: 120px;
  position: relative;
  margin: 0 auto;
}

.progress-ring {
  transform: rotate(-90deg);
}

.progress-ring-background {
  fill: none;
  stroke: #333;
  stroke-width: 8;
}

.progress-ring-progress {
  fill: none;
  stroke: #1890ff;
  stroke-width: 8;
  stroke-linecap: round;
  transition: stroke-dasharray 0.3s ease;
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 18px;
  font-weight: 600;
  color: #D4D4D4;
}
```

### 3. DownloadManager - 下载管理面板

#### 布局结构
```
┌─────────────────────────────────────────────┐
│ 📥 下载管理                    [全部暂停] [×] │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │ 📄 file1.txt    ●●●●●○○○ 60%  [暂停]   │ │
│ │    1.2 MB/s     剩余: 00:30             │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ 📄 file2.zip    ●●●●●●●● 100% [完成]   │ │
│ │    已完成       用时: 02:15             │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ 📄 file3.pdf    ❌ 错误      [重试]     │ │
│ │    网络连接中断                         │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ 统计: 共3个任务, 1个完成, 1个进行中, 1个失败  │
└─────────────────────────────────────────────┘
```

### 4. DownloadNotification - 下载通知

#### 通知类型设计
```
开始下载:
┌─────────────────────────────────┐
│ 📥 开始下载                      │
│ example.txt (2.5 MB)            │
│ 保存到: C:\Downloads\           │
└─────────────────────────────────┘

下载完成:
┌─────────────────────────────────┐
│ ✅ 下载完成                      │
│ example.txt                     │
│ [打开文件] [打开文件夹]          │
└─────────────────────────────────┘

下载失败:
┌─────────────────────────────────┐
│ ❌ 下载失败                      │
│ example.txt                     │
│ 错误: 网络连接中断               │
│ [重试] [取消]                   │
└─────────────────────────────────┘
```

## 🎨 视觉设计规范

### 色彩系统
```css
:root {
  /* 主色调 */
  --primary-color: #1890ff;
  --primary-hover: #40a9ff;
  --primary-active: #096dd9;
  
  /* 状态色 */
  --success-color: #52c41a;
  --warning-color: #faad14;
  --error-color: #ff4d4f;
  --info-color: #1890ff;
  
  /* 背景色 */
  --bg-primary: #1E1E1E;
  --bg-secondary: #2D2D2D;
  --bg-tertiary: #3D3D3D;
  
  /* 文字色 */
  --text-primary: #D4D4D4;
  --text-secondary: #8C8C8C;
  --text-disabled: #666;
  
  /* 边框色 */
  --border-color: #333;
  --border-hover: #555;
}
```

### 字体规范
```css
.font-system {
  /* 标题字体 */
  --font-title: 16px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto;
  
  /* 正文字体 */
  --font-body: 14px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto;
  
  /* 小字体 */
  --font-small: 12px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto;
  
  /* 等宽字体 */
  --font-mono: 12px/1.4 'Consolas', 'Monaco', 'Courier New', monospace;
}
```

### 间距系统
```css
.spacing-system {
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
}
```

### 圆角规范
```css
.border-radius {
  --radius-sm: 4px;   /* 小组件 */
  --radius-md: 6px;   /* 卡片 */
  --radius-lg: 8px;   /* 对话框 */
  --radius-xl: 12px;  /* 大面板 */
}
```

### 阴影规范
```css
.shadow-system {
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.15);
  --shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.2);
  --shadow-xl: 0 8px 32px rgba(0, 0, 0, 0.3);
}
```

## 🎭 动画效果

### 进度动画
```css
@keyframes progress-fill {
  from {
    stroke-dasharray: 0 283;
  }
  to {
    stroke-dasharray: var(--progress) 283;
  }
}

.progress-ring-progress {
  animation: progress-fill 0.3s ease-out;
}
```

### 状态切换动画
```css
.download-status {
  transition: all 0.2s ease;
}

.download-status.downloading {
  color: var(--primary-color);
}

.download-status.completed {
  color: var(--success-color);
}

.download-status.error {
  color: var(--error-color);
}
```

### 弹窗动画
```css
@keyframes modal-appear {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.download-dialog {
  animation: modal-appear 0.2s ease-out;
}
```

## 📱 响应式设计

### 断点设置
```css
@media (max-width: 768px) {
  .download-dialog {
    width: 90vw;
    margin: 20px;
  }
  
  .download-manager {
    padding: 12px;
  }
}
```

## ♿ 无障碍设计

### 键盘导航
- Tab键顺序合理
- 支持Enter和Space键操作
- ESC键关闭对话框

### 屏幕阅读器支持
```html
<div role="dialog" aria-labelledby="download-title" aria-describedby="download-desc">
  <h2 id="download-title">下载文件</h2>
  <div id="download-desc">配置文件下载选项</div>
</div>
```

### 颜色对比度
- 确保文字与背景对比度 ≥ 4.5:1
- 重要信息不仅依赖颜色区分

---

**设计负责人**: AI Assistant  
**设计版本**: v1.0  
**最后更新**: 2024-12-22
