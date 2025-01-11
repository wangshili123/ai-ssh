import { app, BrowserWindow, Menu, MenuItemConstructorOptions } from 'electron';
import * as path from 'path';

// 创建菜单模板
const template: MenuItemConstructorOptions[] = [
  {
    label: '文件',
    submenu: [
      { label: '新建会话', accelerator: 'CmdOrCtrl+N' },
      { type: 'separator' },
      { label: '退出', role: 'quit' }
    ]
  },
  {
    label: '编辑',
    submenu: [
      { label: '撤销', role: 'undo' },
      { label: '重做', role: 'redo' },
      { type: 'separator' },
      { label: '剪切', role: 'cut' },
      { label: '复制', role: 'copy' },
      { label: '粘贴', role: 'paste' },
      { label: '删除', role: 'delete' },
      { type: 'separator' },
      { label: '全选', role: 'selectAll' }
    ]
  },
  {
    label: '视图',
    submenu: [
      { label: '重新加载', role: 'reload' },
      { label: '强制重新加载', role: 'forceReload' },
      { type: 'separator' },
      { label: '实际大小', role: 'resetZoom' },
      { label: '放大', role: 'zoomIn' },
      { label: '缩小', role: 'zoomOut' },
      { type: 'separator' },
      { label: '全屏', role: 'togglefullscreen' }
    ]
  },
  {
    label: '帮助',
    submenu: [
      {
        label: '关于',
        click: async () => {
          // TODO: 显示关于对话框
        }
      }
    ]
  }
];

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // 根据环境加载不同的页面
  const isDev = process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  // 设置应用菜单
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
}); 