/**
 * 浏览模式核心实现
 * 负责基于系统命令的文件浏览、过滤和搜索功能
 */

import { EventEmitter } from 'events';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { 
  EditorEvents, 
  EditorErrorType, 
  FilterConfig, 
  SearchConfig, 
  SearchResult,
  BrowseModeState,
  FileChunk,
  FileWatchEventData
} from '../types/FileEditorTypes';
import { ErrorManager } from './ErrorManager';
import { FileWatchManager } from './FileWatchManager';
import { encodingManager, EncodingDetectionResult } from './EncodingManager';

const execAsync = promisify(exec);

// 默认配置
const DEFAULT_CHUNK_SIZE = 1000; // 默认块大小（行数）
const MAX_CACHED_CHUNKS = 10;    // 最大缓存块数
const LARGE_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * 浏览模式管理器
 * 使用系统命令实现高效的文件浏览、过滤和搜索
 */
export class BrowseMode extends EventEmitter {
  private filePath: string;
  private sessionId: string;
  private state: BrowseModeState;
  private errorManager: ErrorManager;
  private realtimeProcess: ChildProcess | null = null;
  private fileWatcher: FileWatchManager | null = null;
  private isWindows: boolean;
  private encoding: BufferEncoding;
  private fileSize: number = 0;
  private lastCommandOutput: string = '';
  private commandRunning: boolean = false;
  private lastFilterResult: string[] | null = null;

  /**
   * 构造函数
   * @param filePath 文件路径
   * @param sessionId 会话ID
   * @param errorManager 错误管理器
   */
  constructor(filePath: string, sessionId: string, errorManager: ErrorManager) {
    super();
    this.filePath = filePath;
    this.sessionId = sessionId;
    this.errorManager = errorManager;
    this.isWindows = process.platform === 'win32';
    
    // 尝试获取记忆的编码或推荐的编码
    const remembered = encodingManager.getRememberedEncoding(filePath);
    if (remembered) {
      this.encoding = remembered as BufferEncoding;
    } else {
      const recommended = encodingManager.getRecommendedEncoding(filePath);
      this.encoding = recommended as BufferEncoding;
    }
    
    this.state = {
      visibleRange: [0, 0],
      loadedChunks: {},
      isFiltered: false,
      isRealtime: false,
      isAutoScroll: false
    };
    
    // 获取文件基本信息
    this.getFileInfo().catch(error => {
      this.errorManager.handleError(
        EditorErrorType.FILE_NOT_FOUND,
        `无法获取文件信息: ${error.message}`
      );
    });
  }

  /**
   * 获取文件信息
   * 使用系统命令获取文件大小和其他信息
   */
  private async getFileInfo(): Promise<void> {
    try {
      if (this.isWindows) {
        // Windows 使用 PowerShell 获取文件信息
        const { stdout } = await execAsync(`powershell -Command "(Get-Item '${this.filePath}').Length"`);
        this.fileSize = parseInt(stdout.trim(), 10);
      } else {
        // Linux/Mac 使用 stat 命令
        const { stdout } = await execAsync(`stat -c %s "${this.filePath}"`);
        this.fileSize = parseInt(stdout.trim(), 10);
      }
      
      this.emit(EditorEvents.FILE_LOADED, { 
        size: this.fileSize,
        path: this.filePath
      });
    } catch (error: any) {
      this.errorManager.handleError(
        EditorErrorType.FILE_NOT_FOUND,
        `无法获取文件信息: ${error.message}`
      );
    }
  }

