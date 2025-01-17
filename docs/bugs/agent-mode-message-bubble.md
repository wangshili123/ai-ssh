# Agent模式消息气泡显示问题

## 问题描述
在Agent模式下，当用户发起第二次提问时，没有产生新的对话气泡。

## 期望行为
1. 用户发起提问 -> 产生一对新的对话气泡（用户问题 + AI回复）
2. 用户执行命令 -> AI的分析和后续命令会追加到当前的AI回复气泡中
3. 用户再次发起新的提问 -> 产生新的一对对话气泡

## 当前行为
1. 用户第一次提问正常显示对话气泡
2. 命令执行后的分析正常追加到当前气泡
3. 用户第二次提问时没有产生新的对话气泡

## 问题分析
问题出在 `agentModeService` 中判断是否创建新任务的逻辑：
```typescript
if (!this.currentTask || this.getState() === AgentState.IDLE) {
  // 创建新任务...
}
```

当前逻辑只在以下情况创建新任务：
1. 没有当前任务
2. 当前状态为 IDLE

但实际上，我们需要在用户主动发起新提问时就创建新任务，而不是继续使用当前任务。

## 修复方案

### 步骤1: 区分用户主动提问和命令执行反馈
1. 在 `AgentModeService` 接口中添加标识：
```typescript
interface AgentModeService {
  // ... 现有方法 ...
  getNextStep(input: string, isNewUserQuery: boolean): Promise<void>;
}
```

2. 在调用处传入正确的标识：
- AIAssistant 组件中用户发送消息时传入 `true`
- 命令执行完成后的自动反馈传入 `false`

### 步骤2: 修改创建新任务的逻辑
在 `getNextStep` 方法中根据 `isNewUserQuery` 决定是否创建新任务：
```typescript
if (isNewUserQuery) {
  // 创建新任务...
} else {
  // 继续当前任务...
}
```

### 步骤3: 测试用例
1. 用户发起首次提问
   - 期望：创建新任务，显示新对话气泡
2. 执行命令后的反馈
   - 期望：继续当前任务，追加到当前气泡
3. 用户发起第二次提问
   - 期望：创建新任务，显示新对话气泡
4. 多轮对话测试
   - 期望：每次用户主动提问都有新气泡，命令执行反馈都追加到当前气泡

## 修复进度
- [x] 步骤1: 添加区分标识
  - [x] 在 AgentModeService 接口中添加 isNewUserQuery 参数
  - [x] 修改 getNextStep 方法实现
  - [x] 在 AIAssistant 组件中传入正确的参数
- [x] 步骤2: 修改任务创建逻辑
  - [x] 添加 messageHistory 数组存储历史消息
  - [x] 修改 AgentModeService 接口添加 getAllMessages 方法
  - [x] 修改 AgentMode 组件显示所有历史消息
  - [x] 修改组件类型定义以支持历史消息显示
- [ ] 步骤3: 进行测试验证

## 修改记录
### 2024-01-17
1. 在 `AgentModeService` 接口中添加了 `isNewUserQuery` 参数
2. 修改了 `getNextStep` 方法的实现，根据 `isNewUserQuery` 参数决定是否创建新任务
3. 在 `AIAssistant` 组件中调用 `getNextStep` 时传入 `true` 表示这是新的用户查询
4. 添加了 `messageHistory` 数组来存储所有历史消息
5. 修改了 `AgentMode` 组件以显示所有历史消息
6. 修改了相关组件的类型定义以支持可选的回调函数 