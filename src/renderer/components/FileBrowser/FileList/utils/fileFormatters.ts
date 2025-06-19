import type { FileEntry } from '../../../../../main/types/file';

/**
 * 将权限数字转换为字符串表示
 */
export const formatPermissions = (permissions: number): string => {
  // 将权限转换为 4 位八进制字符串
  const modeStr = permissions.toString(8).padStart(5, '0');

  // 文件类型映射
  const fileType: { [key: string]: string } = {
    '0': '-', // 普通文件
    '1': 'p', // 命名管道
    '2': 'c', // 字符设备
    '4': 'd', // 目录
    '6': 'b', // 块设备
    '10': '-', // 普通文件
    '12': 'l', // 符号链接
    '14': 's'  // 套接字
  };

  // 权限位映射
  const permissionBits: { [key: string]: string } = {
    '0': '---',
    '1': '--x',
    '2': '-w-',
    '3': '-wx',
    '4': 'r--',
    '5': 'r-x',
    '6': 'rw-',
    '7': 'rwx'
  };

  // 解析文件类型
  const type = fileType[modeStr[0]] || '-';

  // 解析所有者、组和其他用户的权限
  const owner = permissionBits[modeStr[2]] || '---';
  const group = permissionBits[modeStr[3]] || '---';
  const others = permissionBits[modeStr[4]] || '---';

  // 组合成完整的权限字符串
  return `${type}${owner}${group}${others}`;
};

/**
 * 格式化文件大小
 */
export const formatFileSize = (size: number): string => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let index = 0;
  let fileSize = size;

  while (fileSize >= 1024 && index < units.length - 1) {
    fileSize /= 1024;
    index++;
  }

  return `${fileSize.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
};

/**
 * 获取文件图标
 */
export const getFileIcon = (file: FileEntry): string => {
  if (file.isDirectory) {
    return '📁';
  }

  // 根据文件扩展名返回对应图标
  const iconMap: { [key: string]: string } = {
    // 文本文件
    'txt': '📄',
    'log': '📋',
    'md': '📝',
    // 代码文件
    'js': '📜',
    'ts': '📜',
    'jsx': '📜',
    'tsx': '📜',
    'json': '📜',
    'html': '📜',
    'css': '📜',
    'less': '📜',
    'scss': '📜',
    // 图片文件
    'jpg': '🖼️',
    'jpeg': '🖼️',
    'png': '🖼️',
    'gif': '🖼️',
    'svg': '🖼️',
    // 压缩文件
    'zip': '📦',
    'rar': '📦',
    'tar': '📦',
    'gz': '📦',
    // 可执行文件
    'exe': '⚙️',
    'sh': '⚙️',
    'bat': '⚙️',
    // 配置文件
    'conf': '⚙️',
    'config': '⚙️',
    'yml': '⚙️',
    'yaml': '⚙️',
    'env': '⚙️',
  };

  return iconMap[file.extension] || '📄';
};
