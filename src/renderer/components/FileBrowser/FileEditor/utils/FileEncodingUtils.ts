/**
 * 文件编码处理工具
 */

import { Buffer } from 'buffer';
import iconv from 'iconv-lite';
import jschardet from 'jschardet';

// 支持的编码列表
export const SupportedEncodings = [
  'UTF-8',
  'UTF-16LE',
  'UTF-16BE',
  'GB18030',
  'GBK',
  'GB2312',
  'BIG5',
  'EUC-JP',
  'SHIFT-JIS',
  'EUC-KR',
  'ASCII',
  'ISO-8859-1'
] as const;

export type EncodingType = typeof SupportedEncodings[number];

/**
 * 检测文件编码
 * @param buffer 文件内容缓冲区
 * @returns 检测到的编码
 */
export function detectEncoding(buffer: Buffer): EncodingType {
  // 检查 BOM 标记
  if (buffer.length >= 4) {
    if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      return 'UTF-8';
    }
    if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
      return 'UTF-16BE';
    }
    if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
      return 'UTF-16LE';
    }
  }

  // 使用 jschardet 进行编码检测
  const result = jschardet.detect(buffer);
  const encoding = result.encoding?.toUpperCase() as EncodingType;

  // 如果检测结果在支持的编码列表中，则返回该编码
  if (SupportedEncodings.includes(encoding)) {
    return encoding;
  }

  // 默认返回 UTF-8
  return 'UTF-8';
}

/**
 * 将 Buffer 转换为指定编码的字符串
 * @param buffer 文件内容缓冲区
 * @param encoding 目标编码
 * @returns 转换后的字符串
 */
export function bufferToString(buffer: Buffer, encoding: EncodingType): string {
  if (encoding === 'UTF-8') {
    return buffer.toString('utf8');
  }
  return iconv.decode(buffer, encoding);
}

/**
 * 将字符串转换为指定编码的 Buffer
 * @param content 文件内容字符串
 * @param encoding 目标编码
 * @returns 转换后的 Buffer
 */
export function stringToBuffer(content: string, encoding: EncodingType): Buffer {
  if (encoding === 'UTF-8') {
    return Buffer.from(content, 'utf8');
  }
  return iconv.encode(content, encoding);
}

/**
 * 转换文件编码
 * @param content 文件内容
 * @param fromEncoding 源编码
 * @param toEncoding 目标编码
 * @returns 转换后的内容
 */
export function convertEncoding(
  content: string,
  fromEncoding: EncodingType,
  toEncoding: EncodingType
): string {
  if (fromEncoding === toEncoding) {
    return content;
  }

  const buffer = stringToBuffer(content, fromEncoding);
  return bufferToString(buffer, toEncoding);
}

/**
 * 验证编码是否有效
 * @param encoding 要验证的编码
 * @returns 是否为有效的编码
 */
export function isValidEncoding(encoding: string): encoding is EncodingType {
  return SupportedEncodings.includes(encoding as EncodingType);
}

/**
 * 获取支持的编码列表
 * @returns 支持的编码列表
 */
export function getSupportedEncodings(): readonly EncodingType[] {
  return SupportedEncodings;
} 