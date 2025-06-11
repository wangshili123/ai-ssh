/**
 * 文件删除功能模块
 * 提供安全删除（移动到回收站）和永久删除功能
 */

import { Modal, message } from 'antd';
import type { FileEntry } from '../../../../../../main/types/file';
import type { SessionInfo } from '../../../../../types';
import { sshService } from '../../../../../../services/ssh';

export interface DeleteOptions {
  file: FileEntry;
  sessionInfo: SessionInfo;
  currentPath: string;
  type: 'safe' | 'permanent';
}

export interface DeleteResult {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * 文件删除操作类
 */
export class FileDeleteAction {

  /**
   * 安全删除 - 移动到回收站
   */
  async safeDelete(options: DeleteOptions): Promise<DeleteResult> {
    const { file, sessionInfo, currentPath } = options;

    try {
      // 显示确认对话框
      const confirmed = await this.showConfirmDialog(file, 'safe');
      if (!confirmed) {
        return { success: false, message: '用户取消操作' };
      }

      // 构建文件完整路径
      const fullPath = this.buildFilePath(currentPath, file.name);

      // 生成回收站文件名（添加时间戳避免冲突）
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const trashFileName = `${file.name}_${timestamp}`;

      // 构建删除命令
      const commands = [
        'mkdir -p ~/.trash',  // 确保回收站目录存在
        `mv "${fullPath}" ~/.trash/"${trashFileName}"`  // 移动到回收站
      ];

      // 执行删除命令
      for (const command of commands) {
        await this.executeDeleteCommand(command, sessionInfo);
      }

      // 显示成功消息
      message.success(`文件 "${file.name}" 已移动到回收站`);

      return {
        success: true,
        message: '文件已移动到回收站'
      };

    } catch (error) {
      console.error('安全删除失败:', error);
      const errorMessage = error instanceof Error ? error.message : '删除失败';
      message.error(`删除失败: ${errorMessage}`);

      return {
        success: false,
        message: '删除失败',
        error: errorMessage
      };
    }
  }

  /**
   * 永久删除 - 直接删除
   */
  async permanentDelete(options: DeleteOptions): Promise<DeleteResult> {
    const { file, sessionInfo, currentPath } = options;

    try {
      // 显示确认对话框
      const confirmed = await this.showConfirmDialog(file, 'permanent');
      if (!confirmed) {
        return { success: false, message: '用户取消操作' };
      }

      // 构建文件完整路径
      const fullPath = this.buildFilePath(currentPath, file.name);

      // 构建删除命令
      const command = file.isDirectory
        ? `rm -rf "${fullPath}"`  // 删除文件夹
        : `rm -f "${fullPath}"`;  // 删除文件

      // 执行删除命令
      await this.executeDeleteCommand(command, sessionInfo);

      // 显示成功消息
      message.success(`文件 "${file.name}" 已永久删除`);

      return {
        success: true,
        message: '文件已永久删除'
      };

    } catch (error) {
      console.error('永久删除失败:', error);
      const errorMessage = error instanceof Error ? error.message : '删除失败';
      message.error(`删除失败: ${errorMessage}`);

      return {
        success: false,
        message: '删除失败',
        error: errorMessage
      };
    }
  }

  /**
   * 显示确认对话框
   */
  private showConfirmDialog(file: FileEntry, type: 'safe' | 'permanent'): Promise<boolean> {
    return new Promise((resolve) => {
      const isSafe = type === 'safe';
      const fileType = file.isDirectory ? '文件夹' : '文件';

      const content = isSafe
        ? `${fileType}：${file.name}\n\n此操作可以通过回收站恢复`
        : `${fileType}：${file.name}\n\n⚠️ 此操作不可恢复！`;

      Modal.confirm({
        title: isSafe ? '确认移动到回收站？' : '确认永久删除？',
        content: content,
        okText: isSafe ? '移动到回收站' : '永久删除',
        okType: isSafe ? 'primary' : 'danger',
        cancelText: '取消',
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  }

  /**
   * 执行SSH删除命令
   */
  private async executeDeleteCommand(command: string, sessionInfo: SessionInfo): Promise<string> {
    try {
      console.log(`[FileDeleteAction] 执行删除命令: ${command}`);
      const result = await sshService.executeCommandDirect(sessionInfo.id, command);
      console.log(`[FileDeleteAction] 命令执行结果:`, result);
      return result;
    } catch (error) {
      console.error(`[FileDeleteAction] 命令执行失败:`, error);
      throw error;
    }
  }

  /**
   * 构建文件完整路径
   */
  private buildFilePath(currentPath: string, fileName: string): string {
    // 确保路径格式正确
    const normalizedPath = currentPath.endsWith('/') ? currentPath : currentPath + '/';
    return `${normalizedPath}${fileName}`.replace(/\/+/g, '/');
  }
}

// 导出单例实例
export const fileDeleteAction = new FileDeleteAction();
