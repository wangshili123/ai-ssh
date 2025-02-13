export interface CpuInfo {
  usage: number;           // CPU总体使用率
  cores: number[];        // 每个核心的使用率
  model: string;          // CPU型号
  speed: number;          // 基准频率 (MHz)
  maxSpeed?: number;      // 最大频率 (MHz)
  minSpeed?: number;      // 最小频率 (MHz)
  currentSpeed?: number;  // 当前频率 (MHz)
  physicalCores: number;  // 物理核心数
  logicalCores: number;   // 逻辑处理器数
  cache: {
    l1?: number;         // L1缓存大小 (KB)
    l2?: number;         // L2缓存大小 (KB)
    l3?: number;         // L3缓存大小 (KB)
  };
  temperature?: number;   // CPU温度 (°C)
  architecture?: string;  // CPU架构
  vendor?: string;       // 制造商
  socket?: string;       // CPU插槽
  virtualization?: boolean; // 是否支持虚拟化
  usageHistory: Array<{   // CPU使用率历史记录
    timestamp: number;    // 时间戳
    usage: number;       // 使用率
    speed?: number;      // 频率
  }>;
  coreUsageHistory: Array<Array<{  // 每个核心的使用率历史记录
    timestamp: number;
    usage: number;
    speed?: number;
  }>>;
}

export interface MemoryInfo {
  // 基础内存信息
  total: number;        // 总内存(bytes)
  used: number;        // 已使用(bytes)
  free: number;        // 空闲内存(bytes)
  cached: number;      // 缓存大小(bytes)
  buffers: number;     // 缓冲区大小(bytes)
  usagePercent: number; // 使用率(%)
  
  // 虚拟内存信息
  swap: {
    total: number;     // 交换空间总量(bytes)
    used: number;      // 已使用交换空间(bytes)
    free: number;      // 空闲交换空间(bytes)
    usagePercent: number; // 交换空间使用率(%)
  };
  
  // 内存占用TOP进程
  topProcesses: Array<{
    pid: number;       // 进程ID
    name: string;      // 进程名
    memoryUsed: number; // 内存使用量(bytes)
    memoryPercent: number; // 内存使用百分比(%)
  }>;
}

export interface DiskInfo {
  devices: Array<{
    device: string;
    mountpoint: string;
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  }>;
  total: number;
  used: number;
  free: number;
  usagePercent: number;
}

export interface NetworkInfo {
  interfaces: Array<{
    name: string;
    rx: number;
    tx: number;
    rxSpeed: number;
    txSpeed: number;
  }>;
  totalRx: number;
  totalTx: number;
  rxSpeed: number;
  txSpeed: number;
}

export interface MonitorData {
  cpu: CpuInfo;
  memory: MemoryInfo;
  disk: DiskInfo;
  network: NetworkInfo;
  timestamp: number;
} 