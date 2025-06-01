# AI SSH Tool

一个基于Electron的AI驱动SSH客户端工具，提供智能命令补全、终端管理、文件浏览等功能。

## 项目概述

AI SSH Tool是一个现代化的SSH客户端，集成了人工智能技术来提升用户的命令行操作体验。主要特性包括：

- **智能命令补全**：基于历史记录、语法分析和AI的多层次补全系统
- **多标签终端管理**：支持同时管理多个SSH连接
- **集成文件浏览器**：可视化文件管理界面
- **AI助手**：提供命令建议和上下文帮助
- **鼠标定位光标**：点击终端任意位置快速移动光标到目标位置
- **会话管理**：保存和管理SSH连接配置

## 技术栈

- **前端框架**：React 18 + TypeScript
- **桌面应用**：Electron 25
- **UI组件库**：Ant Design 5
- **终端组件**：xterm.js
- **状态管理**：MobX + Redux Toolkit
- **数据库**：SQLite3 (better-sqlite3)
- **AI集成**：OpenAI API
- **SSH连接**：ssh2

## 最近更新

### 智能补全功能修复 (2024-12-19)

修复了智能补全功能中Alt+/快捷键无法正确将补全建议插入到终端的问题：

#### 问题描述
- Alt+/快捷键被处理为发送特殊序列`\x1b/`，但没有正确映射到补全接受功能
- Tab键补全功能缺失
- 键盘事件处理分散，缺乏统一管理

#### 修复内容
1. **重构键盘事件处理**：
   - 在`useTerminalInit.ts`中统一处理Tab键和Alt+/快捷键
   - 添加了`acceptSuggestion`和`updatePendingCommand`回调函数支持

2. **完善补全接受逻辑**：
   - Tab键：接受当前选中的补全建议，如果没有建议则发送Tab字符
   - Alt+/：专门用于接受补全建议的快捷键

3. **修复类型定义**：
   - 更新`UseTerminalInitProps`接口，添加补全相关回调函数
   - 修正`UseCompletionReturn`中的返回类型定义

4. **改进补全状态管理**：
   - 修复`acceptSuggestion`函数，确保在返回前更新`pendingCommandRef`和`currentInput`状态
   - 避免重复调用状态更新函数，防止状态不同步
   - 直接向SSH服务发送补全部分，而不通过`handleInput`避免重复处理

5. **优化输入处理逻辑**：
   - 改进`useCommandHandler`中的字符输入判断，只对可见ASCII字符更新命令状态
   - 防止非可见字符干扰命令状态追踪

#### 使用方法
- **Tab键**：接受当前高亮的补全建议
- **Alt+/**：接受当前高亮的补全建议（专用快捷键）
- **ESC键**：关闭补全建议框
- **Alt+上/下箭头**：在补全建议列表中导航

### 鼠标定位光标功能 (2024-12-22)

新增了鼠标点击定位光标功能，提升命令行编辑体验：

#### 功能特点
- **一键定位**：点击终端任意位置即可将光标移动到目标位置
- **智能限制**：可配置只在命令行区域生效，避免干扰文本选择
- **距离保护**：限制最大移动距离，防止误操作
- **兼容性好**：使用标准箭头键序列，兼容各种shell环境

#### 技术实现
1. **基于市场调研**：
   - 参考Windows Terminal、VSCode Terminal、iTerm2等主流实现
   - 借鉴xterm.js的MoveToCell思路
   - 使用标准ANSI转义序列确保兼容性

2. **核心组件**：
   - `mousePositioning.ts`：工具函数模块，提供位置计算和移动序列生成
   - `useMousePositioning.ts`：React Hook，处理鼠标事件和光标移动逻辑
   - `MousePositioningSettings.tsx`：配置面板组件

3. **实现原理**：
   - 计算鼠标点击位置对应的终端字符坐标
   - 生成从当前光标位置到目标位置的箭头键序列
   - 通过SSH发送模拟按键来移动光标

#### 配置选项
- **启用状态**：可通过右键菜单快速开启/关闭
- **仅命令行区域**：只在命令输入区域生效
- **要求Shell集成**：更精确但兼容性较低的模式
- **最大移动距离**：防止误操作的安全设置

#### 使用方法
1. 右键点击终端，选择"🖱️ 鼠标定位"
2. 在弹出的设置面板中开启功能
3. 在终端命令行中点击任意位置即可移动光标

## 安装和运行

### 环境要求
- Node.js 18.x 或更高版本
- Python（用于某些npm包的编译）

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
npm start
```

### 构建应用
```bash
npm run build
```

## 项目结构

```
src/
├── main/                   # Electron主进程
├── renderer/               # React渲染进程
│   ├── components/         # React组件
│   │   ├── Terminal/       # 终端相关组件
│   │   ├── FileBrowser/    # 文件浏览器组件
│   │   └── AIAssistant/    # AI助手组件
│   └── services/           # 服务层
│       ├── completion/     # 智能补全服务
│       ├── ssh/           # SSH连接服务
│       └── eventBus.ts    # 事件总线
└── services/               # 共享服务
    ├── completion/         # 补全引擎
    └── terminal/          # 终端分析服务
```

## 配置

### 环境变量
创建`.env`文件：
```
OPENAI_API_KEY=your_api_key_here
```

### SSH连接配置
应用内提供图形化界面来管理SSH连接配置。

## 贡献

欢迎提交Issue和Pull Request来改进这个项目。

## 许可证

本项目采用MIT许可证。 