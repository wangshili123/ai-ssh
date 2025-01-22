export const generateUniqueId = () => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

// 常见的 Linux 系统用户 ID 映射
const commonUsers: Record<number, string> = {
  0: 'root',
  1: 'daemon',
  2: 'bin',
  4: 'sys',
  5: 'sync',
  6: 'games',
  7: 'lp',
  8: 'mail',
  9: 'news',
  10: 'uucp',
  13: 'proxy',
  33: 'www-data',
  65534: 'nobody'
};

// 常见的 Linux 系统组 ID 映射
const commonGroups: Record<number, string> = {
  0: 'root',
  1: 'daemon',
  2: 'bin',
  3: 'sys',
  4: 'adm',
  5: 'tty',
  6: 'disk',
  7: 'lp',
  8: 'mail',
  9: 'news',
  10: 'uucp',
  33: 'www-data',
  65534: 'nogroup'
};

/**
 * 根据 UID 获取用户名
 */
export const getUserName = (uid: number): string => {
  return commonUsers[uid] || uid.toString();
};

/**
 * 根据 GID 获取组名
 */
export const getGroupName = (gid: number): string => {
  return commonGroups[gid] || gid.toString();
}; 