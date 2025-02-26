/**
 * 编码管理器
 * 用于管理文件编码、存储编码偏好、以及检测文件编码
 */

// 移除找不到的模块导入
// import { getGlobal } from 'electerm-core/utils';
// import store from 'electerm-core/store';
import convertCharset from 'jschardet';
// import { extensions } from 'electerm-core/extensions';

// 常用编码列表
export const COMMON_ENCODINGS = [
  'utf8',
  'utf16le',
  'ascii',
  'gb2312',
  'gbk',
  'big5',
  'euc-jp',
  'euc-kr',
  'latin1'
];

// 所有支持的编码列表（Node.js Buffer支持的编码加上额外支持的编码）
export const ALL_ENCODINGS = [
  'utf8',
  'utf16le',
  'ascii',
  'latin1', 
  'base64',
  'hex',
  'binary',
  'gb2312', 
  'gbk',
  'gb18030',
  'big5',
  'big5-hkscs',
  'shift-jis',
  'euc-jp',
  'euc-kr',
  'iso-2022-jp',
  'iso-2022-kr',
  'iso-8859-1',
  'iso-8859-2',
  'iso-8859-3',
  'iso-8859-4',
  'iso-8859-5',
  'iso-8859-6',
  'iso-8859-7',
  'iso-8859-8',
  'iso-8859-9',
  'iso-8859-10',
  'iso-8859-13',
  'iso-8859-14',
  'iso-8859-15',
  'iso-8859-16',
  'windows-1250',
  'windows-1251',
  'windows-1252',
  'windows-1253',
  'windows-1254',
  'windows-1255',
  'windows-1256',
  'windows-1257',
  'windows-1258'
];

// 文件扩展名与默认编码映射
const FILE_EXTENSION_ENCODING_MAP: Record<string, string> = {
  // 纯文本文件
  'txt': 'utf8',
  'md': 'utf8',
  'json': 'utf8',
  'yml': 'utf8',
  'yaml': 'utf8',
  'xml': 'utf8',
  'csv': 'utf8',
  'ini': 'utf8',
  'conf': 'utf8',
  'config': 'utf8',
  'log': 'utf8',
  
  // 代码文件
  'js': 'utf8',
  'ts': 'utf8',
  'jsx': 'utf8',
  'tsx': 'utf8',
  'html': 'utf8',
  'htm': 'utf8',
  'css': 'utf8',
  'scss': 'utf8',
  'less': 'utf8',
  'py': 'utf8',
  'java': 'utf8',
  'php': 'utf8',
  'rb': 'utf8',
  'go': 'utf8',
  'c': 'utf8',
  'cpp': 'utf8',
  'h': 'utf8',
  'hpp': 'utf8',
  'cs': 'utf8',
  'sql': 'utf8',
  'sh': 'utf8',
  'bat': 'utf8',
  'ps1': 'utf8',
  
  // 东亚语言默认编码
  'gb': 'gb2312',
  'gbk': 'gbk',
  'big5': 'big5',
  'sjis': 'shift-jis',
  'euc': 'euc-jp'
};

// 编码匹配映射（jschardet检测编码到Node支持编码的映射）
const ENCODING_MAPPING: Record<string, string> = {
  'UTF-8': 'utf8',
  'UTF-16LE': 'utf16le',
  'ASCII': 'ascii',
  'GB2312': 'gb2312',
  'GBK': 'gbk',
  'GB18030': 'gb18030',
  'Big5': 'big5',
  'SHIFT_JIS': 'shift-jis',
  'EUC-JP': 'euc-jp',
  'EUC-KR': 'euc-kr',
  'ISO-8859-1': 'latin1',
  'ISO-8859-2': 'iso-8859-2',
  'ISO-8859-5': 'iso-8859-5',
  'ISO-8859-6': 'iso-8859-6',
  'ISO-8859-7': 'iso-8859-7',
  'ISO-8859-8': 'iso-8859-8',
  'ISO-8859-9': 'iso-8859-9',
  'windows-1250': 'windows-1250',
  'windows-1251': 'windows-1251',
  'windows-1252': 'windows-1252',
  'windows-1253': 'windows-1253',
  'windows-1254': 'windows-1254',
  'windows-1255': 'windows-1255',
  'windows-1256': 'windows-1256'
};

// 编码检测结果接口
export interface EncodingDetectionResult {
  /**
   * 检测到的编码名称
   */
  encoding: string;
  /**
   * 检测的可信度 (0-1)
   */
  confidence: number;
  /**
   * 是否为确定的结果
   */
  certain: boolean;
}