  /**
   * 执行系统命令
   * @param command 要执行的命令
   * @param isLongRunning 是否是长时间运行的命令
   * @returns 命令输出或子进程
   */
  private async executeCommand(command: string, isLongRunning: boolean = false): Promise<string | ChildProcess> {
    if (this.commandRunning && !isLongRunning) {
      console.warn('已有命令正在执行，请稍后再试');
      return '';
    }
    
    try {
      if (isLongRunning) {
        // 长时间运行的命令使用 spawn
        let cmd: string;
        let args: string[];
        
        if (this.isWindows) {
          cmd = 'cmd';
          args = ['/c', command];
        } else {
          cmd = 'sh';
          args = ['-c', command];
        }
        
        const process = spawn(cmd, args);
        
        process.stdout?.setEncoding(this.encoding);
        process.stdout?.on('data', (data: Buffer | string) => {
          this.emit(EditorEvents.FILE_CHANGED, data.toString());
        });
        
        process.stderr?.setEncoding(this.encoding);
        process.stderr?.on('data', (data: Buffer | string) => {
          this.errorManager.handleError(
            EditorErrorType.OPERATION_TIMEOUT,
            `命令执行错误: ${data.toString()}`
          );
        });
        
        process.on('close', (code: number | null) => {
          if (code !== 0 && code !== null) {
            this.errorManager.handleError(
              EditorErrorType.OPERATION_TIMEOUT,
              `命令执行失败，退出码: ${code}`
            );
          }
        });
        
        return process;
      } else {
        // 短时间运行的命令使用 exec
        this.commandRunning = true;
        const { stdout } = await execAsync(command);
        this.lastCommandOutput = stdout;
        this.commandRunning = false;
        return stdout;
      }
    } catch (error: any) {
      this.commandRunning = false;
      this.errorManager.handleError(
        EditorErrorType.OPERATION_TIMEOUT,
        `命令执行错误: ${error.message}`
      );
      return '';
    }
  }

  /**
   * 加载指定范围的文件内容
   * @param start 起始行号
   * @param end 结束行号
   * @returns 加载的内容
   */
  public async loadChunk(start: number, end: number): Promise<string[]> {
    // 检查缓存中是否已有该块
    const chunkKey = `${start}-${end}`;
    if (this.state.loadedChunks[chunkKey]) {
      // 更新访问时间
      this.state.loadedChunks[chunkKey].lastAccessed = Date.now();
      return this.state.loadedChunks[chunkKey].content;
    }
    
    // 使用系统命令获取指定范围的行
    let command: string;
    if (this.isWindows) {
      // Windows 使用 PowerShell 的 Get-Content
      command = `powershell -Command "Get-Content -Path '${this.filePath}' -Encoding ${this.encoding} -TotalCount ${end} | Select-Object -Skip ${start-1}"`;
    } else {
      // Linux/Mac 使用 sed
      command = `sed -n '${start},${end}p' "${this.filePath}"`;
    }
    
    this.emit(EditorEvents.LOADING_START);
    
    try {
      const output = await this.executeCommand(command) as string;
      const lines = output.split('\n');
      
      // 如果最后一行是空行，移除它（通常是命令输出的额外换行）
      if (lines[lines.length - 1] === '') {
        lines.pop();
      }
      
      // 缓存结果
      this.state.loadedChunks[chunkKey] = {
        content: lines,
        startLine: start,
        endLine: end,
        lastAccessed: Date.now()
      };
      
      // 管理缓存大小
      this.manageCache();
      
      // 更新可见范围
      this.state.visibleRange = [start, end];
      
      this.emit(EditorEvents.LOADING_END);
      this.emit(EditorEvents.PARTIAL_LOAD, { start, end, content: lines });
      
      return lines;
    } catch (error: any) {
      this.emit(EditorEvents.LOADING_END);
      this.errorManager.handleError(
        EditorErrorType.OPERATION_TIMEOUT,
        `加载文件块失败: ${error.message}`
      );
      return [];
    }
  }

  /**
   * 管理缓存大小
   * 当缓存块数超过最大限制时，移除最久未访问的块
   */
  private manageCache(): void {
    const chunks = Object.keys(this.state.loadedChunks);
    if (chunks.length <= MAX_CACHED_CHUNKS) {
      return;
    }
    
    // 按最后访问时间排序
    const sortedChunks = chunks.sort((a, b) => 
      this.state.loadedChunks[a].lastAccessed - this.state.loadedChunks[b].lastAccessed
    );
    
    // 移除最旧的块，直到缓存大小符合限制
    while (sortedChunks.length > MAX_CACHED_CHUNKS) {
      const oldestChunk = sortedChunks.shift();
      if (oldestChunk) {
        delete this.state.loadedChunks[oldestChunk];
      }
    }
  }

