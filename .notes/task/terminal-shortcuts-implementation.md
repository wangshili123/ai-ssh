# 终端快捷键配置实现

## 实现内容

### 1. 快捷键配置修改
- ✅ 将默认补全快捷键从 `Tab` 改为 `Ctrl+Tab`
- ✅ 保持 `Alt+/` 作为备用快捷键
- ✅ 支持配置所有补全相关快捷键

### 2. 配置系统重构
- ✅ 新增 `TerminalShortcutConfig` 接口定义
- ✅ 创建 `TerminalShortcutConfigManager` 配置管理器
- ✅ 创建 `TerminalShortcutConfigContent` UI组件
- ✅ 将配置保存方式从 localStorage 改为 ui-config 文件系统

### 3. 快捷键处理优化
- ✅ 重构 `useTerminalInit` 中的键盘事件处理
- ✅ 使用配置化的快捷键匹配逻辑
- ✅ 支持动态快捷键配置

### 4. UI界面优化
- ✅ 创建 `ShortcutInput` 自动识别按键组件
- ✅ 分区域显示：智能补全 + 终端操作
- ✅ 压缩布局，减少空间占用
- ✅ 移除冗余的使用说明

## 配置项说明

### 终端快捷键配置
```typescript
interface TerminalShortcutConfig {
  // 智能补全快捷键
  acceptCompletion: string;      // 接受补全建议，默认 'Ctrl+Tab'
  acceptCompletionAlt: string;   // 备用接受补全建议，默认 'Alt+/'
  clearCompletion: string;       // 清除补全建议，默认 'Escape'
  navigateUp: string;            // 向上导航，默认 'Alt+ArrowUp'
  navigateDown: string;          // 向下导航，默认 'Alt+ArrowDown'

  // 终端操作快捷键
  copy: string;                  // 复制，默认 'Ctrl+Shift+C'
  paste: string;                 // 粘贴，默认 'Ctrl+Shift+V'
  clear: string;                 // 清空终端，默认 'Ctrl+Shift+L'
  search: string;                // 搜索，默认 'Ctrl+Shift+F'
}
```

### 默认配置

#### 智能补全
- **主要补全快捷键**: `Ctrl+Tab`
- **备用补全快捷键**: `Alt+/`
- **清除补全**: `Escape`
- **向上导航**: `Alt+ArrowUp`
- **向下导航**: `Alt+ArrowDown`

#### 终端操作
- **复制**: `Ctrl+Shift+C`
- **粘贴**: `Ctrl+Shift+V`
- **清空终端**: `Ctrl+Shift+L`
- **搜索**: `Ctrl+Shift+F`

## 使用方法

### 1. 配置快捷键
1. 打开应用设置（基础配置）
2. 选择"终端快捷键"选项卡
3. 双击想要修改的快捷键输入框
4. 在弹出的对话框中点击"开始录制"
5. 按下想要设置的快捷键组合
6. 松开所有按键后自动完成设置
7. 点击保存

### 2. 弹框录制交互
- **双击输入框**：打开快捷键设置对话框
- **开始录制**：点击"开始录制"按钮开始监听
- **实时显示**：录制过程中实时显示当前按键组合
- **自动完成**：松开所有按键后自动完成录制
- **清除功能**：支持清除已设置的快捷键

### 3. 界面布局
- **智能补全区域**：补全相关的5个快捷键
- **终端操作区域**：复制、粘贴、清空、搜索快捷键
- **紧凑布局**：2列网格布局，节省空间
- **一键重置**：支持重置为默认配置

## 技术实现

### 1. 配置存储
- 使用 ui-config 文件系统存储配置
- 配置文件位置：用户数据目录下的 ui-settings.json
- 支持配置备份和恢复

### 2. 快捷键匹配
```typescript
TerminalShortcutConfigManager.matchesShortcut(event, shortcut)
```
- 支持复合修饰键匹配
- 精确的键盘事件检测
- 跨平台兼容性

### 3. 配置管理
- 单例模式的配置管理器
- 异步配置保存
- 配置变更事件通知

### 4. ShortcutInput 组件特性
- **双击触发**：双击输入框打开设置对话框，界面更简洁
- **弹框录制**：独立的录制界面，避免干扰主界面
- **全局监听**：使用全局键盘事件监听，确保准确捕获
- **实时反馈**：录制过程中实时显示当前按键组合
- **智能完成**：松开所有按键后自动完成录制
- **特殊键映射**：正确处理 Space、Arrow、Enter、Escape 等特殊键
- **清除功能**：支持一键清除已设置的快捷键

## 文件结构

```
src/renderer/
├── types/baseconfig/
│   └── BaseConfigType.ts                    # 配置类型定义
├── services/config/
│   └── TerminalShortcutConfig.ts            # 快捷键配置管理器
├── components/BaseConfigModal/
│   ├── BaseConfigModal.tsx                 # 配置弹窗主组件
│   ├── TerminalShortcutConfigContent.tsx   # 快捷键配置UI组件
│   └── ShortcutInput.tsx                   # 自动识别按键输入组件
└── components/Terminal/hooks/
    └── useTerminalInit.ts                   # 终端初始化和键盘事件处理
```

## 注意事项

1. **配置生效时机**: 配置修改后需要重新打开终端标签页才能生效
2. **快捷键冲突**: 避免与系统或浏览器快捷键冲突
3. **兼容性**: 某些快捷键在不同操作系统上可能表现不同
4. **备份**: 配置会自动保存到文件系统，支持多设备同步

## 测试建议

### 智能补全快捷键测试
1. 测试默认快捷键 `Ctrl+Tab` 是否正常工作
2. 测试备用快捷键 `Alt+/` 是否正常工作
3. 测试导航快捷键 `Alt+ArrowUp/ArrowDown` 是否正常工作
4. 测试清除快捷键 `Escape` 是否正常工作

### 终端操作快捷键测试
1. 测试复制快捷键 `Ctrl+Shift+C` 是否正常工作
2. 测试粘贴快捷键 `Ctrl+Shift+V` 是否正常工作
3. 测试清空快捷键 `Ctrl+Shift+L` 是否正常工作
4. 测试搜索快捷键 `Ctrl+Shift+F` 是否正常工作

### 配置功能测试
1. 测试双击输入框打开设置对话框
2. 测试弹框录制按键功能
3. 测试实时显示按键组合
4. 测试松开按键自动完成录制
5. 测试配置修改和保存功能
6. 测试快捷键格式验证
7. 测试配置重置功能
8. 测试分区域显示效果
9. 测试清除快捷键功能
