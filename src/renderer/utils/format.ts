/**
 * 格式化字节大小
 * @param bytes 字节数
 * @param decimals 小数位数
 * @returns 格式化后的字符串
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * 格式化时间戳为日期时间字符串
 * @param timestamp 时间戳
 * @returns 格式化后的日期时间字符串
 */
export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * 格式化百分比数字
 * @param value 要格式化的数字
 * @param precision 精度，默认为1
 * @returns 格式化后的百分比字符串
 */
export function formatPercent(value: number, precision: number = 1): string {
  return `${value.toFixed(precision)}%`;
}

/**
 * 格式化数字，添加千位分隔符
 * @param num 数值
 * @returns 格式化后的字符串
 */
export function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * 格式化持续时间
 * @param seconds 秒数
 * @returns 格式化后的字符串
 */
export function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}天`);
  if (hours > 0) parts.push(`${hours}小时`);
  if (minutes > 0) parts.push(`${minutes}分钟`);
  if (remainingSeconds > 0 || parts.length === 0) parts.push(`${remainingSeconds}秒`);

  return parts.join(' ');
}

/**
 * 格式化频率（Hz）
 * @param hz 频率值
 * @returns 格式化后的频率字符串
 */
export function formatFrequency(hz: number): string {
  if (hz >= 1e9) {
    return `${(hz / 1e9).toFixed(2)} GHz`;
  } else if (hz >= 1e6) {
    return `${(hz / 1e6).toFixed(2)} MHz`;
  } else if (hz >= 1e3) {
    return `${(hz / 1e3).toFixed(2)} KHz`;
  } else {
    return `${hz.toFixed(2)} Hz`;
  }
}

/**
 * 格式化网络速率
 * @param bytesPerSecond 每秒字节数
 * @returns 格式化后的字符串
 */
export function formatBitRate(bytesPerSecond: number): string {
  const bitsPerSecond = bytesPerSecond * 8;
  const units = ['bps', 'Kbps', 'Mbps', 'Gbps'];
  let value = bitsPerSecond;
  let unitIndex = 0;

  while (value >= 1000 && unitIndex < units.length - 1) {
    value /= 1000;
    unitIndex++;
  }

  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * 格式化时间戳为本地时间字符串
 * @param timestamp 时间戳
 * @returns 格式化后的时间字符串
 */
export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
} 