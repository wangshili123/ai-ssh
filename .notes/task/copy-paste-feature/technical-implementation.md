# 🔧 复制粘贴功能技术实现详细方案

## 📋 Linux命令详解

### 1. 同一SSH会话内操作

#### 统一使用 rsync 命令（推荐）

##### 复制操作 (Copy)
```bash
# 单个文件复制
rsync -avz --progress "source_file.txt" "/target/directory/"

# 文件夹复制（递归）
rsync -avz --progress "source_directory/" "/target/directory/"

# 批量文件复制（分别执行，便于进度监控）
rsync -avz --progress "file1.txt" "/target/directory/"
rsync -avz --progress "file2.txt" "/target/directory/"
rsync -avz --progress "file3.txt" "/target/directory/"

# 大文件复制（带断点续传）
rsync -avz --progress --partial "large_file.txt" "/target/directory/"
```

##### 移动操作 (Cut)
```bash
# 单个文件移动
rsync -avz --progress --remove-source-files "source_file.txt" "/target/directory/"

# 文件夹移动
rsync -avz --progress --remove-source-files "source_directory/" "/target/directory/"
# 注意：需要手动删除空的源目录
rmdir "source_directory" 2>/dev/null || true

# 批量文件移动
rsync -avz --progress --remove-source-files "file1.txt" "/target/directory/"
rsync -avz --progress --remove-source-files "file2.txt" "/target/directory/"
rsync -avz --progress --remove-source-files "file3.txt" "/target/directory/"
```

##### rsync 在同会话内的优势
- **统一进度显示**: 所有操作都有一致的进度输出格式
- **断点续传**: 大文件操作支持中断恢复
- **属性保持**: 自动保持文件权限、时间戳等
- **增量复制**: 如果目标文件已存在，只传输差异部分
- **压缩传输**: 即使在本地也能减少磁盘I/O（对于网络文件系统有效）
- **错误处理**: 内置重试和错误恢复机制

### 2. 跨SSH会话操作

#### 技术流程
```
源服务器A --[rsync]--> 目标服务器B
```

#### 实现方案：使用 rsync 命令

```bash
# 单个文件复制
rsync -avz --progress user@source_host:/path/to/source_file user@target_host:/path/to/target/

# 文件夹复制（递归）
rsync -avz --progress user@source_host:/path/to/source_directory/ user@target_host:/path/to/target/

# 批量文件复制（分别执行多个rsync命令）
rsync -avz --progress user@source_host:/path/to/file1 user@target_host:/path/to/target/
rsync -avz --progress user@source_host:/path/to/file2 user@target_host:/path/to/target/

# 断点续传
rsync -avz --partial --progress user@source_host:/path/to/source user@target_host:/path/to/target/

# 删除源文件（剪切操作）
rsync -avz --progress --remove-source-files user@source_host:/path/to/source user@target_host:/path/to/target/
```

#### rsync 技术优势
- **直接传输**: 服务器间直接传输，不占用本地带宽
- **高效压缩**: `-z` 参数自动压缩传输，节省带宽
- **增量同步**: 只传输文件的差异部分，极大提升效率
- **原生支持**: Linux原生命令，稳定可靠
- **进度监控**: `--progress` 参数显示实时传输进度
- **断点续传**: `--partial` 参数支持中断恢复
- **保持属性**: `-a` 参数保持文件权限、时间戳等属性
- **剪切支持**: `--remove-source-files` 参数实现移动操作
- **错误处理**: 内置重试机制和详细错误报告

#### 认证处理

##### SSH密钥认证（推荐）
```bash
# 使用SSH密钥认证（无需密码）
rsync -avz --progress -e "ssh -i ~/.ssh/id_rsa" user@source_host:/path/ user@target_host:/path/

# 指定SSH端口
rsync -avz --progress -e "ssh -p 2222 -i ~/.ssh/id_rsa" user@source_host:/path/ user@target_host:/path/
```

##### 密码认证处理
由于rsync需要交互式输入密码，我们需要特殊处理：

**方案1: 使用sshpass（如果可用）**
```bash
# 需要在源服务器上安装sshpass
sshpass -p 'target_password' rsync -avz --progress user@source_host:/path/ user@target_host:/path/
```

