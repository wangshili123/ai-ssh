import { message } from 'antd';
import { sshService } from '../../../../../../services/ssh';
import type { SessionInfo } from '../../../../../../types';
import type { FileEntry } from '../../../../../../../main/types/file';

/**
 * 权限设置选项接口
 */
export interface PermissionOptions {
  files: FileEntry[];
  permissions: string; // 八进制权限如 "755" 或符号权限如 "u+x"
  recursive?: boolean; // 是否递归应用到子目录
  sessionInfo: SessionInfo;
  currentPath: string;
  mode: 'octal' | 'symbolic'; // 权限模式
  applyToFiles?: boolean; // 仅应用到文件
  applyToDirectories?: boolean; // 仅应用到目录
}

/**
 * 权限设置结果接口
 */
export interface PermissionResult {
  success: boolean;
  message: string;
  failedFiles?: string[];
  updatedFiles?: FileEntry[];
}

/**
 * 权限对象接口
 */
export interface PermissionSet {
  owner: { read: boolean; write: boolean; execute: boolean };
  group: { read: boolean; write: boolean; execute: boolean };
  others: { read: boolean; write: boolean; execute: boolean };
}

/**
 * 权限操作服务
 */
export const permissionAction = {
  /**
   * 设置文件权限
   */
  async setPermissions(options: PermissionOptions): Promise<PermissionResult> {
    const { files, permissions, recursive, sessionInfo, mode, applyToFiles, applyToDirectories } = options;
    
    try {
      console.log('[PermissionAction] 开始设置权限:', {
        files: files.map(f => f.name),
        permissions,
        recursive,
        mode
      });

      // 验证权限格式
      if (!this.validatePermissions(permissions, mode)) {
        return {
          success: false,
          message: '权限格式不正确'
        };
      }

      // 构建chmod命令
      const commands = this.buildChmodCommands(files, permissions, recursive, applyToFiles, applyToDirectories);
      const failedFiles: string[] = [];
      
      // 执行命令
      for (const command of commands) {
        try {
          console.log('[PermissionAction] 执行命令:', command);
          await sshService.executeCommandDirect(sessionInfo.id, command);
        } catch (error) {
          console.error('[PermissionAction] 命令执行失败:', error);
          // 从命令中提取文件名
          const fileName = this.extractFileNameFromCommand(command);
          if (fileName) {
            failedFiles.push(fileName);
          }
        }
      }

      // 返回结果
      if (failedFiles.length === 0) {
        const fileCount = files.length;
        const message = fileCount === 1 
          ? `成功设置 ${files[0].name} 的权限`
          : `成功设置 ${fileCount} 个文件的权限`;
        
        return {
          success: true,
          message
        };
      } else if (failedFiles.length < files.length) {
        return {
          success: true,
          message: `部分文件权限设置成功，${failedFiles.length} 个文件失败`,
          failedFiles
        };
      } else {
        return {
          success: false,
          message: '所有文件权限设置失败',
          failedFiles
        };
      }
    } catch (error) {
      console.error('[PermissionAction] 权限设置异常:', error);
      return {
        success: false,
        message: `权限设置失败: ${(error as Error).message}`
      };
    }
  },

  /**
   * 验证权限格式
   */
  validatePermissions(permissions: string, mode: 'octal' | 'symbolic'): boolean {
    if (!permissions || permissions.trim() === '') {
      return false;
    }

    if (mode === 'octal') {
      // 验证八进制权限格式 (如: 755, 644)
      const octalPattern = /^[0-7]{3,4}$/;
      return octalPattern.test(permissions.trim());
    } else {
      // 验证符号权限格式 (如: u+x, g-w, o=r, a+rwx)
      const symbolicPattern = /^[ugoa]*[+\-=][rwx]*$/;
      const parts = permissions.trim().split(',');
      return parts.every(part => symbolicPattern.test(part.trim()));
    }
  },

  /**
   * 构建chmod命令
   */
  buildChmodCommands(
    files: FileEntry[], 
    permissions: string, 
    recursive: boolean = false,
    applyToFiles: boolean = false,
    applyToDirectories: boolean = false
  ): string[] {
    const commands: string[] = [];
    const recursiveFlag = recursive ? '-R ' : '';
    
    // 如果有特殊应用条件，需要分别处理
    if (applyToFiles && !applyToDirectories) {
      // 仅应用到文件
      for (const file of files) {
        if (file.isDirectory) {
          // 对目录使用find命令只修改文件
          const command = `find "${file.path}" -type f -exec chmod ${permissions} {} \\;`;
          commands.push(command);
        } else {
          // 直接修改文件
          const command = `chmod ${permissions} "${file.path}"`;
          commands.push(command);
        }
      }
    } else if (applyToDirectories && !applyToFiles) {
      // 仅应用到目录
      for (const file of files) {
        if (file.isDirectory) {
          if (recursive) {
            // 递归修改所有目录
            const command = `find "${file.path}" -type d -exec chmod ${permissions} {} \\;`;
            commands.push(command);
          } else {
            // 只修改当前目录
            const command = `chmod ${permissions} "${file.path}"`;
            commands.push(command);
          }
        }
        // 忽略文件
      }
    } else {
      // 正常模式：修改所有选中的文件和目录
      for (const file of files) {
        const command = `chmod ${recursiveFlag}${permissions} "${file.path}"`;
        commands.push(command);
      }
    }

    return commands;
  },

  /**
   * 从命令中提取文件名（用于错误报告）
   */
  extractFileNameFromCommand(command: string): string | null {
    // 从chmod命令中提取文件路径
    const match = command.match(/"([^"]+)"$/);
    if (match) {
      const fullPath = match[1];
      return fullPath.split('/').pop() || fullPath;
    }
    return null;
  },

  /**
   * 八进制转权限对象
   */
  octalToPermissions(octal: string): PermissionSet {
    const digits = octal.padStart(3, '0').slice(-3); // 取最后3位
    
    const parseDigit = (digit: string) => {
      const num = parseInt(digit, 10);
      return {
        read: (num & 4) !== 0,
        write: (num & 2) !== 0,
        execute: (num & 1) !== 0
      };
    };

    return {
      owner: parseDigit(digits[0]),
      group: parseDigit(digits[1]),
      others: parseDigit(digits[2])
    };
  },

  /**
   * 权限对象转八进制
   */
  permissionsToOctal(permissions: PermissionSet): string {
    const digitFromPermission = (perm: { read: boolean; write: boolean; execute: boolean }) => {
      let digit = 0;
      if (perm.read) digit += 4;
      if (perm.write) digit += 2;
      if (perm.execute) digit += 1;
      return digit.toString();
    };

    return digitFromPermission(permissions.owner) +
           digitFromPermission(permissions.group) +
           digitFromPermission(permissions.others);
  },

  /**
   * 权限对象转符号字符串
   */
  permissionsToSymbolic(permissions: PermissionSet): string {
    const symbolFromPermission = (perm: { read: boolean; write: boolean; execute: boolean }) => {
      return (perm.read ? 'r' : '-') +
             (perm.write ? 'w' : '-') +
             (perm.execute ? 'x' : '-');
    };

    return symbolFromPermission(permissions.owner) +
           symbolFromPermission(permissions.group) +
           symbolFromPermission(permissions.others);
  },

  /**
   * 从当前权限数字获取权限对象
   */
  numericToPermissions(numeric: number): PermissionSet {
    // 将数字权限转换为八进制字符串，然后转换为权限对象
    const octal = (numeric & 0o777).toString(8).padStart(3, '0');
    return this.octalToPermissions(octal);
  },

  /**
   * 获取常用权限预设
   */
  getCommonPermissions(): Array<{ label: string; octal: string; description: string }> {
    return [
      { label: '755', octal: '755', description: '所有者：读写执行，组和其他：读执行' },
      { label: '644', octal: '644', description: '所有者：读写，组和其他：只读' },
      { label: '600', octal: '600', description: '所有者：读写，组和其他：无权限' },
      { label: '777', octal: '777', description: '所有用户：读写执行（危险）' },
      { label: '700', octal: '700', description: '所有者：读写执行，组和其他：无权限' },
      { label: '666', octal: '666', description: '所有用户：读写' }
    ];
  }
};
