# 📋 文件浏览器复制粘贴功能技术方案

## 🎯 功能概述
为文件浏览器添加类似Windows资源管理器的复制粘贴功能，支持文件和文件夹的复制、剪切、粘贴操作。

## 🔧 技术实现方案

### 1. **同一个SSH会话内的操作**
在同一个文件浏览器标签页内进行复制粘贴操作。

#### 使用的Linux命令（统一使用rsync）：
- **复制文件**: `rsync -avz --progress source_file target_directory/`
- **复制文件夹**: `rsync -avz --progress source_directory/ target_directory/`
- **移动文件**: `rsync -avz --progress --remove-source-files source_file target_directory/`
- **移动文件夹**: `rsync -avz --progress --remove-source-files source_directory/ target_directory/`
- **批量操作**: 分别执行多个rsync命令，便于进度监控

#### 技术特点：
- 直接在服务器端执行，速度快
- 不占用本地网络带宽
- **原生进度显示**: rsync --progress 提供详细进度信息
- **断点续传**: 支持大文件的中断恢复
- **增量复制**: 只传输文件差异部分，提升效率
- **属性保持**: 自动保持文件权限、时间戳等属性

### 2. **不同SSH会话间的操作**
在不同的文件浏览器标签页（不同服务器）之间进行复制粘贴。

#### 技术实现方案：
直接使用Linux的 `rsync` 命令在服务器间传输，无需本地中转。

#### 具体流程：
```
源服务器A --[rsync]--> 目标服务器B
```

#### 使用的Linux命令：
- **文件复制**: `rsync -avz --progress user@host1:/path/file user@host2:/path/`
- **文件夹复制**: `rsync -avz --progress user@host1:/path/dir/ user@host2:/path/`
- **剪切操作**: `rsync -avz --progress --remove-source-files user@host1:/path/file user@host2:/path/`
- **断点续传**: `rsync -avz --partial --progress user@host1:/path/file user@host2:/path/`

#### rsync 技术优势：
- **直接传输**: 服务器间直接传输，不占用本地带宽
- **高效压缩**: 自动压缩传输，节省带宽
- **增量同步**: 只传输文件差异部分，极大提升效率
- **原生支持**: Linux原生命令，稳定可靠
- **进度监控**: `--progress` 参数显示实时进度
- **断点续传**: `--partial` 参数支持中断恢复
- **剪切支持**: `--remove-source-files` 参数实现移动操作

### 3. **同一服务器不同路径间的操作**
在同一个服务器的不同目录间进行复制粘贴。

#### 使用的Linux命令：
- **绝对路径复制**: `rsync -avz --progress /path/to/source /path/to/target/`
- **相对路径处理**: rsync自动处理相对路径和绝对路径
- **跨分区操作**: rsync自动优化跨分区传输，无需特殊处理

## 🏗️ 核心组件设计

### 1. **剪贴板管理器 (ClipboardManager)**
```typescript
interface ClipboardItem {
  files: FileEntry[];           // 文件列表
  operation: 'copy' | 'cut';    // 操作类型
  sourcePath: string;           // 源路径
  sourceSessionId: string;      // 源会话ID
  timestamp: number;            // 时间戳
}

class ClipboardManager {
  private clipboard: ClipboardItem | null = null;
  
  // 复制到剪贴板
  copy(files: FileEntry[], sourcePath: string, sessionId: string): void
  
  // 剪切到剪贴板  
  cut(files: FileEntry[], sourcePath: string, sessionId: string): void
  
  // 获取剪贴板内容
  getClipboard(): ClipboardItem | null
  
  // 清空剪贴板
  clear(): void
  
  // 检查是否有内容
  hasContent(): boolean
}
```

### 2. **文件操作服务 (FileOperationService)**
```typescript
interface CopyPasteOptions {
  sourceFiles: FileEntry[];
  sourcePath: string;
  sourceSessionId: string;
  targetPath: string;
  targetSessionId: string;
  operation: 'copy' | 'cut';
  onProgress?: (progress: number, currentFile: string) => void;
  onConflict?: (file: string) => 'overwrite' | 'skip' | 'rename';
}

class FileOperationService {
  // 执行复制粘贴操作
  async executeCopyPaste(options: CopyPasteOptions): Promise<void>
  
  // 同会话内操作
  private async sameSessionOperation(options: CopyPasteOptions): Promise<void>
  
  // 跨会话操作
  private async crossSessionOperation(options: CopyPasteOptions): Promise<void>
  
  // 进度监控
  private async monitorProgress(command: string, totalSize: number): Promise<void>
}
```

