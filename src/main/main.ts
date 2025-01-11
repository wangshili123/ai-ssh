import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { registerStorageHandlers } from './ipc/storage';
import { initSSHHandlers } from './ipc/ssh';
import { sshService } from './services/ssh';

// 注册所有IPC处理器
function registerIPCHandlers() {
  console.log('Registering IPC handlers...');
  registerStorageHandlers();
  initSSHHandlers();
  console.log('IPC handlers registered.');
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

// 初始化应用
function initialize() {
  console.log('Initializing application...');
  registerIPCHandlers();
  createWindow();
  console.log('Application initialized.');
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