  /**
   * 获取已加载行数
   * 返回当前已加载到内存中的文件行数
   * @returns 已加载的行数
   */
  public getLoadedLines(): number {
    let loadedLines = 0;
    
    // 计算所有已加载块中的行数总和
    for (const chunkKey in this.state.loadedChunks) {
      const chunk = this.state.loadedChunks[chunkKey];
      loadedLines += chunk.content.length;
    }
    
    return loadedLines;
  }

  /**
   * 获取已过滤行数
   * 返回符合当前过滤条件的行数
   * @returns 过滤后的行数，如果没有过滤则返回undefined
   */
  public getFilteredLines(): number | undefined {
    // 如果没有应用过滤，返回undefined
    if (!this.state.isFiltered || !this.state.filterPattern) {
      return undefined;
    }
    
    // 如果有缓存的过滤结果，返回行数
    const filteredResult = this.lastFilterResult;
    if (filteredResult && Array.isArray(filteredResult)) {
      return filteredResult.length;
    }
    
    return undefined;
  }

  /**
   * 应用过滤条件
   * @param config 过滤配置
   * @returns 过滤结果
   */
  public async applyFilter(config: FilterConfig): Promise<string[]> {
    const { pattern, isRegex, caseSensitive, contextLines = 0 } = config;
    
    if (!pattern) {
      // 清除过滤
      this.state.isFiltered = false;
      this.state.filterPattern = undefined;
      this.lastFilterResult = null;
      this.emit(EditorEvents.FILTER_CLEARED);
      return [];
    }
    
    this.emit(EditorEvents.FILTER_STARTED);
    
    // 构建 grep 命令
    let grepCmd: string;
    const patternArg = isRegex ? pattern : pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    if (this.isWindows) {
      // Windows 使用 PowerShell 的 Select-String
      const caseFlag = caseSensitive ? '' : '-CaseSensitive:$false';
      const contextFlag = contextLines > 0 ? `-Context ${contextLines}` : '';
      grepCmd = `powershell -Command "Get-Content '${this.filePath}' | Select-String ${caseFlag} ${contextFlag} -Pattern '${patternArg}'"`;
    } else {
      // Linux/Mac 使用 grep
      const caseFlag = caseSensitive ? '' : '-i';
      const contextFlag = contextLines > 0 ? `-C ${contextLines}` : '';
      grepCmd = `grep ${caseFlag} ${contextFlag} -n '${patternArg}' "${this.filePath}"`;
    }
    
    try {
      const output = await this.executeCommand(grepCmd) as string;
      const lines = output.split('\n').filter(line => line.trim() !== '');
      
      // 更新状态和缓存结果
      this.state.isFiltered = true;
      this.state.filterPattern = pattern;
      this.lastFilterResult = lines;
      
      this.emit(EditorEvents.FILTER_COMPLETED, {
        matchedLines: lines.length,
        pattern
      });
      
      return lines;
    } catch (error: any) {
      this.emit(EditorEvents.FILTER_ERROR, error);
      this.errorManager.handleError(
        EditorErrorType.OPERATION_TIMEOUT,
        `过滤操作失败: ${error.message}`
      );
      return [];
    }
  }

