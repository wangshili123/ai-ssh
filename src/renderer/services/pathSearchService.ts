import { sftpConnectionManager } from './sftpConnectionManager';

/**
 * 路径搜索服务
 * 负责根据输入的路径前缀搜索匹配的路径
 */

/**
 * 搜索匹配的路径
 * @param tabId 标签页ID
 * @param searchText 搜索文本
 * @returns 匹配的路径列表
 */
export const searchPaths = async (tabId: string, searchText: string): Promise<string[]> => {
  try {
    // 如果搜索文本为空，返回根目录
    if (!searchText || searchText === '/') {
      return ['/'];
    }

    // 获取父目录路径
    const parentPath = searchText.substring(0, searchText.lastIndexOf('/') + 1) || '/';
    const searchPattern = searchText.substring(searchText.lastIndexOf('/') + 1).toLowerCase();

    // 读取父目录下的所有目录
    const files = await sftpConnectionManager.readDirectory(tabId, parentPath);
    
    // 过滤出目录，并且名称匹配搜索文本
    const matchingDirs = files
      .filter(file => file.isDirectory && file.name.toLowerCase().includes(searchPattern))
      .map(file => {
        const path = `${parentPath === '/' ? '' : parentPath}/${file.name}`.replace(/\/+/g, '/');
        return path;
      });

    // 如果父目录本身也匹配搜索文本，添加到结果中
    if (parentPath.toLowerCase().includes(searchPattern)) {
      matchingDirs.unshift(parentPath);
    }

    console.log('[PathSearch] 搜索结果:', {
      searchText,
      parentPath,
      searchPattern,
      matchCount: matchingDirs.length
    });

    return matchingDirs;
  } catch (error) {
    console.error('[PathSearch] 搜索路径失败:', error);
    return [];
  }
}; 