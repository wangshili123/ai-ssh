/**
 * 文件处理 Worker
 * 用于多线程处理大文件，包括文件读取、过滤和搜索
 */

import { Worker } from 'worker_threads';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import * as iconv from 'iconv-lite';
import * as jschardet from 'jschardet';

// Worker 消息类型
export interface WorkerMessage {
  type: 'read' | 'filter' | 'search';
  data: any;
}

// 文件读取请求
export interface ReadRequest {
  filePath: string;
  start: number;
  size: number;
  encoding: string;
}

// 过滤请求
export interface FilterRequest {
  content: string[];
  pattern: string;
  isRegex: boolean;
  caseSensitive: boolean;
}

// 搜索请求
export interface SearchRequest {
  content: string[];
  pattern: string;
  isRegex: boolean;
  caseSensitive: boolean;
  wholeWord: boolean;
  startLine: number;
}

// Worker 线程代码
const workerCode = `
const { parentPort } = require('worker_threads');
const fs = require('fs').promises;
const iconv = require('iconv-lite');
const jschardet = require('jschardet');

// 处理文件读取
async function readFile(request) {
  try {
    const { filePath, start, size, encoding } = request;
    const buffer = Buffer.alloc(size);
    const fileHandle = await fs.open(filePath, 'r');
    
    try {
      const { bytesRead } = await fileHandle.read(buffer, 0, size, start);
      let content;

      if (encoding === 'binary') {
        content = buffer.slice(0, bytesRead).toString('binary');
      } else if (encoding === 'UTF-8') {
        content = buffer.slice(0, bytesRead).toString('utf8');
      } else {
        content = iconv.decode(buffer.slice(0, bytesRead), encoding);
      }

      return { content, bytesRead };
    } finally {
      await fileHandle.close();
    }
  } catch (error) {
    throw new Error('读取文件失败: ' + error.message);
  }
}

// 处理过滤
function filterContent(request) {
  const { content, pattern, isRegex, caseSensitive } = request;
  
  try {
    let regex;
    if (isRegex) {
      regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
    } else {
      const escaped = pattern.replace(/[-/\\^$*+?.()|[\\]{}]/g, '\\\\$&');
      regex = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
    }

    return content.filter(line => regex.test(line));
  } catch (error) {
    throw new Error('过滤内容失败: ' + error.message);
  }
}

// 处理搜索
function searchContent(request) {
  const { content, pattern, isRegex, caseSensitive, wholeWord, startLine } = request;
  
  try {
    let regex;
    if (isRegex) {
      regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
    } else {
      const escaped = pattern.replace(/[-/\\^$*+?.()|[\\]{}]/g, '\\\\$&');
      const searchPattern = wholeWord ? '\\\\\\\\b' + escaped + '\\\\\\\\b' : escaped;
      regex = new RegExp(searchPattern, caseSensitive ? 'g' : 'gi');
    }

    const results = [];
    content.forEach((line, index) => {
      let match;
      while ((match = regex.exec(line)) !== null) {
        const previewStart = Math.max(0, match.index - 50);
        const previewEnd = Math.min(line.length, match.index + match[0].length + 50);
        const preview = line.substring(previewStart, previewEnd);

        results.push({
          lineNumber: startLine + index,
          matchStart: match.index,
          matchEnd: match.index + match[0].length,
          previewText: preview
        });
      }
    });

    return results;
  } catch (error) {
    throw new Error('搜索内容失败: ' + error.message);
  }
}

// 监听消息
parentPort.on('message', async (message) => {
  try {
    let result;
    switch (message.type) {
      case 'read':
        result = await readFile(message.data);
        break;
      case 'filter':
        result = filterContent(message.data);
        break;
      case 'search':
        result = searchContent(message.data);
        break;
      default:
        throw new Error('未知的消息类型: ' + message.type);
    }
    parentPort.postMessage({ success: true, data: result });
  } catch (error) {
    parentPort.postMessage({ success: false, error: error.message });
  }
});
`;

// Worker 管理器
export class FileWorker extends EventEmitter {
  private worker: Worker;

  constructor() {
    super();
    
    // 创建临时文件存储 worker 代码
    const tempFile = path.join(os.tmpdir(), `file-worker-${Date.now()}.js`);
    fs.writeFileSync(tempFile, workerCode);

    // 创建 worker 实例
    this.worker = new Worker(tempFile);

    // 监听 worker 消息
    this.worker.on('message', (message: { success: boolean; data?: any; error?: string }) => {
      if (message.success) {
        this.emit('result', message.data);
      } else {
        this.emit('error', new Error(message.error));
      }
    });

    // 监听 worker 错误
    this.worker.on('error', (error: Error) => {
      this.emit('error', error);
    });

    // 清理临时文件
    fs.unlinkSync(tempFile);
  }

  /**
   * 执行 worker 任务
   * @param message Worker 消息
   * @returns 执行结果
   */
  async execute<T>(message: WorkerMessage): Promise<T> {
    return new Promise((resolve, reject) => {
      const handleResult = (result: T) => {
        this.off('result', handleResult);
        this.off('error', handleError);
        resolve(result);
      };

      const handleError = (error: Error) => {
        this.off('result', handleResult);
        this.off('error', handleError);
        reject(error);
      };

      this.on('result', handleResult);
      this.on('error', handleError);

      this.worker.postMessage(message);
    });
  }

  /**
   * 销毁 worker
   */
  destroy(): void {
    this.worker.terminate();
    this.removeAllListeners();
  }
} 