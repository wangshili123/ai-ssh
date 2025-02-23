/**
 * 文件条目接口
 */
export interface FileEntry {
  name: string;           // 文件名
  path: string;           // 完整路径
  isDirectory: boolean;   // 是否是目录
  size: number;          // 文件大小
  modifyTime: number;    // 修改时间
  permissions: number;   // 权限
  owner?: number;        // 所有者UID（可选）
  group?: number;        // 组ID（可选）
  extension: string;     // 文件扩展名
} 