import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { registerAllHandlers } from './ipc';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  console.log('创建主窗口...');
  mainWindow = new BrowserWindow({
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

  mainWindow.on('closed', () => {
    console.log('窗口已关闭');
    mainWindow = null;
  });

  console.log('主窗口创建完成');
}

// 在应用就绪时初始化
app.whenReady().then(() => {
  console.log('应用就绪，开始初始化...');
  // 注册所有 IPC 处理程序
  registerAllHandlers();
  // 创建窗口
  createWindow();
});

app.on('activate', () => {
  console.log('应用激活');
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  console.log('所有窗口已关闭');
  if (process.platform !== 'darwin') {
    app.quit();
  }
}); 