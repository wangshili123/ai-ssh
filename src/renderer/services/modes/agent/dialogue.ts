import { TerminalHistory } from '@/renderer/services/terminalOutput';

/**
 * 对话历史记录类型
 */
export interface DialogueHistory {
  role: 'system' | 'user';
  content: string;
}

/**
 * 对话历史管理类
 */
export class DialogueManager {
  private readonly MAX_HISTORY_LENGTH = 10;    // 最多保存10条对话历史
  private readonly MAX_OUTPUT_LENGTH = 500;    // 每条输出最多500字符
  private readonly MAX_OUTPUT_LINES = 50;      // 每条输出最多50行

  private dialogueHistory: DialogueHistory[] = [];
  private currentUserContent: string = '';     // 当前用户问题的累积内容

  /**
   * 构造函数
   * @param systemPrompt 系统提示语
   */
  constructor(systemPrompt: string) {
    // 初始化对话历史，添加系统提示语
    this.dialogueHistory = [
      { role: 'system', content: systemPrompt }
    ];
  }

  /**
   * 添加或更新对话历史
   * @param content 对话内容
   * @param isNewUserQuery 是否是新的用户查询
   */
  public addDialogue(content: string, isNewUserQuery: boolean): void {
    if (isNewUserQuery) {
      // 如果是新的用户查询，创建新的用户消息，只包含问题本身
      this.currentUserContent = `新问题：${content}`;
      const newMessage: DialogueHistory = {
        role: 'user',
        content: this.currentUserContent
      };

      // 添加到历史记录
      this.dialogueHistory.push(newMessage);

      // 如果超出限制，删除最早的用户消息
      while (this.dialogueHistory.length > this.MAX_HISTORY_LENGTH + 1) { // +1 是因为要保留 system 消息
        const systemMessageIndex = this.dialogueHistory.findIndex(m => m.role === 'system');
        if (systemMessageIndex === 0) {
          this.dialogueHistory.splice(1, 1); // 删除系统消息后的第一条消息
        } else {
          this.dialogueHistory.splice(0, 1); // 删除第一条消息
        }
      }
    } else {
      // 如果不是新的用户查询，更新当前用户消息的内容
      this.currentUserContent += '\n\n' + content;
      
      // 更新最后一条用户消息
      const lastMessage = this.dialogueHistory[this.dialogueHistory.length - 1];
      if (lastMessage && lastMessage.role === 'user') {
        lastMessage.content = this.currentUserContent;
      }
    }
  }

  /**
   * 格式化当前状态为对话内容
   * @param input 用户输入
   * @param history 终端历史记录
   * @param isNewUserQuery 是否是新的用户查询
   */
  public formatCurrentState(input: string, history: TerminalHistory[], isNewUserQuery: boolean): string {
    if (isNewUserQuery) {
      // 如果是新的用户查询，只返回问题本身
      return input;
    }

    let content = '';
    
    // 如果有命令执行历史，添加到内容中
    if (history.length > 0) {
      // 只处理最后一条命令的输出
      const lastHistory = history[history.length - 1];
      console.log('input', input);
      // 1. 先添加继续执行的内容
      content = `n执行情况：${input}\n`;
      
      // 2. 添加命令执行情况
      content += '\n执行情况：\n';
      content += `${lastHistory.command || ''}\n`;
      
      // 3. 处理输出内容
      let output = lastHistory.output || '';
      if (output) {
        // 移除 ANSI 颜色代码
        output = output.replace(/\x1B\[[0-9;]*[JKmsu]/g, '');
        
        // 移除重复空行和首尾空白
        output = output.trim().replace(/\n\s*\n/g, '\n');
        
        // 按行分割并过滤空行
        let lines = output.split('\n').filter(line => line.trim());
        
        // 限制总行数（保留最新的行）
        if (lines.length > this.MAX_OUTPUT_LINES) {
          const omittedLines = lines.length - this.MAX_OUTPUT_LINES;
          lines = [
            `...(省略前 ${omittedLines} 行)...`,
            ...lines.slice(-this.MAX_OUTPUT_LINES)
          ];
        }
        
        // 对每行进行长度限制（保留每行最新的内容）
        lines = lines.map(line => {
          const trimmedLine = line.trim();
          if (trimmedLine.length > this.MAX_OUTPUT_LENGTH) {
            const omittedLength = trimmedLine.length - this.MAX_OUTPUT_LENGTH;
            return `...(省略前 ${omittedLength} 字符)...${trimmedLine.slice(-this.MAX_OUTPUT_LENGTH)}`;
          }
          return trimmedLine;
        });
        
        content += lines.join('\n');
      }
    } else {
      // 如果没有历史记录，只添加继续执行的内容
      content = `继续执行：${input}`;
    }

    return content;
  }

  /**
   * 获取当前对话历史
   */
  public getDialogueHistory(): DialogueHistory[] {
    return this.dialogueHistory;
  }

  /**
   * 清空对话历史（保留系统提示语）
   */
  public clearHistory(): void {
    const systemMessage = this.dialogueHistory.find(m => m.role === 'system');
    if (systemMessage) {
      this.dialogueHistory = [systemMessage];
      this.currentUserContent = '';
    }
  }
} 