**方案2: 预先建立SSH密钥信任**
```typescript
// 在建立连接时，自动设置SSH密钥信任
async function setupSSHKeyTrust(sourceSession: SessionInfo, targetSession: SessionInfo) {
  // 1. 在源服务器生成SSH密钥（如果不存在）
  await sshService.executeCommand(sourceSession.id, 'ssh-keygen -t rsa -N "" -f ~/.ssh/id_rsa');

  // 2. 获取公钥
  const publicKey = await sshService.executeCommand(sourceSession.id, 'cat ~/.ssh/id_rsa.pub');

  // 3. 将公钥添加到目标服务器的authorized_keys
  const addKeyCommand = `echo "${publicKey.trim()}" >> ~/.ssh/authorized_keys`;
  await sshService.executeCommand(targetSession.id, addKeyCommand);

  // 4. 设置正确的权限
  await sshService.executeCommand(targetSession.id, 'chmod 600 ~/.ssh/authorized_keys');
  await sshService.executeCommand(targetSession.id, 'chmod 700 ~/.ssh');
}
```

**方案3: 使用expect脚本**
```bash
# 创建expect脚本处理密码输入
expect << EOF
spawn rsync -avz --progress user@source_host:/path/ user@target_host:/path/
expect "password:"
send "target_password\r"
expect eof
EOF
```
```typescript
interface CrossSessionTransfer {
  sourceSession: SessionInfo;  // 源服务器连接信息
  targetSession: SessionInfo;  // 目标服务器连接信息
  sourceFiles: FileEntry[];
  sourcePath: string;
  targetPath: string;
  operation: 'copy' | 'cut';
}

// 构建rsync命令
function buildRsyncCommand(transfer: CrossSessionTransfer): string {
  const { sourceSession, targetSession, sourceFiles, sourcePath, targetPath } = transfer;

  const sourceAddr = `${sourceSession.username}@${sourceSession.host}`;
  const targetAddr = `${targetSession.username}@${targetSession.host}`;

  if (sourceFiles.length === 1) {
    const file = sourceFiles[0];
    const sourceFullPath = `${sourceAddr}:${sourcePath}/${file.name}`;
    const targetFullPath = `${targetAddr}:${targetPath}/`;

    return `rsync -avz --progress "${sourceFullPath}" "${targetFullPath}"`;
  } else {
    // 批量传输需要分别执行
    return sourceFiles.map(file => {
      const sourceFullPath = `${sourceAddr}:${sourcePath}/${file.name}`;
      const targetFullPath = `${targetAddr}:${targetPath}/`;
      return `rsync -avz --progress "${sourceFullPath}" "${targetFullPath}"`;
    });
  }
}
```

## 🏗️ 核心组件实现

### 1. 剪贴板管理器
```typescript
// src/renderer/services/ClipboardManager.ts
export interface ClipboardItem {
  files: FileEntry[];
  operation: 'copy' | 'cut';
  sourcePath: string;
  sourceSessionId: string;
  timestamp: number;
}

export class ClipboardManager {
  private static instance: ClipboardManager;
  private clipboard: ClipboardItem | null = null;
  private cutFiles: Set<string> = new Set(); // 记录被剪切的文件
  
  static getInstance(): ClipboardManager {
    if (!ClipboardManager.instance) {
      ClipboardManager.instance = new ClipboardManager();
    }
    return ClipboardManager.instance;
  }
  
  copy(files: FileEntry[], sourcePath: string, sessionId: string): void {
    this.clearCutState(); // 清除之前的剪切状态
    this.clipboard = {
      files: [...files],
      operation: 'copy',
      sourcePath,
      sourceSessionId: sessionId,
      timestamp: Date.now()
    };
    console.log('[ClipboardManager] 复制文件到剪贴板:', files.map(f => f.name));
  }
  
  cut(files: FileEntry[], sourcePath: string, sessionId: string): void {
    this.clearCutState(); // 清除之前的剪切状态
    this.clipboard = {
      files: [...files],
      operation: 'cut',
      sourcePath,
      sourceSessionId: sessionId,
      timestamp: Date.now()
    };
    
    // 标记被剪切的文件
    files.forEach(file => {
      this.cutFiles.add(`${sessionId}:${sourcePath}/${file.name}`);
    });
    
    console.log('[ClipboardManager] 剪切文件到剪贴板:', files.map(f => f.name));
  }
  
  getClipboard(): ClipboardItem | null {
    return this.clipboard;
  }
  
  clear(): void {
    this.clipboard = null;
    this.clearCutState();
  }
  
  hasContent(): boolean {
    return this.clipboard !== null;
  }
  
  isCutFile(sessionId: string, filePath: string): boolean {
    return this.cutFiles.has(`${sessionId}:${filePath}`);
  }
  
  private clearCutState(): void {
    this.cutFiles.clear();
  }
  
  // 粘贴完成后清理剪切状态
  onPasteComplete(): void {
    if (this.clipboard?.operation === 'cut') {
      this.clear();
    }
  }
}
```

