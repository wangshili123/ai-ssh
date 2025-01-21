/**
 * IPC响应结果接口
 */
export interface Result<T = void> {
  success: boolean;
  data?: T;
  error?: string;
} 