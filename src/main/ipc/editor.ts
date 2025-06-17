import { ipcMain, BrowserWindow } from 'electron';
import * as path from 'path';

// 维护活跃的编辑器窗口
let activeEditorWindow: BrowserWindow | null = null;

// 待处理的标签队列
const pendingTabs: any[] = [];

/**
 * 注册编辑器相关的IPC处理程序
 */
export function registerEditorHandlers(): void {
  console.log('[IPC] 注册编辑器处理程序');

  // 监听编辑器窗口准备就绪的消息
  ipcMain.on('editor-window-ready', (event) => {
    console.log('[Editor] 收到窗口准备就绪消息');
    
    // 找到发送消息的窗口
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      console.log('[Editor] 窗口已准备就绪:', win.id);
      
      // 确保将此窗口设置为活跃窗口
      activeEditorWindow = win;
      
      // 处理待处理的标签
      if (pendingTabs.length > 0) {
        console.log('[Editor] 处理待处理的标签:', pendingTabs.length);
        pendingTabs.forEach(tab => {
          win.webContents.send('add-editor-tab', tab);
        });
        pendingTabs.length = 0; // 清空队列
      }
    }
  });

  // 打开编辑器窗口
  ipcMain.handle('open-editor-window', async (event, {
    windowId,
    filePath,
    sessionId,
    title
  }) => {
    console.log('[Editor] 打开编辑器窗口:', { windowId, filePath, sessionId, title });

    try {
      // 准备标签信息
      const tabInfo = {
        id: windowId,
        filePath,
        sessionId,
        title: title || filePath.split('/').pop() || 'Editor'
      };

      // 检查活跃窗口是否存在且未被销毁
      if (activeEditorWindow && !activeEditorWindow.isDestroyed()) {
        console.log('[Editor] 使用已有窗口，添加新标签');
        
        // 发送消息到已有窗口添加标签
        activeEditorWindow.webContents.send('add-editor-tab', tabInfo);
        
        // 激活窗口
        if (activeEditorWindow.isMinimized()) {
          activeEditorWindow.restore();
        }
        activeEditorWindow.focus();
        
        // 通知渲染进程标签已添加
        event.sender.send(`editor-tab-added-${windowId}`, { success: true });
        
        return { success: true, newWindow: false };
      }

      // 创建新窗口
      console.log('[Editor] 创建新窗口');
      const window = new BrowserWindow({
        width: 1200,
        height: 800,
        title: '文件编辑器',
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
          webSecurity: false
        }
      });

      // 记录活跃窗口
      activeEditorWindow = window;
      console.log('[Editor] 设置活跃窗口:', activeEditorWindow.id);

      // 将当前标签添加到待处理队列
      pendingTabs.push(tabInfo);

      // 当窗口关闭时，清除引用
      window.on('closed', () => {
        console.log('[Editor] 窗口已关闭，清除活跃窗口引用');
        if (activeEditorWindow === window) {
          activeEditorWindow = null;
        }
        event.sender.send(`editor-window-closed-${windowId}`);
      });

      // 监听关闭请求
      ipcMain.on(`editor-window-close-${windowId}`, () => {
        console.log('[Editor] 收到关闭请求:', windowId);
        if (window && !window.isDestroyed()) {
          window.close();
        }
      });

      // 加载编辑器页面
      if (process.env.NODE_ENV === 'development') {
        const url = `http://localhost:3001/editor.html?windowId=${windowId}&filePath=${encodeURIComponent(filePath)}&sessionId=${sessionId}`;
        console.log('[Editor] 开发环境加载URL:', url);
        await window.loadURL(url);
        window.webContents.openDevTools();
      } else {
        // 在生产环境中，__dirname 指向 dist/main/ipc，需要正确定位到 dist/renderer/editor.html
        const htmlPath = path.join(__dirname, '../../renderer/editor.html');
        console.log('[Editor] 生产环境加载文件:', htmlPath);
        await window.loadFile(htmlPath, {
          query: {
            windowId,
            filePath: encodeURIComponent(filePath),
            sessionId
          }
        });
      }

      return { success: true, newWindow: true };
    } catch (error) {
      console.error('[Editor] 打开窗口失败:', error);
      throw error;
    }
  });

  // 注册一个处理程序，用于检查编辑器窗口是否存在
  ipcMain.handle('check-editor-window-exists', () => {
    return { exists: activeEditorWindow !== null && !activeEditorWindow.isDestroyed() };
  });
} 