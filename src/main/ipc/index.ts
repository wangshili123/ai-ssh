import { registerStorageHandlers } from './storage';
import { initSSHHandlers } from './ssh';
import { registerSFTPHandlers } from './sftp';
import { registerEditorHandlers } from './editor';
import { registerDownloadHandlers } from './download';
import { uploadIPCHandler } from './upload';
import { ipcMain, app } from 'electron';

/**
 * 注册所有IPC处理器
 */
export function registerAllHandlers(): void {
  console.log('开始注册所有 IPC 处理程序...');
  
  try {
    // 注册编辑器处理程序
    console.log('注册编辑器处理程序...');
    registerEditorHandlers();
    
    // 注册存储处理程序
    console.log('注册存储处理程序...');
    registerStorageHandlers();
    
    // 注册 SSH 处理程序
    console.log('注册 SSH 处理程序...');
    initSSHHandlers();
    
    // 注册 SFTP 处理程序
    console.log('注册 SFTP 处理程序...');
    registerSFTPHandlers();

    // 注册下载处理程序
    console.log('注册下载处理程序...');
    registerDownloadHandlers();

    // 注册上传处理程序
    console.log('注册上传处理程序...');
    uploadIPCHandler.registerHandlers();

    // 添加获取应用路径的处理程序
    console.log('注册获取应用路径的处理程序...');
    ipcMain.handle('get-app-path', () => {
      return app.getAppPath();
    });

    // 添加获取用户数据路径的处理程序
    console.log('注册获取用户数据路径的处理程序...');
    ipcMain.on('get-user-data-path', (event) => {
      console.log('收到获取用户数据路径请求');
      const userDataPath = app.getPath('userData');
      console.log('返回用户数据路径:', userDataPath);
      event.returnValue = userDataPath;
    });
    
    console.log('所有 IPC 处理程序注册完成');
  } catch (error) {
    console.error('注册 IPC 处理程序时出错:', error);
    throw error;
  }
} 