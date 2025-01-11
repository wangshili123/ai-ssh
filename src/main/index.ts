import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { registerStorageHandlers } from './ipc/storage';
import { initSSHHandlers } from './ipc/ssh';
import { sshService } from './services/ssh';

let mainWindow: BrowserWindow | null = null;

// 注册所有IPC处理器
function registerIPCHandlers() {
  console.log('开始注册 IPC 处理器...');
  try {
    console.log('注册存储处理器...');
    registerStorageHandlers();
    console.log('存储处理器注册完成');

    console.log('注册 SSH 处理器...');
    initSSHHandlers();
    console.log('SSH 处理器注册完成');
  } catch (error) {
    console.error('注册 IPC 处理器时出错:', error);
    throw error; // 重新抛出错误，确保初始化失败时应用不会继续
  }
  console.log('所有 IPC 处理器注册完成');
}

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

// 初始化应用
function initialize() {
  console.log('开始初始化应用...');
  
  // 先注册IPC处理器
  registerIPCHandlers();
  
  // 然后创建窗口
  createWindow();
  
  console.log('应用初始化完成');
}

// 在应用启动时就注册 IPC 处理器
console.log('正在启动应用...');
registerIPCHandlers();

app.on('ready', () => {
  console.log('应用就绪，开始创建窗口...');
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