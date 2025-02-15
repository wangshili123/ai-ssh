/**
 * 根据使用率返回对应的进度条颜色
 * @param percent 使用率百分比
 * @returns 进度条颜色
 */
export const getProgressColor = (percent: number): string => {
  if (percent >= 90) {
    return '#f5222d'; // 红色，危险
  } else if (percent >= 70) {
    return '#faad14'; // 黄色，警告
  } else {
    return '#52c41a'; // 绿色，正常
  }
}; 