/**
 * 编码管理器类
 * 
 * 用于管理文件编码、存储编码偏好、以及检测文件编码
 */
class EncodingManager {
  // 用户记忆的文件编码偏好
  private rememberedEncodings: Record<string, string> = {};
  
  constructor() {
    this.loadRememberedEncodings();
  }
  
  /**
   * 从存储中加载用户记忆的编码偏好
   */
  private loadRememberedEncodings(): void {
    try {
      // 由于移除了store导入，这里使用localStorage代替
      const savedEncodingsStr = localStorage.getItem('fileEncodings');
      const savedEncodings = savedEncodingsStr ? JSON.parse(savedEncodingsStr) : {};
      this.rememberedEncodings = savedEncodings;
    } catch (error) {
      console.error('加载编码偏好失败:', error);
      this.rememberedEncodings = {};
    }
  }
  
  /**
   * 保存编码偏好到存储
   */
  private saveRememberedEncodings(): void {
    try {
      // 由于移除了store导入，这里使用localStorage代替
      localStorage.setItem('fileEncodings', JSON.stringify(this.rememberedEncodings));
    } catch (error) {
      console.error('保存编码偏好失败:', error);
    }
  }
  
  /**
   * 记住特定文件的编码
   * @param filePath 文件路径
   * @param encoding 编码
   */
  rememberEncoding(filePath: string, encoding: string): void {
    if (!filePath) return;
    
    this.rememberedEncodings[filePath] = encoding;
    this.saveRememberedEncodings();
  }
  
  /**
   * 获取特定文件记忆的编码
   * @param filePath 文件路径
   * @returns 记忆的编码或undefined
   */
  getRememberedEncoding(filePath: string): string | undefined {
    if (!filePath) return undefined;
    return this.rememberedEncodings[filePath];
  }
  
  /**
   * 根据文件扩展名获取推荐编码
   * @param filePath 文件路径
   * @returns 推荐的编码
   */
  getRecommendedEncoding(filePath: string): string {
    if (!filePath) return 'utf8';
    
    const extension = filePath.split('.').pop()?.toLowerCase();
    if (extension && FILE_EXTENSION_ENCODING_MAP[extension]) {
      return FILE_EXTENSION_ENCODING_MAP[extension];
    }
    
    return 'utf8';  // 默认返回UTF-8
  }
  
  /**
   * 获取所有支持的编码列表
   * @returns 支持的编码列表
   */
  getSupportedEncodings(): string[] {
    return ALL_ENCODINGS;
  }
  
  /**
   * 获取常用编码列表
   * @returns 常用编码列表
   */
  getCommonEncodings(): string[] {
    return COMMON_ENCODINGS;
  }
  
  /**
   * 检测内容的编码
   * @param buffer 要检测的Buffer
   * @returns 检测结果
   */
  detectEncoding(buffer: Buffer): EncodingDetectionResult {
    // 使用jschardet进行编码检测
    try {
      const result = convertCharset.detect(buffer);
      const detectedEncoding = result.encoding;
      
      // 将检测到的编码映射到Node.js支持的编码
      let mappedEncoding = ENCODING_MAPPING[detectedEncoding] || detectedEncoding.toLowerCase();
      
      // 不支持的编码默认使用utf8
      if (!ALL_ENCODINGS.includes(mappedEncoding)) {
        mappedEncoding = 'utf8';
      }
      
      return {
        encoding: mappedEncoding,
        confidence: result.confidence,
        certain: result.confidence > 0.8  // 大于80%的置信度认为是确定的
      };
    } catch (error) {
      console.error('编码检测失败:', error);
      return {
        encoding: 'utf8',
        confidence: 0,
        certain: false
      };
    }
  }
  
  /**
   * 获取特定文件的最佳编码
   * 依次检查：用户记忆的编码 -> 文件检测的编码 -> 文件扩展名推荐编码
   * 
   * @param filePath 文件路径
   * @param fileContent 文件内容 (可选，用于检测)
   * @returns 最佳编码
   */
  getBestEncoding(filePath: string, fileContent?: Buffer): string {
    // 1. 检查用户记忆的编码
    const remembered = this.getRememberedEncoding(filePath);
    if (remembered) return remembered;
    
    // 2. 如果提供了文件内容，尝试检测
    if (fileContent) {
      const detected = this.detectEncoding(fileContent);
      if (detected.certain) return detected.encoding;
    }
    
    // 3. 使用文件扩展名推荐编码
    return this.getRecommendedEncoding(filePath);
  }
}

// 导出编码管理器单例
export const encodingManager = new EncodingManager();
export default encodingManager; 