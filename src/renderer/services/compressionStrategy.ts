/**
 * 智能压缩策略选择器
 */

import type { FileEntry } from '../../main/types/file';
import type { DownloadConfig } from '../components/Download/DownloadDialog';

export interface CompressionStrategy {
  enabled: boolean;
  method: 'gzip' | 'bzip2' | 'xz' | 'none';
  command: string;
  extension: string;
  threshold: number; // 最小文件大小阈值
  estimatedRatio: number; // 预估压缩比 (0-1)
  reason: string;
}

export class CompressionStrategySelector {
  
  /**
   * 根据文件特征选择最佳压缩策略
   */
  static selectStrategy(file: FileEntry, config?: DownloadConfig): CompressionStrategy {
    const ext = file.name.toLowerCase().split('.').pop() || '';
    const size = file.size;
    
    // 如果用户明确指定了压缩方法
    if (config?.compressionMethod && config.compressionMethod !== 'auto') {
      if (config.compressionMethod === 'none') {
        return this.createStrategy(false, 'none', 'cat', '', 0, 1.0, '用户选择不压缩');
      }
      return this.createStrategyForMethod(config.compressionMethod, size, '用户指定压缩方法');
    }
    
    // 高压缩比文件类型
    const highCompressible = [
      'txt', 'js', 'ts', 'jsx', 'tsx', 'json', 'xml', 'html', 'htm', 'css', 'scss', 'sass', 'less',
      'md', 'markdown', 'log', 'conf', 'config', 'sql', 'csv', 'tsv', 'yaml', 'yml', 'ini',
      'py', 'java', 'cpp', 'c', 'h', 'hpp', 'cs', 'php', 'rb', 'go', 'rs', 'kt', 'swift',
      'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd'
    ];
    
    // 中等压缩比文件类型
    const mediumCompressible = [
      'svg', 'eps', 'ps', 'tex', 'latex', 'rtf', 'doc', 'docx', 'odt',
      'plist', 'properties', 'gradle', 'maven', 'pom'
    ];
    
    // 不适合压缩的文件类型（已经压缩过或二进制）
    const nonCompressible = [
      'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'ico', 'tiff', 'tga',
      'mp3', 'mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v',
      'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a',
      'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'lz4', 'zst',
      'exe', 'dll', 'so', 'dylib', 'bin', 'deb', 'rpm', 'dmg', 'iso',
      'pdf', 'epub', 'mobi', 'azw', 'azw3'
    ];
    
    // 文件太小，压缩意义不大
    if (size < 1024) { // 1KB
      return this.createStrategy(false, 'none', 'cat', '', 0, 1.0, '文件太小，压缩意义不大');
    }
    
    // 不适合压缩的文件类型
    if (nonCompressible.includes(ext)) {
      return this.createStrategy(false, 'none', 'cat', '', 0, 1.0, '该文件类型已压缩或压缩效果有限');
    }
    
    // 高压缩比文件类型
    if (highCompressible.includes(ext)) {
      if (size > 100 * 1024 * 1024) { // 100MB以上用最高压缩
        return this.createStrategy(true, 'xz', 'tar -Jcf -', '.tar.xz', 1024, 0.15, '大型文本文件，使用最高压缩比');
      } else if (size > 10 * 1024 * 1024) { // 10MB以上用平衡压缩
        return this.createStrategy(true, 'bzip2', 'tar -jcf -', '.tar.bz2', 1024, 0.25, '中大型文本文件，使用平衡压缩');
      } else {
        return this.createStrategy(true, 'gzip', 'tar -czf -', '.tar.gz', 1024, 0.3, '文本文件，使用快速压缩');
      }
    }
    
    // 中等压缩比文件类型
    if (mediumCompressible.includes(ext)) {
      if (size > 50 * 1024 * 1024) { // 50MB以上
        return this.createStrategy(true, 'bzip2', 'tar -jcf -', '.tar.bz2', 2048, 0.4, '大型文档文件，使用平衡压缩');
      } else {
        return this.createStrategy(true, 'gzip', 'tar -czf -', '.tar.gz', 2048, 0.5, '文档文件，可能有一定压缩效果');
      }
    }
    
    // 未知文件类型，尝试轻量压缩
    if (size > 10 * 1024) { // 10KB以上
      return this.createStrategy(true, 'gzip', 'tar -czf -', '.tar.gz', 10240, 0.7, '未知文件类型，尝试轻量压缩');
    }
    
    return this.createStrategy(false, 'none', 'cat', '', 0, 1.0, '文件太小或类型不明，不建议压缩');
  }
  
