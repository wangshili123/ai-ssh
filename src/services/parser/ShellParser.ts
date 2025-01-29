import Parser, { SyntaxNode } from 'web-tree-sitter/tree-sitter';
import { ShellParserTypes } from './ShellParserTypes';

// 设置 WASM 文件路径
const wasmBindings = {
  mainPath: process.env.TREE_SITTER_WASM_PATH || '/wasm/tree-sitter.wasm',
  bashPath: '/wasm/tree-sitter-bash.wasm'
};

/**
 * Shell命令解析器
 * 使用tree-sitter进行语法分析
 */
export class ShellParser {
  private parser?: Parser;
  private static instance: ShellParser;
  private initialized: boolean = false;

  private constructor() {
    console.log('ShellParser 构造函数开始执行');
    try {
      console.log('导入的 Parser 对象:', Parser);
      console.log('Parser.init 是否存在:', !!Parser.init);
      console.log('WASM 文件路径配置:', wasmBindings);
      this.initializeAsync().catch(error => {
        console.error('初始化过程中的异步错误:', error);
        if (error instanceof Error) {
          console.error('错误名称:', error.name);
          console.error('错误消息:', error.message);
          console.error('错误堆栈:', error.stack);
        } else {
          console.error('未知类型错误:', error);
        }
      });
    } catch (error) {
      console.error('ShellParser 构造函数同步错误:', error);
      throw error;
    }
    console.log('ShellParser 构造函数执行完成');
  }

  /**
   * 初始化解析器
   */
  private async initializeAsync() {
    console.log('initializeAsync 开始执行');
    try {
      console.log('准备初始化 Parser...');

      // 初始化 Parser
      console.log('开始初始化 Parser...');
      try {
        await Parser.init({
          locateFile(path: string, prefix: string) {
            console.log('locateFile 被调用:', { path, prefix });
            if (path === 'tree-sitter.wasm') {
              const wasmPath = wasmBindings.mainPath;
              console.log('返回 WASM 路径:', wasmPath);
              return wasmPath;
            }
            return prefix + path;
          }
        });
        console.log('Parser 初始化成功');
      } catch (initError) {
        console.error('Parser 初始化失败:', initError);
        throw initError;
      }
      
      this.parser = new Parser();
      
      // 加载 bash 语言模块
      console.log('开始加载 bash 语言模块...');
      console.log('尝试从路径加载 bash WASM:', wasmBindings.bashPath);
      
      let bashWasmBuffer: ArrayBuffer;
      
      try {
        const response = await fetch(wasmBindings.bashPath);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        bashWasmBuffer = await response.arrayBuffer();
        console.log('bash WASM 文件加载成功, 大小:', bashWasmBuffer.byteLength, '字节');
      } catch (loadError) {
        console.error('加载 bash WASM 文件失败:', loadError);
        throw loadError;
      }
      
      try {
        const Lang = await Parser.Language.load(new Uint8Array(bashWasmBuffer));
        console.log('bash 语言模块加载成功');
        this.parser.setLanguage(Lang);
        console.log('语言设置成功');
      } catch (langError) {
        console.error('加载语言模块失败:', langError);
        throw langError;
      }
      
      this.initialized = true;
      console.log('Shell解析器初始化完成');
    } catch (error: any) {
      console.error('初始化Shell解析器失败，详细错误:', error);
      console.error('错误堆栈:', error.stack);
      throw error;
    }
  }

  /**
   * 获取解析器实例
   */
  public static getInstance(): ShellParser {
    if (!ShellParser.instance) {
      ShellParser.instance = new ShellParser();
    }
    return ShellParser.instance;
  }

  /**
   * 检查是否已初始化
   */
  private checkInitialized() {
    if (!this.initialized || !this.parser) {
      throw new Error('Shell解析器未初始化');
    }
  }

  /**
   * 解析命令
   * @param command 要解析的命令
   * @returns 解析结果
   */
  public async parse(command: string): Promise<ShellParserTypes.ParseResult> {
    try {
      this.checkInitialized();
      const tree = this.parser!.parse(command);
      return this.processNode(tree.rootNode);
    } catch (error) {
      console.error('命令解析失败:', error);
      return {
        type: 'error',
        error: error instanceof Error ? error.message : '解析失败'
      };
    }
  }

  /**
   * 处理语法树节点
   */
  private processNode(node: SyntaxNode): ShellParserTypes.ParseResult {
    switch (node.type) {
      case 'program':
        return this.processProgram(node);
      case 'command':
        return this.processCommand(node);
      case 'pipeline':
        return this.processPipeline(node);
      default:
        return {
          type: 'unknown',
          raw: node.text
        };
    }
  }

  /**
   * 处理程序节点
   */
  private processProgram(node: SyntaxNode): ShellParserTypes.ParseResult {
    const commands: ShellParserTypes.Command[] = [];
    
    for (const child of node.children) {
      if (child.type === 'command') {
        const result = this.processCommand(child);
        if (result.type === 'command') {
          commands.push(result);
        }
      }
    }

    return {
      type: 'program',
      commands
    };
  }

  /**
   * 处理命令节点
   */
  private processCommand(node: SyntaxNode): ShellParserTypes.ParseResult {
    const command: ShellParserTypes.Command = {
      name: '',
      args: [],
      options: [],
      redirects: []
    };

    for (const child of node.children) {
      switch (child.type) {
        case 'command_name':
          command.name = child.text;
          break;
        case 'argument':
          command.args.push(child.text);
          break;
        case 'option':
          command.options.push(child.text);
          break;
        case 'redirect':
          command.redirects.push({
            type: child.firstChild?.type || 'unknown',
            target: child.lastChild?.text || ''
          });
          break;
      }
    }

    return {
      type: 'command',
      ...command
    };
  }

  /**
   * 处理管道节点
   */
  private processPipeline(node: SyntaxNode): ShellParserTypes.ParseResult {
    const commands: ShellParserTypes.Command[] = [];

    for (const child of node.children) {
      if (child.type === 'command') {
        const result = this.processCommand(child);
        if (result.type === 'command') {
          commands.push(result);
        }
      }
    }

    return {
      type: 'pipeline',
      commands
    };
  }
} 