  /**
   * 搜索文件内容
   * @param config 搜索配置
   * @returns 搜索结果
   */
  public async search(config: SearchConfig): Promise<SearchResult[]> {
    const { pattern, isRegex, caseSensitive, wholeWord } = config;
    
    if (!pattern) {
      this.emit(EditorEvents.SEARCH_STOPPED);
      return [];
    }
    
    this.emit(EditorEvents.SEARCH_STARTED);
    
    // 构建 grep 命令
    let grepCmd: string;
    let patternArg = isRegex ? pattern : pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    if (wholeWord) {
      patternArg = isRegex ? `\\b${patternArg}\\b` : `\\b${patternArg}\\b`;
    }
    
    if (this.isWindows) {
      // Windows 使用 PowerShell 的 Select-String
      const caseFlag = caseSensitive ? '' : '-CaseSensitive:$false';
      grepCmd = `powershell -Command "Get-Content '${this.filePath}' | Select-String ${caseFlag} -Pattern '${patternArg}' | ForEach-Object { $_.LineNumber.ToString() + ':' + $_.Line }"`;
    } else {
      // Linux/Mac 使用 grep
      const caseFlag = caseSensitive ? '' : '-i';
      grepCmd = `grep ${caseFlag} -n '${patternArg}' "${this.filePath}"`;
    }
    
    try {
      const output = await this.executeCommand(grepCmd) as string;
      const lines = output.split('\n').filter(line => line.trim() !== '');
      
      // 解析结果
      const results: SearchResult[] = [];
      
      for (const line of lines) {
        // 格式: "行号:内容"
        const match = line.match(/^(\d+):(.*)/);
        if (match) {
          const lineNum = parseInt(match[1], 10);
          const text = match[2];
          
          // 查找匹配位置
          let column = 0;
          let length = pattern.length;
          
          if (isRegex) {
            // 对于正则表达式，需要在文本中再次搜索以获取精确位置
            const regExp = new RegExp(patternArg, caseSensitive ? '' : 'i');
            const textMatch = text.match(regExp);
            if (textMatch) {
              column = textMatch.index || 0;
              length = textMatch[0].length;
            }
          } else {
            // 对于普通文本，直接搜索
            const searchText = caseSensitive ? pattern : pattern.toLowerCase();
            const lineText = caseSensitive ? text : text.toLowerCase();
            column = lineText.indexOf(searchText);
            length = pattern.length;
          }
          
          results.push({
            line: lineNum,
            column,
            length,
            text
          });
        }
      }
      
      this.emit(EditorEvents.SEARCH_COMPLETED, {
        totalMatches: results.length,
        pattern
      });
      
      return results;
    } catch (error: any) {
      this.emit(EditorEvents.SEARCH_ERROR, error);
      this.errorManager.handleError(
        EditorErrorType.OPERATION_TIMEOUT,
        `搜索操作失败: ${error.message}`
      );
      return [];
    }
  }

  /**
   * 启动实时监控模式
   * 使用 FileWatchManager 监控文件变化
   */
  public startRealtime(useWatcher: boolean = true): void {
    if (this.state.isRealtime) {
      // 已经在监控中
      return;
    }
    
    if (useWatcher) {
      try {
        // 使用 FileWatchManager
        if (!this.fileWatcher) {
          this.fileWatcher = new FileWatchManager();
          this.setupWatcherEvents();
        }
        
        this.fileWatcher.startWatch(this.sessionId, this.filePath);
        this.state.isRealtime = true;
        this.emit(EditorEvents.WATCH_STARTED);
      } catch (error: any) {
        this.errorManager.handleError(
          EditorErrorType.OPERATION_TIMEOUT,
          `启动实时监控失败: ${error.message}`
        );
      }
    } else {
      // 使用原有的基于命令行的方式
      let command: string;
      if (this.isWindows) {
        // Windows 使用 PowerShell 模拟 tail -f
        command = `powershell -Command "Get-Content -Path '${this.filePath}' -Wait -Tail 10"`;
      } else {
        // Linux/Mac 使用 tail -f
        command = `tail -f "${this.filePath}"`;
      }
      
      try {
        // 直接使用 spawn 而不是通过 executeCommand
        let cmd: string;
        let args: string[];
        
        if (this.isWindows) {
          cmd = 'cmd';
          args = ['/c', command];
        } else {
          cmd = 'sh';
          args = ['-c', command];
        }
        
        const process = spawn(cmd, args);
        
        process.stdout?.setEncoding(this.encoding);
        process.stdout?.on('data', (data: Buffer | string) => {
          this.emit(EditorEvents.FILE_CHANGED, data.toString());
        });
        
        process.stderr?.setEncoding(this.encoding);
        process.stderr?.on('data', (data: Buffer | string) => {
          this.errorManager.handleError(
            EditorErrorType.OPERATION_TIMEOUT,
            `命令执行错误: ${data.toString()}`
          );
        });
        
        this.realtimeProcess = process;
        this.state.isRealtime = true;
        this.emit(EditorEvents.WATCH_STARTED);
      } catch (error: any) {
        this.errorManager.handleError(
          EditorErrorType.OPERATION_TIMEOUT,
          `启动实时监控失败: ${error.message}`
        );
      }
    }
  }