### 3. **进度监控实现**
```typescript
// rsync 原生进度监控，无需额外实现
// rsync --progress 输出格式: "1,234,567  45%  1.23MB/s    0:00:12"
const executeRsyncWithProgress = async (command: string, onProgress: (progress: number) => void) => {
  await sshService.executeCommandWithCallback(sessionId, command, (output) => {
    const progressMatch = output.match(/(\d+)%/);
    if (progressMatch) {
      const progress = parseInt(progressMatch[1]);
      onProgress(progress);
    }
  });
};
```

## 📱 用户界面设计

### 1. **右键菜单扩展**
在现有的 `FileListContextMenu.tsx` 中添加：
- 复制 (Copy) - `Ctrl+C`
- 剪切 (Cut) - `Ctrl+X`  
- 粘贴 (Paste) - `Ctrl+V`

### 2. **视觉反馈**
- **剪切状态**: 被剪切的文件显示半透明 + 虚线边框
- **进度显示**: 复用现有的进度对话框组件
- **状态提示**: 使用 Ant Design 的 message 组件

### 3. **快捷键支持**
```typescript
// 在 FileList 组件中添加键盘事件监听
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'c') {
      handleCopy();
    } else if (e.ctrlKey && e.key === 'x') {
      handleCut();
    } else if (e.ctrlKey && e.key === 'v') {
      handlePaste();
    }
  };
  
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, []);
```

## 🔄 实现优先级

### Phase 1: 基础功能
1. 剪贴板管理器实现
2. 同会话内复制粘贴
3. 右键菜单集成
4. 基础进度显示

### Phase 2: 增强功能  
1. 跨会话复制粘贴
2. 快捷键支持
3. 冲突处理对话框
4. 视觉反馈优化

### Phase 3: 完善功能
1. 批量操作优化
2. 错误处理完善
3. 撤销功能
4. 性能优化

## 📝 注意事项

### 技术实现注意点
1. **权限处理**: 检查源文件读取权限和目标目录写入权限
2. **空间检查**: 复制前检查目标目录可用空间
3. **路径处理**: 正确处理特殊字符和空格的文件名（使用引号包围）
4. **错误恢复**: 操作失败时的回滚机制
5. **SSH认证**: 跨会话操作需要处理SSH密钥认证或密码认证

### 跨会话操作特殊考虑
1. **网络连通性**: 确保源服务器能够访问目标服务器
2. **防火墙设置**: SSH端口（默认22）需要开放
3. **认证方式**: 推荐使用SSH密钥认证，避免密码交互
4. **超时处理**: 大文件传输可能需要较长时间
5. **进度监控**: rsync的进度输出解析

### 用户体验考虑
1. **操作反馈**: 及时显示操作状态和进度
2. **错误提示**: 友好的错误信息和解决建议
3. **取消操作**: 支持用户中途取消长时间操作
4. **冲突处理**: 同名文件的处理策略选择

## 🧪 测试场景

### 基础功能测试
1. **同会话内**: 文件复制、文件夹复制、批量操作
2. **跨会话**: 不同服务器间的文件传输
3. **剪切操作**: 文件移动功能验证

### 边界情况测试
1. **大文件**: 测试GB级文件的传输
2. **特殊字符**: 文件名包含空格、中文、特殊符号
3. **权限不足**: 源文件无读权限、目标目录无写权限
4. **磁盘空间**: 目标目录空间不足的处理

### 网络异常测试
1. **连接中断**: SSH连接在传输过程中断开
2. **网络延迟**: 高延迟网络环境下的表现
3. **认证失败**: SSH密钥或密码认证失败
4. **超时处理**: 长时间无响应的处理

### 用户交互测试
1. **快捷键**: Ctrl+C/X/V快捷键功能
2. **右键菜单**: 菜单项的启用/禁用状态
3. **进度显示**: 进度条和状态信息的准确性
4. **取消操作**: 用户取消操作的响应
