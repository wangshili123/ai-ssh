/**
 * CPU相关类型定义
 */

// CPU基本信息
export interface CPUInfo {
  model: string;          // CPU型号
  cores: number;          // 核心数
  threads: number;        // 线程数
  frequency: {
    current: number;      // 当前频率(MHz)
    min: number;         // 最小频率(MHz)
    max: number;         // 最大频率(MHz)
  };
  cache: {
    l1d: number;         // L1数据缓存(KB)
    l1i: number;         // L1指令缓存(KB)
    l2: number;          // L2缓存(KB)
    l3: number;          // L3缓存(KB)
  };
}

// CPU使用率
export interface CPUUsage {
  total: number;          // 总使用率(%)
  user: number;          // 用户空间使用率(%)
  system: number;        // 系统空间使用率(%)
  idle: number;          // 空闲率(%)
  iowait: number;        // IO等待率(%)
  perCore: number[];     // 每个核心的使用率(%)
}

// CPU负载
export interface CPULoad {
  last1min: number;      // 1分钟负载
  last5min: number;      // 5分钟负载
  last15min: number;     // 15分钟负载
}

/**
 * 内存相关类型定义
 */

// 内存使用情况
export interface SystemMemoryInfo {
  total: number;          // 总内存(KB)
  used: number;          // 已使用内存(KB)
  free: number;          // 空闲内存(KB)
  shared: number;        // 共享内存(KB)
  buffers: number;       // 缓冲区(KB)
  cached: number;        // 缓存(KB)
  available: number;     // 可用内存(KB)
  swapTotal: number;     // 交换空间总量(KB)
  swapUsed: number;      // 已使用交换空间(KB)
  swapFree: number;      // 空闲交换空间(KB)
}

// 内存详细统计
export interface MemoryStats {
  activeAnon: number;    // 活跃匿名页面(KB)
  inactiveAnon: number;  // 不活跃匿名页面(KB)
  activeFile: number;    // 活跃文件页面(KB)
  inactiveFile: number;  // 不活跃文件页面(KB)
  unevictable: number;   // 不可回收内存(KB)
  mlocked: number;       // 锁定内存(KB)
  dirty: number;         // 脏页面(KB)
  writeback: number;     // 回写页面(KB)
  slab: number;          // 内核数据结构缓存(KB)
  kernelStack: number;   // 内核栈(KB)
  pageTables: number;    // 页表(KB)
}

// 虚拟内存统计
export interface VMStats {
  reads: number;         // 换入(KB/s)
  writes: number;        // 换出(KB/s)
}

/**
 * 监控数据时间序列
 */
export interface TimeSeriesData {
  timestamp: number;
  value: number;
}

/**
 * 监控数据刷新选项
 */
export interface RefreshOptions {
  interval: number;      // 刷新间隔(ms)
  enabled: boolean;      // 是否启用自动刷新
}

export interface LegacyCPUInfo {
  model: string;
  speed: number;
  cores: number;
  physicalCores: number;
}

export interface LegacyMemoryInfo {
  total: number;
  free: number;
  used: number;
  active: number;
  available: number;
  buffers: number;
  cached: number;
  slab: number;
  swapTotal: number;
  swapUsed: number;
  swapFree: number;
} 