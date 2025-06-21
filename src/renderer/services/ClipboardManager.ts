/**
 * 剪贴板管理器
 * 管理文件复制粘贴操作的剪贴板状态
 */

import type { FileEntry } from '../../main/types/file';

export interface ClipboardItem {
  files: FileEntry[];           // 文件列表
  operation: 'copy' | 'cut';    // 操作类型
  sourcePath: string;           // 源路径
  sourceSessionId: string;      // 源会话ID
  timestamp: number;            // 时间戳
}

export class ClipboardManager {
  private static instance: ClipboardManager;
  private clipboard: ClipboardItem | null = null;
  private cutFiles: Set<string> = new Set(); // 记录被剪切的文件，格式: "sessionId:filePath"
  
  /**
   * 获取单例实例
   */
  static getInstance(): ClipboardManager {
    if (!ClipboardManager.instance) {
      ClipboardManager.instance = new ClipboardManager();
    }
    return ClipboardManager.instance;
  }
  
  /**
   * 复制文件到剪贴板
   */
  copy(files: FileEntry[], sourcePath: string, sessionId: string): void {
    this.clearCutState(); // 清除之前的剪切状态
    this.clipboard = {
      files: [...files],
      operation: 'copy',
      sourcePath,
      sourceSessionId: sessionId,
      timestamp: Date.now()
    };
    console.log('[ClipboardManager] 复制文件到剪贴板:', files.map(f => f.name));
  }
  
  /**
   * 剪切文件到剪贴板
   */
  cut(files: FileEntry[], sourcePath: string, sessionId: string): void {
    this.clearCutState(); // 清除之前的剪切状态
    this.clipboard = {
      files: [...files],
      operation: 'cut',
      sourcePath,
      sourceSessionId: sessionId,
      timestamp: Date.now()
    };
    
    // 标记被剪切的文件
    files.forEach(file => {
      const fileKey = this.generateFileKey(sessionId, sourcePath, file.name);
      this.cutFiles.add(fileKey);
    });
    
    console.log('[ClipboardManager] 剪切文件到剪贴板:', files.map(f => f.name));
  }
  
  /**
   * 获取剪贴板内容
   */
  getClipboard(): ClipboardItem | null {
    return this.clipboard;
  }
  
  /**
   * 清空剪贴板
   */
  clear(): void {
    this.clipboard = null;
    this.clearCutState();
    console.log('[ClipboardManager] 剪贴板已清空');
  }
  
  /**
   * 检查是否有剪贴板内容
   */
  hasContent(): boolean {
    return this.clipboard !== null;
  }
  
  /**
   * 检查文件是否被剪切
   */
  isCutFile(sessionId: string, filePath: string, fileName: string): boolean {
    const fileKey = this.generateFileKey(sessionId, filePath, fileName);
    return this.cutFiles.has(fileKey);
  }
  
  /**
   * 粘贴完成后的清理操作
   */
  onPasteComplete(): void {
    if (this.clipboard?.operation === 'cut') {
      // 剪切操作完成后清空剪贴板
      this.clear();
    }
    console.log('[ClipboardManager] 粘贴操作完成');
  }
  
  /**
   * 获取剪贴板操作类型
   */
  getOperationType(): 'copy' | 'cut' | null {
    return this.clipboard?.operation || null;
  }
  
  /**
   * 获取剪贴板文件数量
   */
  getFileCount(): number {
    return this.clipboard?.files.length || 0;
  }
  
  /**
   * 检查剪贴板是否过期（可选功能，防止长时间未使用的剪贴板内容）
   */
  isExpired(maxAgeMs: number = 30 * 60 * 1000): boolean { // 默认30分钟过期
    if (!this.clipboard) return false;
    return Date.now() - this.clipboard.timestamp > maxAgeMs;
  }
  
  /**
   * 获取剪贴板状态描述（用于UI显示）
   */
  getStatusDescription(): string {
    if (!this.clipboard) return '';
    
    const { files, operation } = this.clipboard;
    const fileCount = files.length;
    const operationText = operation === 'copy' ? '复制' : '剪切';
    
    if (fileCount === 1) {
      return `${operationText}了 ${files[0].name}`;
    } else {
      return `${operationText}了 ${fileCount} 个项目`;
    }
  }
  
  /**
   * 清除剪切状态
   */
  private clearCutState(): void {
    this.cutFiles.clear();
  }
  
  /**
   * 生成文件唯一标识键
   */
  private generateFileKey(sessionId: string, filePath: string, fileName: string): string {
    const fullPath = `${filePath}/${fileName}`.replace(/\/+/g, '/');
    return `${sessionId}:${fullPath}`;
  }
  
  /**
   * 检查是否可以粘贴到指定路径
   */
  canPasteTo(targetSessionId: string, targetPath: string): boolean {
    if (!this.clipboard) return false;
    
    // 检查是否是粘贴到自己
    if (this.clipboard.sourceSessionId === targetSessionId && 
        this.clipboard.sourcePath === targetPath) {
      return false; // 不能粘贴到相同位置
    }
    
    return true;
  }
  
  /**
   * 获取调试信息
   */
  getDebugInfo(): object {
    return {
      hasClipboard: !!this.clipboard,
      operation: this.clipboard?.operation,
      fileCount: this.clipboard?.files.length,
      sourcePath: this.clipboard?.sourcePath,
      sourceSessionId: this.clipboard?.sourceSessionId,
      cutFilesCount: this.cutFiles.size,
      timestamp: this.clipboard?.timestamp
    };
  }
}

// 导出单例实例
export const clipboardManager = ClipboardManager.getInstance();
