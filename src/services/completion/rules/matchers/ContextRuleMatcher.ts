import { RuleMatcher } from './RuleMatcher';
import { CompletionRule } from '../../learning/analyzer/optimizer/types/rule-optimizer.types';
import { EnhancedContext } from '../../core/types/context.types';

/**
 * 上下文规则匹配器
 * 负责匹配与上下文相关的规则
 */
export class ContextRuleMatcher extends RuleMatcher {
  /**
   * 匹配上下文规则
   */
  match(
    rule: CompletionRule,
    input: string,
    context: EnhancedContext
  ): number {
    if (rule.type !== 'context') {
      return 0;
    }

    // 计算各个上下文因素的匹配分数
    const directoryScore = this.matchDirectory(rule, context);
    const historyScore = this.matchHistory(rule, context);
    const environmentScore = this.matchEnvironment(rule, context);

    // 综合评分（根据重要性加权）
    return (
      directoryScore * 0.4 +
      historyScore * 0.4 +
      environmentScore * 0.2
    );
  }

  /**
   * 匹配目录上下文
   */
  private matchDirectory(
    rule: CompletionRule,
    context: EnhancedContext
  ): number {
    const currentDir = context.currentDirectory;
    if (!currentDir) {
      return 0;
    }

    // 检查规则是否包含目录相关的模式
    if (rule.pattern.includes('${PWD}') || rule.pattern.includes('${DIR}')) {
      // 如果规则明确指定了目录模式，进行精确匹配
      const pattern = rule.pattern
        .replace(/\${PWD}/g, currentDir)
        .replace(/\${DIR}/g, currentDir);
      return this.calculateStringSimilarity(currentDir, pattern);
    }

    // 否则进行基本的目录类型匹配
    const isGitDir = currentDir.includes('.git');
    const isNodeDir = currentDir.includes('node_modules') || currentDir.includes('package.json');
    const isPythonDir = currentDir.includes('venv') || currentDir.includes('__pycache__');
    const isRustDir = currentDir.includes('Cargo.toml');
    const isGoDir = currentDir.includes('go.mod');

    // 根据目录特征匹配规则
    if (
      (isGitDir && rule.pattern.includes('git')) ||
      (isNodeDir && (rule.pattern.includes('npm') || rule.pattern.includes('node'))) ||
      (isPythonDir && (rule.pattern.includes('pip') || rule.pattern.includes('python'))) ||
      (isRustDir && rule.pattern.includes('cargo')) ||
      (isGoDir && rule.pattern.includes('go'))
    ) {
      return 0.7;
    }

    return 0.3;
  }

  /**
   * 匹配命令历史上下文
   */
  private matchHistory(
    rule: CompletionRule,
    context: EnhancedContext
  ): number {
    if (!context.commandHistory?.recent) {
      return 0;
    }

    const recentCommands = context.commandHistory.recent;
    
    // 检查最近的命令是否与规则相关
    for (const cmd of recentCommands) {
      if (rule.pattern.includes(cmd.command)) {
        // 根据命令的时间衰减评分
        const age = Date.now() - new Date(cmd.timestamp).getTime();
        const ageScore = Math.max(0, 1 - age / (24 * 60 * 60 * 1000)); // 24小时衰减
        return 0.8 * ageScore;
      }
    }

    // 检查命令使用频率
    const statistics = context.commandHistory.statistics;
    for (const stat of statistics) {
      if (rule.pattern.includes(stat.command)) {
        // 根据使用频率评分
        return Math.min(0.7, stat.frequency / 10); // 最高0.7分
      }
    }

    return 0;
  }

  /**
   * 匹配环境变量上下文
   */
  private matchEnvironment(
    rule: CompletionRule,
    context: EnhancedContext
  ): number {
    if (!context.environmentVars) {
      return 0;
    }

    // 检查规则中的环境变量引用
    const envVarMatches = rule.pattern.match(/\${([^}]+)}/g);
    if (!envVarMatches) {
      return 0;
    }

    let totalScore = 0;
    let matchCount = 0;

    // 检查每个环境变量
    for (const match of envVarMatches) {
      const varName = match.slice(2, -1);
      if (context.environmentVars[varName]) {
        totalScore += 1;
        matchCount++;
      }
    }

    return matchCount > 0 ? totalScore / matchCount : 0;
  }
} 