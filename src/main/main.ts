import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { registerAllHandlers } from './ipc';

// 创建主窗口
function createWindow() {
  console.log('创建主窗口...');
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  if (process.env.NODE_ENV === 'development') {
    console.log('加载开发环境 URL...');
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    console.log('加载生产环境文件...');
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('窗口内容加载完成');
  });
}

// 初始化应用
function initialize() {
  console.log('初始化应用...');
  // 注册所有 IPC 处理程序
  registerAllHandlers();
  // 创建窗口
  createWindow();
  console.log('应用初始化完成');
}

app.whenReady().then(() => {
  initialize();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
}); 