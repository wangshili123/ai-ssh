// Permission utility methods
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

// ... existing code ...