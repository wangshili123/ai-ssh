/**
 * 文件加载管理器
 * 负责大文件的分块加载、过滤和内存管理
 */

import { EventEmitter } from 'events';
import { EditorEvents, RemoteFileInfo, EncodingType } from '../types/FileEditorTypes';
import { ErrorManager, ErrorType } from './ErrorManager';
import { sftpService } from '../../../../services/sftp';
import { detectEncoding, isValidEncoding } from '../utils/FileEncodingUtils';

const LARGE_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const INITIAL_CHUNK_SIZE = 1024 * 1024; // 1MB

export interface FileInfo {
  size: number;
  modifyTime: number;
  isPartiallyLoaded: boolean;
}

export interface FilterConfig {
  pattern: string;
  isRegex: boolean;
  caseSensitive: boolean;
}

export interface LoadChunkResult {
  content: string[];
  startLine: number;
  endLine: number;
  isFiltered: boolean;
}

interface FileChunk {
  content: string;
  startLine: number;
  endLine: number;
}

export class FileLoaderManager extends EventEmitter {
  private sessionId: string;
  private filePath: string;
  private errorManager: ErrorManager;
  private fileInfo: RemoteFileInfo | null = null;
  private encoding: EncodingType = 'UTF-8';
  private chunks: FileChunk[] = [];
  private content: string = '';

  constructor(sessionId: string, filePath: string, errorManager: ErrorManager) {
    super();
    this.sessionId = sessionId;
    this.filePath = filePath;
    this.errorManager = errorManager;
  }

  /**
   * 初始化文件加载器
   */
  public async initialize(): Promise<void> {
    try {
      const stats = await sftpService.stat(this.sessionId, this.filePath);
      this.fileInfo = {
        size: stats.size,
        modifyTime: stats.modifyTime,
        isDirectory: stats.isDirectory,
        permissions: stats.permissions,
        encoding: this.encoding,
        isPartiallyLoaded: false
      };

      if (stats.size > LARGE_FILE_SIZE) {
        await this.loadPartialContent();
      } else {
        await this.loadEntireContent();
      }
    } catch (error) {
      this.errorManager.handleError(error as Error, ErrorType.FILE_NOT_FOUND);
    }
  }

  /**
   * 加载部分内容
   */
  private async loadPartialContent(): Promise<void> {
    try {
      this.emit(EditorEvents.LOADING_START);
      const result = await sftpService.readChunk(
        this.sessionId,
        this.filePath,
        0,
        INITIAL_CHUNK_SIZE,
        this.encoding as BufferEncoding
      );
      this.content = result.content;
      if (this.fileInfo) {
        this.fileInfo.isPartiallyLoaded = true;
      }
      this.emit(EditorEvents.PARTIAL_LOAD);
      this.emit(EditorEvents.LOADING_END);
    } catch (error) {
      this.errorManager.handleError(error as Error, ErrorType.OPERATION_FAILED);
    }
  }

  /**
   * 加载整个文件内容
   */
  private async loadEntireContent(): Promise<void> {
    try {
      this.emit(EditorEvents.LOADING_START);
      const result = await sftpService.readFile(this.sessionId, this.filePath);
      this.content = result.content;
      if (this.fileInfo) {
        this.fileInfo.isPartiallyLoaded = false;
      }
      this.emit(EditorEvents.FILE_LOADED);
      this.emit(EditorEvents.LOADING_END);
    } catch (error) {
      this.errorManager.handleError(error as Error, ErrorType.OPERATION_FAILED);
    }
  }

  /**
   * 重新加载文件
   */
  public async reload(): Promise<void> {
    if (this.fileInfo?.isPartiallyLoaded) {
      await this.loadPartialContent();
    } else {
      await this.loadEntireContent();
    }
  }

  /**
   * 设置文件编码
   */
  public async setEncoding(encoding: string): Promise<void> {
    try {
      if (!isValidEncoding(encoding)) {
        throw new Error(`不支持的编码格式: ${encoding}`);
      }
      this.encoding = encoding as EncodingType;
      await this.reload();
    } catch (error) {
      this.errorManager.handleError(error as Error, ErrorType.ENCODING_ERROR);
    }
  }

  /**
   * 获取文件内容
   */
  public getContent(): string {
    return this.content;
  }

  /**
   * 获取文件信息
   */
  public getFileInfo(): RemoteFileInfo | null {
    return this.fileInfo;
  }
} 