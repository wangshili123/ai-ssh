/**
 * 文件和文件夹创建操作类
 */

import { message } from 'antd';
import { sshService } from '../../../../../../services/ssh';
import type { SessionInfo } from '../../../../../../types';
import type { FileEntry } from '../../../../../../../main/types/file';

export interface CreateOptions {
  name: string;
  currentPath: string;
  sessionInfo: SessionInfo;
  type: 'file' | 'folder';
}

export interface CreateResult {
  success: boolean;
  message: string;
  createdItem?: FileEntry;
}

class CreateAction {
  /**
   * 创建文件夹
   */
  async createFolder(options: CreateOptions): Promise<CreateResult> {
    const { name, currentPath, sessionInfo } = options;
    
    try {
      console.log('[CreateAction] 开始创建文件夹:', { name, currentPath });
      
      // 验证名称
      if (!this.validateName(name, 'folder')) {
        const errorMsg = '文件夹名称不合法';
        message.error(errorMsg);
        return { success: false, message: errorMsg };
      }

      // 构建完整路径
      const fullPath = this.buildFullPath(currentPath, name);
      console.log('[CreateAction] 文件夹完整路径:', fullPath);
      
      // 检查是否已存在
      const exists = await this.checkNameExists(fullPath, sessionInfo);
      if (exists) {
        const errorMsg = '文件夹已存在';
        message.error(errorMsg);
        return { success: false, message: errorMsg };
      }

      // 执行创建命令
      const command = `mkdir -p "${fullPath}"`;
      await this.executeCreateCommand(command, sessionInfo);
      
      // 验证创建结果
      const verifyCommand = `test -d "${fullPath}" && echo "success" || echo "failed"`;
      const verifyResult = await this.executeCreateCommand(verifyCommand, sessionInfo);
      
      if (!verifyResult.includes('success')) {
        throw new Error('文件夹创建验证失败');
      }

      console.log('[CreateAction] 文件夹创建成功:', name);
      message.success(`文件夹 "${name}" 创建成功`);
      return { success: true, message: '文件夹创建成功' };
      
    } catch (error) {
      console.error('[CreateAction] 创建文件夹失败:', error);
      const errorMsg = `创建文件夹失败: ${(error as Error).message}`;
      message.error(errorMsg);
      return { success: false, message: errorMsg };
    }
  }

  /**
   * 创建文件
   */
  async createFile(options: CreateOptions): Promise<CreateResult> {
    const { name, currentPath, sessionInfo } = options;
    
    try {
      console.log('[CreateAction] 开始创建文件:', { name, currentPath });
      
      // 验证名称
      if (!this.validateName(name, 'file')) {
        const errorMsg = '文件名不合法';
        message.error(errorMsg);
        return { success: false, message: errorMsg };
      }

      // 构建完整路径
      const fullPath = this.buildFullPath(currentPath, name);
      console.log('[CreateAction] 文件完整路径:', fullPath);
      
      // 检查是否已存在
      const exists = await this.checkNameExists(fullPath, sessionInfo);
      if (exists) {
        const errorMsg = '文件已存在';
        message.error(errorMsg);
        return { success: false, message: errorMsg };
      }

      // 执行创建命令
      const command = `touch "${fullPath}"`;
      await this.executeCreateCommand(command, sessionInfo);
      
      // 验证创建结果
      const verifyCommand = `test -f "${fullPath}" && echo "success" || echo "failed"`;
      const verifyResult = await this.executeCreateCommand(verifyCommand, sessionInfo);
      
      if (!verifyResult.includes('success')) {
        throw new Error('文件创建验证失败');
      }

      console.log('[CreateAction] 文件创建成功:', name);
      message.success(`文件 "${name}" 创建成功`);
      return { success: true, message: '文件创建成功' };
      
    } catch (error) {
      console.error('[CreateAction] 创建文件失败:', error);
      const errorMsg = `创建文件失败: ${(error as Error).message}`;
      message.error(errorMsg);
      return { success: false, message: errorMsg };
    }
  }

  /**
   * 验证名称合法性
   */
  private validateName(name: string, _type: 'file' | 'folder'): boolean {
    if (!name || name.trim() === '') {
      console.warn('[CreateAction] 名称为空');
      return false;
    }

    // 检查非法字符 (Linux/Unix 文件系统)
    const invalidChars = /[\/\0]/;
    if (invalidChars.test(name)) {
      console.warn('[CreateAction] 名称包含非法字符:', name);
      return false;
    }

    // 检查特殊名称
    if (name === '.' || name === '..') {
      console.warn('[CreateAction] 不能使用特殊名称:', name);
      return false;
    }

    // 检查名称长度
    if (name.length > 255) {
      console.warn('[CreateAction] 名称过长:', name.length);
      return false;
    }

    return true;
  }

  /**
   * 检查名称是否已存在
   */
  private async checkNameExists(fullPath: string, sessionInfo: SessionInfo): Promise<boolean> {
    try {
      const command = `test -e "${fullPath}" && echo "FILE_EXISTS" || echo "FILE_NOT_EXISTS"`;
      const result = await this.executeCreateCommand(command, sessionInfo);
      const trimmedResult = result.trim();

      // 检查最后一行是否包含存在标记
      const lines = trimmedResult.split('\n');
      const lastLine = lines[lines.length - 1].trim();
      const exists = lastLine === 'FILE_EXISTS';

      console.log('[CreateAction] 检查文件是否存在:', {
        fullPath,
        command,
        rawResult: result,
        trimmedResult,
        lastLine,
        exists
      });

      return exists;
    } catch (error) {
      console.warn('[CreateAction] 检查文件存在性失败，假设不存在:', error);
      // 如果命令执行失败，假设不存在
      return false;
    }
  }

  /**
   * 构建完整路径
   */
  private buildFullPath(currentPath: string, name: string): string {
    // 确保路径格式正确
    const normalizedPath = currentPath.endsWith('/') ? currentPath : currentPath + '/';
    const fullPath = `${normalizedPath}${name}`.replace(/\/+/g, '/');
    
    // 处理根路径的特殊情况
    return fullPath.startsWith('//') ? fullPath.substring(1) : fullPath;
  }

  /**
   * 执行SSH创建命令
   */
  private async executeCreateCommand(command: string, sessionInfo: SessionInfo): Promise<string> {
    try {
      console.log(`[CreateAction] 执行创建命令: ${command}`);
      const result = await sshService.executeCommandDirect(sessionInfo.id, command);
      console.log(`[CreateAction] 命令执行结果:`, result);
      return result;
    } catch (error) {
      console.error(`[CreateAction] 命令执行失败:`, error);
      throw error;
    }
  }
}

// 导出单例实例
export const createAction = new CreateAction();