  /**
   * 停止实时监控模式
   */
  public stopRealtime(): void {
    if (this.fileWatcher) {
      this.fileWatcher.stopWatch(this.sessionId, this.filePath);
    }
    
    if (this.realtimeProcess) {
      this.realtimeProcess.kill();
      this.realtimeProcess = null;
    }
    
    this.state.isRealtime = false;
    this.emit(EditorEvents.WATCH_STOPPED);
  }

  /**
   * 设置文件监控事件
   */
  private setupWatcherEvents(): void {
    if (!this.fileWatcher) return;

    this.fileWatcher.on('watch-event', (eventData: FileWatchEventData) => {
      switch (eventData.type) {
        case 'update':
          if (eventData.content) {
            // 处理新内容
            this.handleNewContent(eventData.content);
          }
          break;
        
        case 'error':
          this.errorManager.handleError(
            EditorErrorType.UNKNOWN_ERROR,
            `文件监控错误: ${eventData.error?.message || '未知错误'}`
          );
          break;
        
        case 'warning':
          // 处理警告
          console.warn('文件监控警告:', eventData.warning);
          break;
        
        case 'info':
          // 处理信息
          console.info('文件监控信息:', eventData.info);
          break;
      }
    });
  }

  /**
   * 处理新内容
   */
  private handleNewContent(lines: string[]): void {
    // 更新缓存
    const visibleEnd = this.state.visibleRange[1];
    const lastChunkKey = `${visibleEnd - (visibleEnd % DEFAULT_CHUNK_SIZE)}`;
    const lastChunk = this.state.loadedChunks[lastChunkKey];
    
    if (lastChunk) {
      // 添加到最后一个块
      lastChunk.content = [...lastChunk.content, ...lines];
      lastChunk.endLine += lines.length;
      lastChunk.lastAccessed = Date.now();
    }
    
    // 更新总行数（如果已知）
    if (this.state.totalLines !== undefined) {
      this.state.totalLines += lines.length;
    }
    
    // 触发内容变更事件
    this.emit(EditorEvents.CONTENT_CHANGED, {
      lines,
      startLine: visibleEnd,
      endLine: visibleEnd + lines.length
    });
    
    // 触发文件变更事件
    this.emit(EditorEvents.FILE_CHANGED, lines.join('\n'));
    
    // 如果启用自动滚动，滚动到底部
    if (this.state.isAutoScroll) {
      this.scrollToBottom();
    }
  }

  /**
   * 获取文件总行数
   * 使用 wc -l 命令计算行数
   */
  public async getTotalLines(): Promise<number> {
    if (this.state.totalLines !== undefined) {
      return this.state.totalLines;
    }
    
    let command: string;
    if (this.isWindows) {
      // Windows 使用 PowerShell
      command = `powershell -Command "(Get-Content '${this.filePath}' | Measure-Object -Line).Lines"`;
    } else {
      // Linux/Mac 使用 wc -l
      command = `wc -l < "${this.filePath}"`;
    }
    
    try {
      const output = await this.executeCommand(command) as string;
      const lines = parseInt(output.trim(), 10);
      this.state.totalLines = lines;
      return lines;
    } catch (error: any) {
      this.errorManager.handleError(
        EditorErrorType.OPERATION_TIMEOUT,
        `获取文件行数失败: ${error.message}`
      );
      return 0;
    }
  }

  /**
   * 获取当前状态
   * @returns 浏览模式状态
   */
  public getState(): BrowseModeState {
    return this.state;
  }

  /**
   * 设置编码
   * @param encoding 编码
   */
  public setEncoding(encoding: string): void {
    if (this.encoding === encoding) {
      return;
    }
    
    // 更新编码
    this.encoding = encoding as BufferEncoding;
    
    // 记住这个文件的编码
    encodingManager.rememberEncoding(this.filePath, encoding);
    
    // 清除缓存，因为编码变更会影响内容
    this.state.loadedChunks = {};
    
    // 触发编码变更事件
    this.emit(EditorEvents.ENCODING_CHANGED, {
      encoding,
      filePath: this.filePath
    });
    
    // 重新加载可见区域
    this.reloadVisibleContent();
  }
  
