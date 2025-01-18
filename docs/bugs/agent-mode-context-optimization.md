# Agent 模式上下文优化方案

## 一、代码位置
主要修改文件：`src/renderer/services/modes/agent/index.ts`

## 二、具体实现方案

### 1. 添加配置常量和类型定义
```typescript
// 在 AgentModeServiceImpl 类中添加
private readonly MAX_HISTORY_LENGTH = 10;    // 最多保存10条对话历史
private readonly MAX_OUTPUT_LENGTH = 500;    // 每条输出最多500字符
private readonly MAX_OUTPUT_LINES = 50;      // 每条输出最多50行

// 对话历史类型
interface DialogueHistory {
  role: 'system' | 'user';
  content: string;
}

// 在类中添加对话历史数组
private dialogueHistory: DialogueHistory[] = [
  { role: 'system', content: systemPrompt }
];
```

### 2. 添加对话历史管理方法
```typescript
/**
 * 添加新的对话历史
 * 1. 保持最多 MAX_HISTORY_LENGTH 条记录
 * 2. 超出限制时删除最早的用户消息
 * 3. 始终保留 system 消息
 */
private addDialogueHistory(content: string) {
  // 创建新的用户消息
  const newMessage: DialogueHistory = {
    role: 'user',
    content
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
}

/**
 * 格式化当前状态为对话内容
 */
private formatCurrentState(input: string, history: TerminalHistory[]): string {
  let content = `当前问题：${input}\n`;
  
  // 如果有命令执行历史，添加到内容中
  if (history.length > 0) {
    content += '\n执行情况：\n';
    content += history.map(h => {
      let output = h.output || '';
      
      // 处理输出内容
      if (output) {
        // 移除 ANSI 颜色代码
        output = output.replace(/\x1B\[[0-9;]*[JKmsu]/g, '');
        
        // 移除重复空行
        output = output.replace(/\n\s*\n/g, '\n');
        
        // 限制行数（保留最新的行）
        const lines = output.split('\n');
        if (lines.length > this.MAX_OUTPUT_LINES) {
          output = [
            `... (${lines.length - this.MAX_OUTPUT_LINES} earlier lines omitted) ...\n`,
            ...lines.slice(-this.MAX_OUTPUT_LINES) // 只保留最新的50行
          ].join('\n');
        }
        
        // 限制每行长度（保留每行最新的内容）
        output = output.split('\n')
          .map(line => {
            if (line.length > this.MAX_OUTPUT_LENGTH) {
              const omittedLength = line.length - this.MAX_OUTPUT_LENGTH;
              return [
                `... (${omittedLength} earlier characters omitted) ...`,
                line.slice(-this.MAX_OUTPUT_LENGTH) // 只保留最新的500字符
              ].join('');
            }
            return line;
          })
          .join('\n');
      }
      
      return `${h.command || ''}\n${output}`;
    }).join('\n');
  }

  return content;
}
```

### 3. 修改 getNextStep 方法中的上下文构建
```typescript
async getNextStep(input: string): Promise<void> {
  try {
    // ... 其他代码 ...

    // 格式化当前状态
    const currentState = this.formatCurrentState(input, history);
    
    // 添加到对话历史
    this.addDialogueHistory(currentState);

    const requestBody = {
      model: config.model,
      messages: this.dialogueHistory,
      temperature: config.temperature,
      max_tokens: config.maxTokens
    };

    // ... 其他代码 ...
  } catch (error) {
    // ... 错误处理 ...
  }
}
```

### 4. 添加空响应处理
```typescript
/**
 * 在 getNextStep 方法中添加空响应处理
 * 1. 检测空响应
 * 2. 更新状态
 * 3. 显示错误信息
 */
const content = data.choices[0]?.message?.content;
if (!content) {
  this.setState(AgentState.ERROR);
  this.updateMessageStatus(AgentResponseStatus.ERROR);
  this.appendContent({
    type: 'error',
    content: 'AI 响应为空，请重试',
    timestamp: Date.now()
  });
  return;
}
```

## 三、实现步骤

### 第一阶段：对话历史管理
- [ ] 1. 添加配置常量和类型定义
- [ ] 2. 实现对话历史管理方法
- [ ] 3. 实现当前状态格式化方法

### 第二阶段：集成对话历史
- [ ] 1. 修改 getNextStep 方法
- [ ] 2. 添加空响应处理
- [ ] 3. 测试对话历史维护

### 第三阶段：测试和调优
- [ ] 1. 测试对话历史限制
- [ ] 2. 测试输出格式化
- [ ] 3. 测试空响应处理
- [ ] 4. 根据测试结果调整参数

## 四、注意事项
1. 修改时注意保持现有功能的稳定性
2. 每个修改点完成后进行充分测试
3. 参数值可以根据实际使用情况调整
4. 确保错误处理和状态更新的准确性
5. 保持代码的可维护性和可读性 