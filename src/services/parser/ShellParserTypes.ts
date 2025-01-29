/**
 * Shell解析器类型定义
 */
export namespace ShellParserTypes {
  /**
   * 重定向定义
   */
  export interface Redirect {
    type: string;      // 重定向类型 (>, >>, <, etc.)
    target: string;    // 重定向目标
  }

  /**
   * 命令定义
   */
  export interface Command {
    name: string;      // 命令名称
    args: string[];    // 命令参数
    options: string[]; // 命令选项
    redirects: Redirect[]; // 重定向
  }

  /**
   * 解析结果类型
   */
  export type ParseResult = 
    | { type: 'program'; commands: Command[] }
    | { type: 'command'; name: string; args: string[]; options: string[]; redirects: Redirect[] }
    | { type: 'pipeline'; commands: Command[] }
    | { type: 'error'; error: string }
    | { type: 'unknown'; raw: string };
} 