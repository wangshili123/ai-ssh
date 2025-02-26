import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { registerAllHandlers } from './ipc';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // 加载应用
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 在应用准备就绪时初始化
app.whenReady().then(() => {
  // 注册所有IPC处理程序
  registerAllHandlers();

  // 创建窗口
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 当所有窗口关闭时退出应用
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 注册 get-app-path 处理程序
ipcMain.handle('get-app-path', () => {
  console.log('Received get-app-path request');
  const appPath = app.getAppPath();
  console.log('Returning app path:', appPath);
  return appPath;
}); 
