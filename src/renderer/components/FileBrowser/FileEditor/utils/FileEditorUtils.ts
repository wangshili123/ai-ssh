/**
 * 文件编辑器工具函数
 */

import fs from 'fs';
import { promisify } from 'util';
import { EditorErrorType } from '../types/FileEditorTypes';

const fsStat = promisify(fs.stat);
const fsOpen = promisify(fs.open);
const fsRead = promisify(fs.read);
const fsClose = promisify(fs.close);

/**
 * 获取文件基本信息
 * @param filePath 文件路径
 */
export async function getFileStats(filePath: string) {
  try {
    const stats = await fsStat(filePath);
    return {
      size: stats.size,
      lastModified: stats.mtime,
      exists: true
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(EditorErrorType.FILE_NOT_FOUND);
    }
    if ((error as NodeJS.ErrnoException).code === 'EACCES') {
      throw new Error(EditorErrorType.FILE_PERMISSION_DENIED);
    }
    throw error;
  }
}

/**
 * 读取文件块内容
 * @param filePath 文件路径
 * @param start 起始位置
 * @param size 读取大小
 */
export async function readFileChunk(filePath: string, start: number, size: number): Promise<Buffer> {
  let fd: number | null = null;
  try {
    fd = await fsOpen(filePath, 'r');
    const buffer = Buffer.alloc(size);
    const { bytesRead } = await fsRead(fd, buffer, 0, size, start);
    return buffer.slice(0, bytesRead);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(EditorErrorType.FILE_NOT_FOUND);
    }
    if ((error as NodeJS.ErrnoException).code === 'EACCES') {
      throw new Error(EditorErrorType.FILE_PERMISSION_DENIED);
    }
    throw error;
  } finally {
    if (fd !== null) {
      await fsClose(fd).catch(() => {});
    }
  }
}

/**
 * 检测文件编码
 * @param buffer 文件内容缓冲区
 */
export function detectEncoding(buffer: Buffer): string {
  // 检查BOM标记
  if (buffer.length >= 3) {
    if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      return 'utf8';
    }
    if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
      return 'utf16be';
    }
    if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
      return 'utf16le';
    }
  }

  // 默认假设为utf8
  try {
    buffer.toString('utf8');
    return 'utf8';
  } catch {
    return 'latin1'; // 如果utf8解码失败，使用latin1
  }
}

/**
 * 将Buffer转换为字符串数组（按行分割）
 * @param buffer 文件内容缓冲区
 * @param encoding 编码方式
 */
export function bufferToLines(buffer: Buffer, encoding: string): string[] {
  const content = buffer.toString(encoding as BufferEncoding);
  return content.split(/\r?\n/);
}

/**
 * 计算文本内容的内存占用
 * @param text 文本内容
 */
export function calculateTextMemoryUsage(text: string): number {
  return text.length * 2; // 假设每个字符占2字节
}

/**
 * 检查文件大小是否超过限制
 * @param size 文件大小（字节）
 * @param limit 大小限制（字节）
 */
export function checkFileSizeLimit(size: number, limit: number): boolean {
  return size <= limit;
} 