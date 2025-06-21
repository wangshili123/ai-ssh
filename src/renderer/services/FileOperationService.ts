/**
 * 文件操作服务
 * 使用rsync命令处理文件复制粘贴操作
 */

import type { FileEntry } from '../../main/types/file';
import type { SessionInfo } from '../types';
import { sshService } from './ssh';
import { eventBus } from './eventBus';
import { storageService } from './storage';
import { message, Modal } from 'antd';

export interface CopyPasteOptions {
  sourceFiles: FileEntry[];
  sourcePath: string;
  sourceSessionId: string;
  targetPath: string;
  targetSessionId: string;
  operation: 'copy' | 'cut';
  onProgress?: (currentFile: string, totalFiles: number, currentIndex: number) => void;
  onConflict?: (file: string) => Promise<'overwrite' | 'skip' | 'rename'>;
}

export interface ProgressInfo {
  bytesTransferred: number;
  percentage: number;
  speed: string;
  timeRemaining: string;
}

export class FileOperationService {
  private static instance: FileOperationService;
  
  static getInstance(): FileOperationService {
    if (!FileOperationService.instance) {
      FileOperationService.instance = new FileOperationService();
    }
    return FileOperationService.instance;
  }
  
  /**
   * 执行复制粘贴操作
   */
  async executeCopyPaste(options: CopyPasteOptions): Promise<void> {
    const { sourceSessionId, targetSessionId } = options;

    console.log('[FileOperationService] 开始执行复制粘贴操作:', {
      operation: options.operation,
      fileCount: options.sourceFiles.length,
      sameSession: sourceSessionId === targetSessionId,
      sourceSessionId,
      targetSessionId
    });

    // 获取会话信息来判断是否为同一服务器
    const sourceSession = await this.getSessionInfo(sourceSessionId);
    const targetSession = await this.getSessionInfo(targetSessionId);

    const isSameServer = sourceSession.host === targetSession.host &&
                        sourceSession.username === targetSession.username &&
                        sourceSession.port === targetSession.port;

    console.log('[FileOperationService] 会话比较:', {
      sourceHost: `${sourceSession.username}@${sourceSession.host}:${sourceSession.port}`,
      targetHost: `${targetSession.username}@${targetSession.host}:${targetSession.port}`,
      isSameServer
    });

    if (sourceSessionId === targetSessionId || isSameServer) {
      // 同一会话内操作或同一服务器操作
      await this.sameSessionOperation(options);
    } else {
      // 跨会话操作
      await this.crossSessionOperation(options);
    }
  }
  
  /**
   * 同一会话内的文件操作
   */
  private async sameSessionOperation(options: CopyPasteOptions): Promise<void> {
    const { sourceFiles, sourcePath, targetPath, operation, onProgress } = options;
    
    for (let i = 0; i < sourceFiles.length; i++) {
      const file = sourceFiles[i];
      const sourceFullPath = `${sourcePath}/${file.name}`.replace(/\/+/g, '/');
      
      onProgress?.(file.name, sourceFiles.length, i + 1);
      
      try {
        let command: string;
        
        if (operation === 'copy') {
          if (file.isDirectory) {
            // 文件夹复制：注意源路径末尾的斜杠
            command = `rsync -avz --progress "${sourceFullPath}/" "${targetPath}/${file.name}/"`;
          } else {
            // 文件复制
            command = `rsync -avz --progress "${sourceFullPath}" "${targetPath}/"`;
          }
        } else { // cut
          if (file.isDirectory) {
            // 文件夹移动
            command = `rsync -avz --progress --remove-source-files "${sourceFullPath}/" "${targetPath}/${file.name}/" && find "${sourceFullPath}" -type d -empty -delete`;
          } else {
            // 文件移动
            command = `rsync -avz --progress --remove-source-files "${sourceFullPath}" "${targetPath}/"`;
          }
        }
        
        console.log('[FileOperationService] 执行命令:', command);
        
        // 执行命令并监控进度
        await this.executeCommandWithRealProgress(options.sourceSessionId, command, () => {
          // 进度回调已经在外层处理了，这里不需要额外处理
        });
        
        console.log('[FileOperationService] 文件操作完成:', file.name);
        
      } catch (error) {
        console.error(`[FileOperationService] 操作失败: ${file.name}`, error);
        throw error;
      }
    }
  }
  