  /**
   * 重新加载可见区域的内容
   */
  private async reloadVisibleContent(): Promise<void> {
    const [start, end] = this.state.visibleRange;
    try {
      // 加载可见区域的内容
      const content = await this.loadChunk(start, end);
      
      // 触发内容变更事件
      this.emit(EditorEvents.CONTENT_CHANGED, {
        lines: content,
        startLine: start,
        endLine: end
      });
    } catch (error) {
      this.errorManager.handleError(
        EditorErrorType.OPERATION_TIMEOUT,
        `重新加载内容失败: ${error}`
      );
    }
  }
  
  /**
   * 检测文件编码
   * @returns 检测结果
   */
  public async detectEncoding(): Promise<EncodingDetectionResult> {
    try {
      // 读取文件开头一小部分内容用于检测
      const sampleSize = 4096; // 4KB 样本
      const command = this.isWindows
        ? `powershell -Command "Get-Content -Path '${this.filePath}' -Encoding Byte -TotalCount ${sampleSize}"`
        : `head -c ${sampleSize} "${this.filePath}" | xxd -p`;
      
      const output = await this.executeCommand(command) as string;
      
      // 将十六进制字符串转换为 Buffer
      let buffer: Buffer;
      if (this.isWindows) {
        // Windows PowerShell 输出格式不同，需要特殊处理
        const bytes = output.trim().split('\n').map(line => parseInt(line, 10));
        buffer = Buffer.from(bytes);
      } else {
        // Linux/Mac xxd 输出格式
        const hexString = output.replace(/\s+/g, '');
        buffer = Buffer.from(hexString, 'hex');
      }
      
      // 使用编码管理器检测
      const result = encodingManager.detectEncoding(buffer);
      
      // 如果检测到新的编码，并且与当前不同，则自动设置
      if (result.encoding !== this.encoding && result.confidence > 0.7) {
        this.setEncoding(result.encoding);
      }
      
      return result;
    } catch (error) {
      this.errorManager.handleError(
        EditorErrorType.OPERATION_TIMEOUT,
        `检测文件编码失败: ${error}`
      );
      return { encoding: 'utf8', confidence: 0, certain: false };
    }
  }

  /**
   * 清理资源
   * 停止所有进程，释放资源
   */
  public dispose(): void {
    this.stopRealtime();
    
    if (this.fileWatcher) {
      this.fileWatcher.destroy();
      this.fileWatcher = null;
    }
    
    if (this.realtimeProcess) {
      this.realtimeProcess.kill();
      this.realtimeProcess = null;
    }
    
    this.removeAllListeners();
    this.state.loadedChunks = {};
  }

  /**
   * 设置是否自动滚动
   * 在实时监控模式下，控制是否自动滚动到最新内容
   * @param enabled 是否启用自动滚动
   */
  public setAutoScroll(enabled: boolean): void {
    // 更新状态
    this.state.isAutoScroll = enabled;
    
    // 触发事件
    this.emit(EditorEvents.AUTO_SCROLL_CHANGED, enabled);
    
    // 如果需要，这里可以添加自动滚动的具体实现
    // 例如，如果正在实时监控，可以自动滚动到最新内容
    if (enabled && this.state.isRealtime) {
      this.scrollToBottom();
    }
  }
  
  /**
   * 获取是否启用自动滚动
   * @returns 是否启用自动滚动
   */
  public isAutoScrollEnabled(): boolean {
    return this.state.isAutoScroll;
  }
  
  /**
   * 滚动到底部
   * 当自动滚动启用时，滚动到最新内容
   * 私有方法，由setAutoScroll和实时更新事件触发
   */
  private scrollToBottom(): void {
    // 实际滚动行为需要根据UI实现
    // 这里仅作为示例，实际项目中可能需要通过事件或回调通知UI组件进行滚动
    this.emit('scrollToBottom');
  }

  /**
   * 导航到下一个匹配项
   * @param wrap 是否在结尾处循环到开头
   */
  public navigateToNextMatch(wrap: boolean = true): void {
    // 在实际实现中需要实现导航逻辑
    console.log('导航到下一个匹配项', wrap);
  }

  /**
   * 导航到上一个匹配项
   * @param wrap 是否在开头处循环到结尾
   */
  public navigateToPreviousMatch(wrap: boolean = true): void {
    // 在实际实现中需要实现导航逻辑
    console.log('导航到上一个匹配项', wrap);
  }
} 