  /**
   * 为指定压缩方法创建策略
   */
  private static createStrategyForMethod(method: 'gzip' | 'bzip2' | 'xz', size: number, reason: string): CompressionStrategy {
    switch (method) {
      case 'gzip':
        return this.createStrategy(true, 'gzip', 'tar -czf -', '.tar.gz', 1024, 0.4, reason);
      case 'bzip2':
        return this.createStrategy(true, 'bzip2', 'tar -jcf -', '.tar.bz2', 1024, 0.3, reason);
      case 'xz':
        return this.createStrategy(true, 'xz', 'tar -Jcf -', '.tar.xz', 1024, 0.2, reason);
      default:
        return this.createStrategy(false, 'none', 'cat', '', 0, 1.0, '不支持的压缩方法');
    }
  }
  
  /**
   * 创建压缩策略对象
   */
  private static createStrategy(
    enabled: boolean,
    method: 'gzip' | 'bzip2' | 'xz' | 'none',
    command: string,
    extension: string,
    threshold: number,
    estimatedRatio: number,
    reason: string
  ): CompressionStrategy {
    return {
      enabled,
      method,
      command,
      extension,
      threshold,
      estimatedRatio,
      reason
    };
  }
  
  /**
   * 检查远程服务器是否支持指定的压缩方法
   */
  static async checkCompressionSupport(sessionId: string, method: 'gzip' | 'bzip2' | 'xz'): Promise<boolean> {
    try {
      const { ipcRenderer } = window.require('electron');
      
      let checkCommand: string;
      switch (method) {
        case 'gzip':
          checkCommand = 'which gzip && which tar';
          break;
        case 'bzip2':
          checkCommand = 'which bzip2 && which tar';
          break;
        case 'xz':
          checkCommand = 'which xz && which tar';
          break;
        default:
          return false;
      }
      
      const result = await ipcRenderer.invoke('sftp:execute-command', {
        sessionId,
        command: checkCommand
      });
      
      return result.success && result.exitCode === 0;
    } catch (error) {
      console.warn(`检查压缩支持失败 (${method}):`, error);
      return false;
    }
  }
  
  /**
   * 获取压缩效果预估
   */
  static getCompressionEstimate(file: FileEntry, strategy: CompressionStrategy): {
    originalSize: number;
    estimatedCompressedSize: number;
    estimatedSavings: string;
    estimatedTimeSaving: string;
  } {
    const originalSize = file.size;
    const estimatedCompressedSize = Math.round(originalSize * strategy.estimatedRatio);
    const savingsBytes = originalSize - estimatedCompressedSize;
    const savingsPercentage = ((savingsBytes / originalSize) * 100).toFixed(1);
    
    // 假设基础传输速度为 2MB/s
    const baseSpeed = 2 * 1024 * 1024; // 2MB/s
    const originalTime = originalSize / baseSpeed;
    const compressedTime = estimatedCompressedSize / baseSpeed;
    const timeSaving = Math.max(0, originalTime - compressedTime);
    
    return {
      originalSize,
      estimatedCompressedSize,
      estimatedSavings: `${savingsPercentage}%`,
      estimatedTimeSaving: timeSaving > 1 ? `${timeSaving.toFixed(1)}秒` : '< 1秒'
    };
  }
  
  /**
   * 验证压缩策略是否可行
   */
  static validateStrategy(file: FileEntry, strategy: CompressionStrategy): {
    valid: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];
    
    // 检查文件大小是否超过阈值
    if (strategy.enabled && file.size < strategy.threshold) {
      warnings.push(`文件大小 (${file.size} bytes) 小于压缩阈值 (${strategy.threshold} bytes)`);
    }
    
    // 检查预估压缩比是否合理
    if (strategy.enabled && strategy.estimatedRatio > 0.9) {
      warnings.push('预估压缩效果有限，可能不值得压缩');
    }
    
    // 检查文件名是否包含特殊字符
    if (file.name.includes('"') || file.name.includes("'") || file.name.includes('`')) {
      warnings.push('文件名包含特殊字符，可能影响压缩命令执行');
    }
    
    return {
      valid: warnings.length === 0,
      warnings
    };
  }
}

export default CompressionStrategySelector;