  /**
   * 跨会话的文件操作
   */
  private async crossSessionOperation(options: CopyPasteOptions): Promise<void> {
    const { sourceFiles, sourcePath, sourceSessionId, targetPath, targetSessionId, operation, onProgress } = options;

    // 获取源和目标会话信息
    const sourceSession = await this.getSessionInfo(sourceSessionId);
    const targetSession = await this.getSessionInfo(targetSessionId);

    console.log('[FileOperationService] 跨会话操作详情:', {
      sourceServer: `${sourceSession.username}@${sourceSession.host}:${sourceSession.port}`,
      targetServer: `${targetSession.username}@${targetSession.host}:${targetSession.port}`,
      sourcePath,
      targetPath,
      operation
    });

    // 检查源服务器是否有sshpass工具
    const sshpassCheck = await sshService.executeCommandDirect(sourceSessionId, 'which sshpass');
    const hasSshpass = sshpassCheck && !sshpassCheck.includes('not found') && sshpassCheck.trim().length > 0;

    if (!hasSshpass) {
      await this.showSshpassInstallDialog(sourceSessionId);
      return; // 用户取消或安装失败，直接返回
    }

    if (!targetSession.password) {
      throw new Error('跨服务器文件传输需要目标服务器的密码。请检查会话配置。');
    }

    // 使用sshpass进行跨服务器传输
    await this.sshpassBasedOperation(options, sourceSession, targetSession);
  }

  /**
   * 使用sshpass的跨服务器操作
   */
  private async sshpassBasedOperation(
    options: CopyPasteOptions,
    sourceSession: SessionInfo,
    targetSession: SessionInfo
  ): Promise<void> {
    const { sourceFiles, sourcePath, sourceSessionId, operation, onProgress } = options;

    console.log('[FileOperationService] 使用sshpass方案');

    for (let i = 0; i < sourceFiles.length; i++) {
      const file = sourceFiles[i];

      onProgress?.(file.name, sourceFiles.length, i + 1);

      // 构建sshpass + rsync命令
      const command = await this.buildSshpassCommand({
        sourceSession,
        targetSession,
        sourceFiles: [file],
        sourcePath,
        targetPath: options.targetPath,
        operation
      });

      console.log('[FileOperationService] sshpass命令:', command);

      // 执行sshpass命令
      await this.executeCommandWithProgress(sourceSessionId, command, () => {
        // 进度回调已经在外层处理了，这里不需要额外处理
      });

      console.log('[FileOperationService] sshpass传输完成:', file.name);
    }
  }
  
  /**
   * 构建sshpass + rsync命令
   */
  private async buildSshpassCommand(transfer: {
    sourceSession: SessionInfo;
    targetSession: SessionInfo;
    sourceFiles: FileEntry[];
    sourcePath: string;
    targetPath: string;
    operation: 'copy' | 'cut';
  }): Promise<string> {
    const { targetSession, sourceFiles, sourcePath, targetPath, operation } = transfer;

    const file = sourceFiles[0]; // 单个文件处理
    const sourceFullPath = `${sourcePath}/${file.name}`.replace(/\/+/g, '/');
    const targetAddr = `${targetSession.username}@${targetSession.host}`;
    const targetFullPath = `${targetAddr}:${targetPath}/`;

    // 构建SSH选项
    const sshOptionsList = [];

    // 端口设置
    if (targetSession.port && targetSession.port !== 22) {
      sshOptionsList.push(`-p ${targetSession.port}`);
    }

    // 跳过主机密钥验证
    sshOptionsList.push('-o StrictHostKeyChecking=no');
    sshOptionsList.push('-o UserKnownHostsFile=/dev/null');
    sshOptionsList.push('-o ConnectTimeout=30');

    const sshOptions = sshOptionsList.length > 0 ? ` ${sshOptionsList.join(' ')}` : '';

    console.log('[FileOperationService] 构建sshpass命令参数:', {
      sourceFullPath,
      targetAddr,
      targetPath,
      targetFullPath,
      hasPassword: !!targetSession.password
    });

    let rsyncCommand: string;
    if (file.isDirectory) {
      // 文件夹传输
      if (operation === 'copy') {
        rsyncCommand = `rsync -avz --progress -e "ssh${sshOptions}" "${sourceFullPath}/" "${targetFullPath}${file.name}/"`;
      } else {
        rsyncCommand = `rsync -avz --progress --remove-source-files -e "ssh${sshOptions}" "${sourceFullPath}/" "${targetFullPath}${file.name}/" && find "${sourceFullPath}" -type d -empty -delete`;
      }
    } else {
      // 文件传输
      if (operation === 'copy') {
        rsyncCommand = `rsync -avz --progress -e "ssh${sshOptions}" "${sourceFullPath}" "${targetFullPath}"`;
      } else {
        rsyncCommand = `rsync -avz --progress --remove-source-files -e "ssh${sshOptions}" "${sourceFullPath}" "${targetFullPath}"`;
      }
    }

    // 使用sshpass包装rsync命令
    const command = `sshpass -p '${targetSession.password}' ${rsyncCommand}`;

    return command;
  }



