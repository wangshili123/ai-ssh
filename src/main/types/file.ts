/**
 * 文件条目接口
 */
export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifyTime: Date;
  permissions: number;
  owner: number;
  group: number;
} 