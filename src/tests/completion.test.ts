import { CompletionService } from '../services/completion/CompletionService';
import { CommandHistory } from '../services/database/models/CommandHistory';
import { DatabaseService } from '../services/database/DatabaseService';

describe('Command Completion Tests', () => {
  let completionService: CompletionService;
  let commandHistory: CommandHistory;

  beforeAll(async () => {
    // 初始化数据库
    await DatabaseService.getInstance().init();
    
    // 初始化测试数据
    commandHistory = new CommandHistory();
    const testCommands = [
      "ls -l",
      "git status",
      "git commit -m 'test'",
      "ps -ef | grep node",
      "npm install typescript"
    ];

    for (const cmd of testCommands) {
      await commandHistory.addOrUpdate(cmd);
    }

    // 等待补全服务初始化完成
    completionService = await CompletionService.getInstance();
  });

  test('should get suggestion for partial input', async () => {
    const input = 'git s';
    const suggestion = await completionService.getSuggestion(input);
    
    expect(suggestion).not.toBeNull();
    expect(suggestion?.fullCommand).toBe('git status');
  });

  test('should handle empty input', async () => {
    const input = '';
    const suggestion = await completionService.getSuggestion(input);
    
    expect(suggestion).toBeNull();
  });

  test('should accept suggestion', async () => {
    // 先获取建议
    const input = 'git c';
    await completionService.getSuggestion(input);
    
    // 接受建议
    const accepted = completionService.acceptSuggestion();
    expect(accepted).toBe("git commit -m 'test'");
  });

  test('should clear suggestion on new input', async () => {
    // 先获取建议
    const input = 'npm';
    await completionService.getSuggestion(input);
    
    // 清除建议
    completionService.clearSuggestion();
    const accepted = completionService.acceptSuggestion();
    expect(accepted).toBeNull();
  });

  test('should record command execution', async () => {
    const command = 'git push origin main';
    await completionService.recordCommand(command);
    
    // 验证命令是否被记录
    const suggestion = await completionService.getSuggestion('git p');
    expect(suggestion?.fullCommand).toBe(command);
  });

  test('should handle command relations', async () => {
    // 记录两个相关命令
    await completionService.recordCommand('git add .');
    await completionService.recordCommand('git commit -m "test"');
    
    // 验证关系是否建立
    const suggestion = await completionService.getSuggestion('git c');
    expect(suggestion?.fullCommand).toBe('git commit -m "test"');
  });
}); 