  /**
   * 执行命令并监控真实rsync进度（用于同服务器操作）
   */
  private async executeCommandWithRealProgress(
    sessionId: string,
    command: string,
    onProgress: (progress: number) => void
  ): Promise<string> {
    try {
      console.log('[FileOperationService] 执行rsync命令（真实进度）:', command);

      // 修改rsync命令，添加更详细的进度输出
      const enhancedCommand = command.replace('rsync -avz --progress', 'rsync -avz --progress --stats');

      return new Promise((resolve, reject) => {
        let output = '';
        let hasStarted = false;

        // 创建一个进度模拟器，因为SSH很难获取实时输出
        const progressInterval = setInterval(() => {
          if (!hasStarted) {
            hasStarted = true;
            onProgress(10); // 开始执行
          } else {
            // 模拟进度增长，但保持在90%以下
            const currentProgress = Math.min(90, 10 + Math.random() * 80);
            onProgress(currentProgress);
          }
        }, 200); // 更频繁的更新

        // 执行命令
        sshService.executeCommandDirect(sessionId, enhancedCommand)
          .then((result) => {
            clearInterval(progressInterval);
            output = result || '';

            console.log('[FileOperationService] rsync执行结果:', output);

            // 检查是否成功
            if (output.includes('sent ') && output.includes('received ')) {
              console.log('[FileOperationService] rsync传输成功');
              onProgress(100);
              resolve(output);
            } else if (output.includes('total size is')) {
              // 另一种成功的标志
              console.log('[FileOperationService] rsync传输完成');
              onProgress(100);
              resolve(output);
            } else if (output.trim() === '') {
              // 空输出，可能是小文件或同名文件
              console.log('[FileOperationService] rsync返回空输出，可能是小文件');
              onProgress(100);
              resolve(output);
            } else {
              // 检查错误
              if (output.includes('Permission denied') ||
                  output.includes('No such file or directory') ||
                  output.includes('rsync error:')) {
                reject(new Error(`rsync执行失败: ${output}`));
              } else {
                // 其他情况认为成功
                onProgress(100);
                resolve(output);
              }
            }
          })
          .catch((error) => {
            clearInterval(progressInterval);
            console.error('[FileOperationService] rsync执行失败:', error);
            reject(error);
          });
      });
    } catch (error) {
      console.error('[FileOperationService] rsync命令执行失败:', error);
      throw error;
    }
  }

