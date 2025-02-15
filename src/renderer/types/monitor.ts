// CPU相关接口
export interface CpuBasicInfo {
  usage: number;           // CPU总体使用率
  temperature?: string | 'not_installed';    // CPU温度 (°C) 或未安装状态
  speed: number;          // 基准频率 (MHz)
  currentSpeed?: number;   // 当前频率 (MHz)
}

export interface CpuDetailInfo extends CpuBasicInfo {
  cores: number[];        // 每个核心的使用率
  model: string;          // CPU型号
  maxSpeed?: number;      // 最大频率 (MHz)
  minSpeed?: number;      // 最小频率 (MHz)
  physicalCores: number;  // 物理核心数
  logicalCores: number;   // 逻辑处理器数
  cache: {
    l1?: number;         // L1缓存大小 (KB)
    l2?: number;         // L2缓存大小 (KB)
    l3?: number;         // L3缓存大小 (KB)
  };
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

// 内存相关接口
export interface MemoryBasicInfo {
  total: number;        // 总内存(bytes)
  used: number;        // 已使用(bytes)
  free: number;        // 空闲内存(bytes)
  usagePercent: number; // 使用率(%)
  cached: number;      // 缓存大小(bytes)
  buffers: number;     // 缓冲区大小(bytes)
  swap: {
    total: number;     // 交换空间总量(bytes)
    used: number;      // 已使用交换空间(bytes)
    free: number;      // 空闲交换空间(bytes)
    usagePercent: number; // 交换空间使用率(%)
  };
}

export interface MemoryDetailInfo extends MemoryBasicInfo {
  topProcesses: Array<{
    pid: number;       // 进程ID
    name: string;      // 进程名
    command: string;   // 完整命令行
    memoryUsed: number; // 内存使用量(bytes)
    memoryPercent: number; // 内存使用百分比(%)
  }>;
}

// 磁盘相关接口
export interface DiskBasicInfo {
  total: number;        // 总容量(bytes)
  used: number;         // 已使用(bytes)
  free: number;         // 可用空间(bytes)
  usagePercent: number; // 使用率(%)
  readSpeed: number;    // 读取速度(bytes/s)
  writeSpeed: number;   // 写入速度(bytes/s)
}

export interface DiskDetailInfo extends DiskBasicInfo {
  deviceStats: {
    [key: string]: {
      readSpeed: number;  // 设备读取速度(bytes/s)
      writeSpeed: number; // 设备写入速度(bytes/s)
    }
  };
  partitions: Array<{
    device: string;     // 设备名
    mountpoint: string; // 挂载点
    fstype: string;     // 文件系统类型
    diskType: string;   // 磁盘类型(SSD/HDD)
    total: number;      // 总容量(bytes)
    used: number;       // 已使用(bytes)
    free: number;       // 可用空间(bytes)
    usagePercent: number; // 使用率(%)
    readSpeed: number;  // 读取速度(bytes/s)
    writeSpeed: number; // 写入速度(bytes/s)
  }>;
  ioHistory: Array<{
    timestamp: number;  // 时间戳
    readSpeed: number;  // 读取速度
    writeSpeed: number; // 写入速度
  }>;
  health?: DiskHealth;
  spaceAnalysis?: DiskSpaceAnalysis;
  ioAnalysis?: DiskIoAnalysis;
}

// 网络相关接口
export interface NetworkBasicInfo {
  totalRx: number;
  totalTx: number;
  rxSpeed: number;
  txSpeed: number;
}

export interface NetworkDetailInfo extends NetworkBasicInfo {
  interfaces: Array<{
    name: string;
    rx: number;
    tx: number;
    rxSpeed: number;
    txSpeed: number;
  }>;
}

// 性能数据接口
export interface PerformanceBasicData {
  cpu: CpuBasicInfo;
  memory: MemoryBasicInfo;
  disk: DiskBasicInfo;
  network: NetworkBasicInfo;
}

export interface PerformanceDetailData extends PerformanceBasicData {
  cpu: CpuDetailInfo;
  memory: MemoryDetailInfo;
  disk: DiskDetailInfo;
  network: NetworkDetailInfo;
}

export interface PerformanceData {
  basic: PerformanceBasicData;
  detail?: Partial<PerformanceDetailData>;
}

export interface ProcessData {
  // TODO: 进程相关数据结构
}

export interface ServiceData {
  // TODO: 服务相关数据结构
}

export interface MonitorData {
  performance?: PerformanceData;
  process?: ProcessData;
  service?: ServiceData;
  timestamp: number;
}

export interface DiskHealth {
  devices: Array<{
    device: string;
    status: 'PASSED' | 'FAILED' | 'UNKNOWN';
    temperature: number;
    powerOnHours: number;
    reallocatedSectors: number;
    pendingSectors: number;
    uncorrectableSectors: number;
    model: string;
    serial: string;
    remainingLife?: number;
  }>;
  lastCheck: number;
}

export interface DiskSpaceAnalysis {
  largeDirectories: Array<{
    path: string;
    size: number;
    lastModified?: number;
  }>;
  largeFiles: Array<{
    path: string;
    size: number;
    lastModified?: number;
  }>;
  fileTypes: Array<{
    extension: string;
    count: number;
    totalSize: number;
  }>;
  lastScan: number;
}

export interface DiskIoAnalysis {
  topProcesses: Array<{
    pid: number;
    name: string;
    command: string;
    readBytes: number;
    writeBytes: number;
    readSpeed: number;
    writeSpeed: number;
  }>;
  deviceStats: Array<{
    device: string;
    tps: number;
    readSpeed: number;
    writeSpeed: number;
    await: number;
    svctm: number;
    util: number;
  }>;
  timestamp: number;
  isToolInstalled: boolean;  // 添加工具安装状态字段
} 