# 鼠标定位功能

## 功能概述

鼠标定位功能允许用户通过点击终端中的任意位置，将光标快速移动到该位置。这大大提高了终端操作的效率，特别是在编辑长命令时。

## 实现原理

### 1. 事件监听
- 使用全局 `mouseup` 事件监听器捕获鼠标点击
- 只处理终端容器内的左键点击事件
- 自动过滤终端外的点击，避免干扰

### 2. 位置计算
- 获取当前光标在终端中的位置（行、列）
- 计算点击位置相对于 xterm-screen 元素的坐标
- 根据终端的字符尺寸将像素坐标转换为字符位置
- 计算需要移动的行数和列数

### 3. 光标移动
- 生成相应的 ANSI 转义序列：
  - `\x1b[A` - 上移一行
  - `\x1b[B` - 下移一行  
  - `\x1b[C` - 右移一列
  - `\x1b[D` - 左移一列
- 通过 SSH 连接发送移动序列到远程终端

## 核心代码

位置在：`src/renderer/components/Terminal/index.tsx`

```typescript
// 鼠标点击处理器
const handleMouseClick = (event: MouseEvent) => {
  // 检查点击是否在终端容器内
  const isInTerminal = container.contains(event.target as Node);
  if (!isInTerminal || event.button !== 0) {
    return; // 只处理终端内的左键点击
  }
  
  // 处理鼠标定位
  if (terminalRef.current && shellIdRef.current) {
    const terminal = terminalRef.current;
    
    // 获取当前光标位置
    const currentPos = {
      row: terminal.buffer.active.cursorY + 1,
      col: terminal.buffer.active.cursorX + 1,
    };
    
    // 计算点击位置
    const xtermScreen = container.querySelector('.xterm-screen') as HTMLElement;
    if (!xtermScreen) return;
    
    const screenRect = xtermScreen.getBoundingClientRect();
    const relativeX = event.clientX - screenRect.left;
    const relativeY = event.clientY - screenRect.top;
    
    // 计算字符尺寸
    const charWidth = screenRect.width / terminal.cols;
    const charHeight = screenRect.height / terminal.rows;
    
    const targetCol = Math.max(1, Math.floor(relativeX / charWidth) + 1);
    const targetRow = Math.max(1, Math.floor(relativeY / charHeight) + 1);
    
    // 计算移动距离
    const deltaRow = targetRow - currentPos.row;
    const deltaCol = targetCol - currentPos.col;
    
    // 生成移动序列
    let movementSequence = '';
    
    // 垂直移动
    if (deltaRow > 0) {
      movementSequence += '\x1b[B'.repeat(deltaRow); // 下移
    } else if (deltaRow < 0) {
      movementSequence += '\x1b[A'.repeat(-deltaRow); // 上移
    }
    
    // 水平移动
    if (deltaCol > 0) {
      movementSequence += '\x1b[C'.repeat(deltaCol); // 右移
    } else if (deltaCol < 0) {
      movementSequence += '\x1b[D'.repeat(-deltaCol); // 左移
    }
    
    // 确保终端获得焦点
    terminal.focus();
    
    // 发送移动序列
    if (movementSequence && shellIdRef.current) {
      sshService.write(shellIdRef.current, movementSequence).catch(error => {
        console.error('[Terminal] Failed to send cursor movement:', error);
      });
    }
    
    // 阻止事件传播
    event.preventDefault();
    event.stopPropagation();
  }
};
```

## 使用方法

1. 在终端中输入任意命令
2. 直接点击命令中的任意位置
3. 光标会立即跳转到点击位置

## 技术细节

### 为什么使用 mouseup 事件？
- 在复杂的 DOM 结构中（如 xterm.js），`click` 事件可能被阻止
- `mouseup` 事件更可靠，总是会触发
- 确保在各种情况下都能正常工作

### 坐标系统
- 使用 `xterm-screen` 元素作为参考坐标系
- 字符尺寸通过 `screenRect.width / terminal.cols` 计算
- 位置从 1 开始计数（符合终端惯例）

### 错误处理
- 自动检查必要的 DOM 元素是否存在
- 处理 SSH 连接失败的情况
- 边界检查确保位置在有效范围内

## 兼容性

- 支持所有现代浏览器
- 与 xterm.js 完全兼容
- 适用于各种终端尺寸和字体设置
- 支持远程 SSH 连接

## 性能优化

- 事件处理器只在必要时添加
- 最小化 DOM 查询
- 高效的 ANSI 序列生成
- 自动清理事件监听器 