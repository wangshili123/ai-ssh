/**
 * Agent 响应的状态
 */
export enum AgentResponseStatus {
  THINKING = 'thinking',    // 思考中
  WAITING = 'waiting',      // 等待用户确认
  EXECUTING = 'executing',  // 执行中
  COMPLETED = 'completed'   // 完成
}

/**
 * Agent 的响应内容
 */
export interface AgentResponse {
  status: AgentResponseStatus;
  message: string;
  command?: string;         // 待执行的命令
  result?: string;          // 执行结果
  error?: string;           // 错误信息
}

/**
 * Agent 服务接口
 */
export interface AgentService {
  // 发送用户消息给 Agent
  sendMessage: (message: string) => Promise<AgentResponse>;
  
  // 执行命令并返回结果
  executeCommand: (command: string) => Promise<string>;
} 