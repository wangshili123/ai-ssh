# 文件删除功能实现计划

## 功能需求调整

根据用户反馈，删除功能需求如下：
1. **不需要批量删除功能** - 只处理单个文件/文件夹删除
2. **不需要删除进度** - 删除成功后显示成功提示即可
3. **代码组织** - 删除逻辑不要写在FileList下面，放在同目录下的新文件或功能文件夹中

## 技术实现方案

### 1. 文件结构设计

```
src/renderer/components/FileBrowser/FileList/components/
├── ContextMenu/
│   ├── FileListContextMenu.tsx          # 现有右键菜单组件
│   ├── actions/                         # 新增：菜单操作功能文件夹
│   │   ├── deleteAction.ts              # 删除功能逻辑
│   │   └── index.ts                     # 导出所有操作
│   └── FileListContextMenu.css
```

### 2. 删除功能设计

#### 2.1 删除方式
- **安全删除**：移动到远程服务器的回收站目录 `~/.trash/`
- **永久删除**：使用 `rm -rf` 命令直接删除

#### 2.2 用户交互流程
1. 用户右键点击文件/文件夹
2. 显示右键菜单，包含两个删除选项：
   - "移动到回收站" - 安全删除
   - "永久删除" - 不可恢复删除
3. 点击删除选项后显示确认对话框
4. 用户确认后执行删除操作
5. 删除成功后显示成功提示并刷新文件列表

#### 2.3 确认对话框设计
- **安全删除确认**：
  ```
  确认移动到回收站？
  文件：filename.txt
  此操作可以通过回收站恢复
  [取消] [确认]
  ```

- **永久删除确认**：
  ```
  确认永久删除？
  文件：filename.txt
  ⚠️ 此操作不可恢复！
  [取消] [确认删除]
  ```

### 3. 技术实现细节

#### 3.1 删除服务 (deleteAction.ts)
```typescript
interface DeleteOptions {
  file: FileEntry;
  sessionInfo: SessionInfo;
  currentPath: string;
  type: 'safe' | 'permanent';
}

interface DeleteResult {
  success: boolean;
  message: string;
  error?: string;
}

class FileDeleteAction {
  // 安全删除 - 移动到回收站
  async safeDelete(options: DeleteOptions): Promise<DeleteResult>
  
  // 永久删除 - 直接删除
  async permanentDelete(options: DeleteOptions): Promise<DeleteResult>
  
  // 显示确认对话框
  private showConfirmDialog(file: FileEntry, type: 'safe' | 'permanent'): Promise<boolean>
  
  // 执行SSH删除命令
  private executeDeleteCommand(command: string, sessionInfo: SessionInfo): Promise<string>
}
```

#### 3.2 SSH命令设计
- **安全删除命令**：
  ```bash
  # 创建回收站目录（如果不存在）
  mkdir -p ~/.trash
  
  # 移动文件到回收站（添加时间戳避免冲突）
  mv "/path/to/file" ~/.trash/filename_$(date +%Y%m%d_%H%M%S)
  ```

- **永久删除命令**：
  ```bash
  # 删除文件
  rm -f "/path/to/file"
  
  # 删除文件夹
  rm -rf "/path/to/directory"
  ```

#### 3.3 错误处理
- 权限不足
- 文件不存在
- 网络连接问题
- SSH命令执行失败

#### 3.4 成功提示
- 使用 Ant Design 的 message 组件
- 安全删除：`文件已移动到回收站`
- 永久删除：`文件已永久删除`

### 4. 集成到现有组件

#### 4.1 修改 FileListContextMenu.tsx
- 导入删除操作功能
- 修改菜单项配置，替换现有的删除选项
- 添加两个删除选项：安全删除和永久删除

#### 4.2 文件列表刷新
- 删除成功后触发文件列表刷新
- 利用现有的文件浏览器刷新机制

### 5. 实现步骤

1. **创建删除功能模块** - 实现 deleteAction.ts
2. **修改右键菜单** - 更新 FileListContextMenu.tsx
3. **测试功能** - 验证删除操作和错误处理
4. **优化用户体验** - 完善提示信息和交互

### 6. 注意事项

- 确保SSH连接可用
- 处理特殊字符和空格的文件名
- 考虑不同操作系统的兼容性
- 添加适当的日志记录
- 确保删除操作的原子性

## 开始实现

准备按照以上计划开始实现删除功能。