  /**
   * 执行命令并监控进度（用于跨服务器操作）
   */
  private async executeCommandWithProgress(
    sessionId: string,
    command: string,
    onProgress: (progress: number) => void
  ): Promise<string> {
    try {
      console.log('[FileOperationService] 执行命令:', command);

      // 使用实时输出监控的方式执行命令
      return new Promise((resolve, reject) => {
        let output = '';
        let lastProgress = 0;

        // 创建一个模拟的实时进度更新
        const progressInterval = setInterval(() => {
          if (lastProgress < 90) {
            lastProgress += Math.random() * 10;
            onProgress(Math.min(lastProgress, 90));
          }
        }, 500);

        // 执行命令
        sshService.executeCommandDirect(sessionId, command)
          .then((result) => {
            clearInterval(progressInterval);
            output = result || '';

            console.log('[FileOperationService] 命令执行结果:', output);

            // 检查命令输出，看是否有错误
            if (output && typeof output === 'string') {
              // 检查sshpass相关错误
              if (output.includes('sshpass: command not found') ||
                  output.includes('bash: sshpass: command not found')) {
                // 弹出安装对话框而不是抛出错误
                console.log('[FileOperationService] 检测到sshpass未安装，弹出安装对话框');
                setTimeout(async () => {
                  try {
                    await this.showSshpassInstallDialog(sessionId);
                  } catch (error) {
                    console.log('[FileOperationService] 用户取消安装sshpass');
                  }
                }, 100);
                reject(new Error('需要安装sshpass工具'));
                return;
              }

              // 检查常见的rsync错误
              if (output.includes('Permission denied') ||
                  output.includes('No such file or directory') ||
                  output.includes('Connection refused') ||
                  output.includes('Host key verification failed') ||
                  output.includes('rsync error:')) {
                reject(new Error(`文件传输失败: ${output}`));
                return;
              }

              // 检查是否有成功的传输信息
              if (output.includes('sent ') && output.includes('received ')) {
                console.log('[FileOperationService] 文件传输成功');
                onProgress(100);
                resolve(output);
              } else if (output.trim() === '') {
                // 空输出可能表示没有实际传输
                console.warn('[FileOperationService] 命令返回空输出，可能没有实际传输');
                onProgress(100);
                resolve(output);
              } else {
                // 如果没有传输信息，检查是否是小文件（可能没有详细输出）
                console.warn('[FileOperationService] 未检测到传输信息，可能是小文件传输:', output);
                onProgress(100);
                resolve(output);
              }
            } else {
              onProgress(100);
              resolve(output);
            }
          })
          .catch((error) => {
            clearInterval(progressInterval);
            console.error('[FileOperationService] 命令执行失败:', error);
            reject(error);
          });
      });
    } catch (error) {
      console.error('[FileOperationService] 命令执行失败:', error);
      throw error;
    }
  }
  
  /**
   * 解析rsync进度输出
   */
  static parseRsyncProgress(output: string): ProgressInfo | null {
    // rsync进度格式: "1,234,567  45%  1.23MB/s    0:00:12"
    const progressRegex = /(\d+(?:,\d+)*)\s+(\d+)%\s+([\d.]+[KMGT]?B\/s)\s+(\d+:\d+:\d+)/;
    const match = output.match(progressRegex);
    
    if (match) {
      return {
        bytesTransferred: parseInt(match[1].replace(/,/g, '')),
        percentage: parseInt(match[2]),
        speed: match[3],
        timeRemaining: match[4]
      };
    }
    
    // 简化版本，只提取百分比
    const simpleMatch = output.match(/(\d+)%/);
    if (simpleMatch) {
      return {
        bytesTransferred: 0,
        percentage: parseInt(simpleMatch[1]),
        speed: '',
        timeRemaining: ''
      };
    }
    
    return null;
  }
  


  /**
   * 获取会话信息
   */
  private async getSessionInfo(sessionId: string): Promise<SessionInfo> {
    try {
      // 首先尝试从eventBus获取当前会话信息
      const currentSessionInfo = eventBus.getCurrentSessionInfo();
      if (currentSessionInfo && currentSessionInfo.id === sessionId) {
        return currentSessionInfo;
      }

      // 如果不是当前会话，从存储服务加载所有会话
      const allSessions = await storageService.loadSessions();
      const sessionInfo = allSessions.find(session => session.id === sessionId);

      if (!sessionInfo) {
        throw new Error(`会话信息未找到: ${sessionId}`);
      }

      return sessionInfo;
    } catch (error) {
      console.error('[FileOperationService] 获取会话信息失败:', error);
      throw error;
    }
  }

