/**
 * 根据使用率返回对应的进度条颜色
 * @param percent 使用率百分比
 * @returns 进度条颜色
 */
export const getProgressColor = (percent: number): string => {
  if (percent >= 90) {
    return '#ff4d4f'; // 危险红色
  } else if (percent >= 50) {
    return '#faad14'; // 警告黄色
  } else {
    return '#52c41a'; // 正常绿色
  }
};

/**
 * 根据使用率返回对应的状态
 * @param percent 使用率百分比
 * @returns 状态类型
 */
export const getResourceStatus = (percent: number): 'normal' | 'warning' | 'critical' => {
  if (percent >= 90) {
    return 'critical';
  } else if (percent >= 70) {
    return 'warning';
  } else {
    return 'normal';
  }
}; 