/**
 * 文件工具函数
 */

// 权限相关工具函数
export const convertPermissions = (rawPermission: number): {
  read: boolean;
  write: boolean;
  execute: boolean;
} => {
  return {
    read: (rawPermission & 4) === 4,
    write: (rawPermission & 2) === 2,
    execute: (rawPermission & 1) === 1
  };
};

export const checkPermission = (
  permission: number,
  requiredPermission: 'read' | 'write' | 'execute'
): boolean => {
  const permissions = convertPermissions(permission);
  return permissions[requiredPermission];
};

export function convertPermissionsToOctal(permissions: string): number {
  const modeStr = permissions.match(/.{3}/g) || [];
  return modeStr.reduce((acc, curr, idx) => {
    let val = 0;
    if (curr[0] === 'r') val += 4;
    if (curr[1] === 'w') val += 2;
    if (curr[2] === 'x') val += 1;
    return acc | (val << ((2 - idx) * 3));
  }, 0);
}

// 文件类型判断
export function isDirectory(mode: number): boolean {
  return (mode & 0o170000) === 0o040000;
}

export function isSymlink(mode: number): boolean {
  return (mode & 0o170000) === 0o120000;
}

export function isRegularFile(mode: number): boolean {
  return (mode & 0o170000) === 0o100000;
}

// 判断是否为普通文件（用于过滤，保留目录和链接等特殊文件）
export function shouldFilterRegularFile(mode: number): boolean {
  const fileType = mode & 0o170000;
  // 如果是普通文件则过滤掉
  return fileType === 0o100000;
}

/**
 * 格式化文件大小
 */
export function formatFileSize(size: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let index = 0;
  let fileSize = size;

  while (fileSize >= 1024 && index < units.length - 1) {
    fileSize /= 1024;
    index++;
  }

  return `${fileSize.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

/**
 * 格式化文件权限
 */
export function formatPermissions(permissions: number): string {
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
}

// ... existing code ...