  /**
   * 显示sshpass安装对话框
   */
  private async showSshpassInstallDialog(sourceSessionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      Modal.confirm({
        title: '需要安装 sshpass 工具',
        content: '跨服务器文件传输需要在源服务器上安装 sshpass 工具。\n\n是否自动安装？\n\n支持的系统：\n• Ubuntu/Debian: apt-get install sshpass\n• CentOS/RHEL: yum install sshpass\n• Alpine: apk add sshpass',
        okText: '自动安装',
        cancelText: '取消',
        width: 480,
        onOk: async () => {
          try {
            message.loading('正在安装 sshpass...', 0);
            await this.autoInstallSshpass(sourceSessionId);
            message.destroy();
            message.success('sshpass 安装成功！请重新尝试复制粘贴操作。');
            resolve();
          } catch (error) {
            message.destroy();
            message.error(`安装失败: ${(error as Error).message}`);
            reject(error);
          }
        },
        onCancel: () => {
          reject(new Error('用户取消安装 sshpass'));
        }
      });
    });
  }

  /**
   * 自动安装sshpass
   */
  private async autoInstallSshpass(sourceSessionId: string): Promise<void> {
    try {
      console.log('[FileOperationService] 开始自动安装sshpass');

      // 检测Linux发行版
      const osRelease = await sshService.executeCommandDirect(sourceSessionId, 'cat /etc/os-release 2>/dev/null || echo "unknown"');

      let installCommand = '';

      if (osRelease.includes('ubuntu') || osRelease.includes('debian')) {
        installCommand = 'apt-get update && apt-get install -y sshpass';
      } else if (osRelease.includes('centos') || osRelease.includes('rhel')) {
        // CentOS/RHEL 使用yum
        installCommand = 'yum install -y sshpass';
      } else if (osRelease.includes('fedora')) {
        // Fedora 优先使用dnf
        installCommand = 'dnf install -y sshpass || yum install -y sshpass';
      } else if (osRelease.includes('alpine')) {
        installCommand = 'apk add sshpass';
      } else {
        // 尝试通用的包管理器
        const hasApt = await sshService.executeCommandDirect(sourceSessionId, 'which apt-get');
        const hasYum = await sshService.executeCommandDirect(sourceSessionId, 'which yum');
        const hasApk = await sshService.executeCommandDirect(sourceSessionId, 'which apk');

        if (hasApt && !hasApt.includes('not found')) {
          installCommand = 'apt-get update && apt-get install -y sshpass';
        } else if (hasYum && !hasYum.includes('not found')) {
          installCommand = 'yum install -y sshpass';
        } else if (hasApk && !hasApk.includes('not found')) {
          installCommand = 'apk add sshpass';
        } else {
          throw new Error('无法识别的Linux发行版，请手动安装sshpass');
        }
      }

      console.log('[FileOperationService] 执行安装命令:', installCommand);

      const result = await sshService.executeCommandDirect(sourceSessionId, installCommand);

      console.log('[FileOperationService] 安装结果:', result);

      // 检查安装过程是否有明显错误
      if (result.includes('Could not resolve host') ||
          result.includes('No package') ||
          result.includes('command not found') ||
          result.includes('E: Unable to locate package') ||
          result.includes('Error:')) {
        throw new Error(`安装失败: ${result}`);
      }

      // 验证安装是否成功
      const verifyResult = await sshService.executeCommandDirect(sourceSessionId, 'which sshpass');
      console.log('[FileOperationService] sshpass验证结果:', verifyResult);

      if (!verifyResult || verifyResult.includes('not found') || verifyResult.trim() === '') {
        throw new Error('安装完成但无法找到sshpass命令。可能的原因：\n• 网络连接问题\n• 软件源配置问题\n• 权限不足\n\n请手动安装sshpass或检查网络连接');
      }

      console.log('[FileOperationService] sshpass安装验证成功');

    } catch (error) {
      console.error('[FileOperationService] sshpass安装失败:', error);
      throw error;
    }
  }
}

// 导出单例实例
export const fileOperationService = FileOperationService.getInstance();