### 2. 文件操作服务
```typescript
// src/renderer/services/FileOperationService.ts
export interface CopyPasteOptions {
  sourceFiles: FileEntry[];
  sourcePath: string;
  sourceSessionId: string;
  targetPath: string;
  targetSessionId: string;
  operation: 'copy' | 'cut';
  onProgress?: (progress: number, currentFile: string, totalFiles: number, currentIndex: number) => void;
  onConflict?: (file: string) => Promise<'overwrite' | 'skip' | 'rename'>;
}

export class FileOperationService {
  
  async executeCopyPaste(options: CopyPasteOptions): Promise<void> {
    const { sourceSessionId, targetSessionId } = options;
    
    if (sourceSessionId === targetSessionId) {
      // 同一会话内操作
      await this.sameSessionOperation(options);
    } else {
      // 跨会话操作
      await this.crossSessionOperation(options);
    }
  }
  
  private async sameSessionOperation(options: CopyPasteOptions): Promise<void> {
    const { sourceFiles, sourcePath, targetPath, operation, onProgress } = options;

    for (let i = 0; i < sourceFiles.length; i++) {
      const file = sourceFiles[i];
      const sourceFullPath = `${sourcePath}/${file.name}`.replace(/\/+/g, '/');

      onProgress?.(0, file.name, sourceFiles.length, i + 1);

      try {
        let command: string;

        if (operation === 'copy') {
          if (file.isDirectory) {
            // 文件夹复制：注意源路径末尾的斜杠
            command = `rsync -avz --progress "${sourceFullPath}/" "${targetPath}/${file.name}/"`;
          } else {
            // 文件复制
            command = `rsync -avz --progress "${sourceFullPath}" "${targetPath}/"`;
          }
        } else { // cut
          if (file.isDirectory) {
            // 文件夹移动
            command = `rsync -avz --progress --remove-source-files "${sourceFullPath}/" "${targetPath}/${file.name}/" && find "${sourceFullPath}" -type d -empty -delete`;
          } else {
            // 文件移动
            command = `rsync -avz --progress --remove-source-files "${sourceFullPath}" "${targetPath}/"`;
          }
        }

        // 执行命令并监控进度
        await this.executeCommandWithProgress(options.sourceSessionId, command, (progress) => {
          onProgress?.(progress, file.name, sourceFiles.length, i + 1);
        });

      } catch (error) {
        console.error(`操作失败: ${file.name}`, error);
        throw error;
      }
    }
  }
  
  private async crossSessionOperation(options: CopyPasteOptions): Promise<void> {
    const { sourceFiles, sourcePath, sourceSessionId, targetPath, targetSessionId, operation, onProgress } = options;

    // 获取源和目标会话信息
    const sourceSession = await this.getSessionInfo(sourceSessionId);
    const targetSession = await this.getSessionInfo(targetSessionId);

    for (let i = 0; i < sourceFiles.length; i++) {
      const file = sourceFiles[i];

      try {
        onProgress?.(0, `传输 ${file.name}`, sourceFiles.length, i + 1);

        // 构建rsync命令（在源服务器上执行）
        const command = this.buildCrossSessionCommand({
          sourceSession,
          targetSession,
          sourceFiles: [file],
          sourcePath,
          targetPath,
          operation
        });

        // 在源服务器上执行传输命令
        await this.executeCommandWithProgress(sourceSessionId, command, (progress) => {
          onProgress?.(progress, file.name, sourceFiles.length, i + 1);
        });

        // 如果是剪切操作，删除源文件
        if (operation === 'cut') {
          await this.deleteFile(sourceSessionId, `${sourcePath}/${file.name}`);
        }

        onProgress?.(100, file.name, sourceFiles.length, i + 1);

      } catch (error) {
        console.error(`跨会话传输失败: ${file.name}`, error);
        throw error;
      }
    }
  }

  private buildCrossSessionCommand(transfer: {
    sourceSession: SessionInfo;
    targetSession: SessionInfo;
    sourceFiles: FileEntry[];
    sourcePath: string;
    targetPath: string;
    operation: 'copy' | 'cut';
  }): string {
    const { sourceSession, targetSession, sourceFiles, sourcePath, targetPath } = transfer;

    const file = sourceFiles[0]; // 单个文件处理
    const sourceFullPath = `${sourcePath}/${file.name}`.replace(/\/+/g, '/');
    const targetAddr = `${targetSession.username}@${targetSession.host}`;
    const targetFullPath = `${targetAddr}:${targetPath}/`;

    if (file.isDirectory) {
      // 文件夹使用rsync递归传输
      return `rsync -avz --progress "${sourceFullPath}/" "${targetFullPath}${file.name}/"`;
    } else {
      // 文件使用rsync传输
      return `rsync -avz --progress "${sourceFullPath}" "${targetFullPath}"`;
    }
  }

  private async executeCommandWithProgress(
    sessionId: string,
    command: string,
    onProgress: (progress: number) => void
  ): Promise<void> {
    // 执行命令并解析rsync的进度输出
    // rsync --progress 会输出类似: "1,234,567  45%  1.23MB/s    0:00:12"
    const result = await sshService.executeCommandWithCallback(sessionId, command, (output) => {
      const progressMatch = output.match(/(\d+)%/);
      if (progressMatch) {
        const progress = parseInt(progressMatch[1]);
        onProgress(progress);
      }
    });

    return result;
  }
  
  private async executeCommand(command: string): Promise<string> {
    // 调用SSH服务执行命令
    return await sshService.executeCommand(command);
  }
  
  private async getSessionInfo(sessionId: string): Promise<SessionInfo> {
    // 获取会话信息的实现
    // 实现细节...
    return {} as SessionInfo;
  }
}
```

