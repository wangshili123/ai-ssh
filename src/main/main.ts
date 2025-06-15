import { app, BrowserWindow, Menu, MenuItemConstructorOptions, ipcMain } from 'electron';
import * as path from 'path';
import { registerAllHandlers } from './ipc';
import { localConfig } from '../config/local.config';

// 创建菜单
function createMenu() {
  // 添加调试日志
  console.log('App isPackaged:', app.isPackaged);
  console.log('NODE_ENV:', process.env.NODE_ENV);

  // 生产环境（打包后）隐藏菜单
  if (app.isPackaged) {
    console.log('隐藏菜单 - 生产环境');
    Menu.setApplicationMenu(null);
    return;
  }

  // 开发环境显示调试菜单
  const template: MenuItemConstructorOptions[] = [
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '刷新' },
        { role: 'forceReload', label: '强制刷新' },
        { role: 'toggleDevTools', label: '开发者工具' }
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// 创建主窗口
function createWindow(): BrowserWindow {
  console.log('创建主窗口...');
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: true
    }
  });

  // 立即打开开发者工具
  if (process.env.NODE_ENV === 'development') {
    setTimeout(() => {
      mainWindow.webContents.openDevTools({ mode: 'right' });
    }, 1000);
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('加载开发环境 URL...');
    mainWindow.loadURL(`http://localhost:${localConfig.mainPort}`);
  } else {
    console.log('加载生产环境文件...');
    // 生产环境下使用正确的路径
    const indexPath = path.join(__dirname, '../renderer/index.html');
    console.log('尝试加载文件:', indexPath);
    mainWindow.loadFile(indexPath);
    // 预热渲染进程
    mainWindow.webContents.once('did-finish-load', () => {
      console.log('渲染进程加载完成，应用就绪');
    });
  }

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('窗口内容加载完成');
    // 确保开发者工具打开
    if (process.env.NODE_ENV === 'development') {
      if (!mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.openDevTools({ mode: 'right' });
      }
    }
  });

  return mainWindow;
}

async function main() {
  try {
    // 等待应用程序就绪
    await app.whenReady();
    
    // 设置开发者工具选项
    app.commandLine.appendSwitch('remote-debugging-port', '9222');
    app.commandLine.appendSwitch('auto-open-devtools-for-tabs');
    
    // 创建菜单
    createMenu();
    
    // 注册所有 IPC 处理程序
    registerAllHandlers();
    
    // 创建主窗口
    createWindow();
    
    // 当所有窗口关闭时退出应用
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });
    
    // 当应用程序激活时，如果没有窗口则创建一个新窗口
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });

    console.log('应用程序初始化完成');
  } catch (error) {
    console.error('应用程序启动失败:', error);
    app.quit();
  }
}

// 启动应用程序
main(); 