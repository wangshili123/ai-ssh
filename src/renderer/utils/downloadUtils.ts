/**
 * 下载相关工具函数
 */

/**
 * 获取默认下载路径
 */
export function getDefaultDownloadPath(): string {
  try {
    const { ipcRenderer } = window.require('electron');
    const path = window.require('path');
    
    // 尝试获取应用数据目录
    const userDataPath = ipcRenderer.sendSync('get-user-data-path');
    if (userDataPath) {
      return path.join(userDataPath, 'downloads');
    }
  } catch (error) {
    console.warn('无法获取应用数据路径，使用默认下载文件夹:', error);
  }
  
  // 降级到系统默认下载文件夹
  if (process.env.USERPROFILE) {
    return `${process.env.USERPROFILE}\\Downloads`;
  }
  
  // 最后的降级选项
  return '';
}

/**
 * 确保下载路径存在
 */
export async function ensureDownloadPath(downloadPath: string): Promise<boolean> {
  try {
    const fs = window.require('fs');
    
    if (!fs.existsSync(downloadPath)) {
      fs.mkdirSync(downloadPath, { recursive: true });
      console.log('创建下载目录:', downloadPath);
    }
    
    return true;
  } catch (error) {
    console.error('创建下载目录失败:', error);
    return false;
  }
}

/**
 * 格式化下载文件名，避免非法字符
 */
export function sanitizeFileName(fileName: string): string {
  // 移除或替换Windows文件名中的非法字符
  return fileName.replace(/[<>:"/\\|?*]/g, '_');
}