### 3. 进度监控实现

由于统一使用rsync命令，进度监控变得非常简单，rsync的`--progress`参数会输出标准格式的进度信息：

```typescript
// rsync进度解析工具
export class RsyncProgressParser {
  // 解析rsync进度输出
  static parseProgress(output: string): {
    bytesTransferred: number;
    percentage: number;
    speed: string;
    timeRemaining: string;
  } | null {
    // rsync进度格式: "1,234,567  45%  1.23MB/s    0:00:12"
    const progressRegex = /(\d+(?:,\d+)*)\s+(\d+)%\s+([\d.]+[KMGT]?B\/s)\s+(\d+:\d+:\d+)/;
    const match = output.match(progressRegex);

    if (match) {
      return {
        bytesTransferred: parseInt(match[1].replace(/,/g, '')),
        percentage: parseInt(match[2]),
        speed: match[3],
        timeRemaining: match[4]
      };
    }
    return null;
  }

  // 简化版本，只提取百分比
  static extractPercentage(output: string): number | null {
    const match = output.match(/(\d+)%/);
    return match ? parseInt(match[1]) : null;
  }
}
```

## 📱 UI组件集成

### 1. 右键菜单扩展
在 `FileListContextMenu.tsx` 中添加复制粘贴选项：

```typescript
// 添加到菜单项配置中
const clipboardManager = ClipboardManager.getInstance();
const hasClipboardContent = clipboardManager.hasContent();

const menuItems = [
  // ... 现有菜单项
  {
    type: 'divider' as const
  },
  {
    key: 'copy',
    label: '复制',
    disabled: isBlankArea || !hasSelectedFiles,
    icon: <CopyOutlined />
  },
  {
    key: 'cut', 
    label: '剪切',
    disabled: isBlankArea || !hasSelectedFiles,
    icon: <ScissorOutlined />
  },
  {
    key: 'paste',
    label: '粘贴',
    disabled: !hasClipboardContent,
    icon: <PasteOutlined />
  }
];
```

### 2. 进度对话框
复用现有的进度对话框组件，或创建新的复制粘贴专用进度对话框。

这个技术方案明确了不同场景下使用的具体Linux命令和实现方式，你觉得这个方案如何？
