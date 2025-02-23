/**
 * 虚拟滚动管理器
 * 用于优化大文件的显示性能，只渲染可见区域的内容
 */

export interface ScrollConfig {
  // 每个块的行数
  blockSize: number;
  // 预加载的块数（上下各多少块）
  preloadBlocks: number;
  // 每行的平均高度（像素）
  lineHeight: number;
  // 容器高度（像素）
  containerHeight: number;
  // 总行数
  totalLines: number;
}

export interface ScrollState {
  // 当前滚动位置（像素）
  scrollTop: number;
  // 可见区域的起始行
  visibleStartLine: number;
  // 可见区域的结束行
  visibleEndLine: number;
  // 需要加载的块索引列表
  blocksToLoad: number[];
  // 可以释放的块索引列表
  blocksToRelease: number[];
}

export class VirtualScroller {
  private config: ScrollConfig;
  private loadedBlocks: Set<number> = new Set();
  private lastScrollTop: number = 0;

  constructor(config: ScrollConfig) {
    this.config = config;
  }

  /**
   * 计算滚动状态
   * @param scrollTop 当前滚动位置（像素）
   * @returns 滚动状态
   */
  public calculateScrollState(scrollTop: number): ScrollState {
    const { blockSize, preloadBlocks, lineHeight, containerHeight, totalLines } = this.config;

    // 计算可见区域的行范围
    const visibleStartLine = Math.max(0, Math.floor(scrollTop / lineHeight));
    const visibleEndLine = Math.min(
      totalLines,
      Math.ceil((scrollTop + containerHeight) / lineHeight)
    );

    // 计算需要加载的块范围
    const startBlock = Math.floor(visibleStartLine / blockSize) - preloadBlocks;
    const endBlock = Math.ceil(visibleEndLine / blockSize) + preloadBlocks;

    // 计算需要加载和释放的块
    const blocksToLoad: number[] = [];
    const blocksToRelease: number[] = [];

    // 遍历块范围
    for (let i = startBlock; i <= endBlock; i++) {
      if (i >= 0 && i < Math.ceil(totalLines / blockSize)) {
        if (!this.loadedBlocks.has(i)) {
          blocksToLoad.push(i);
        }
      }
    }

    // 检查已加载的块是否需要释放
    for (const blockIndex of this.loadedBlocks) {
      if (blockIndex < startBlock || blockIndex > endBlock) {
        blocksToRelease.push(blockIndex);
      }
    }

    // 更新已加载块集合
    for (const blockIndex of blocksToLoad) {
      this.loadedBlocks.add(blockIndex);
    }
    for (const blockIndex of blocksToRelease) {
      this.loadedBlocks.delete(blockIndex);
    }

    this.lastScrollTop = scrollTop;

    return {
      scrollTop,
      visibleStartLine,
      visibleEndLine,
      blocksToLoad,
      blocksToRelease
    };
  }

  /**
   * 获取块的行范围
   * @param blockIndex 块索引
   * @returns [起始行, 结束行]
   */
  public getBlockRange(blockIndex: number): [number, number] {
    const { blockSize, totalLines } = this.config;
    const startLine = blockIndex * blockSize;
    const endLine = Math.min(startLine + blockSize, totalLines);
    return [startLine, endLine];
  }

  /**
   * 计算总高度（像素）
   */
  public getTotalHeight(): number {
    return this.config.totalLines * this.config.lineHeight;
  }

  /**
   * 获取当前加载的块数量
   */
  public getLoadedBlockCount(): number {
    return this.loadedBlocks.size;
  }

  /**
   * 清除所有加载的块
   */
  public clearLoadedBlocks(): void {
    this.loadedBlocks.clear();
    this.lastScrollTop = 0;
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<ScrollConfig>): void {
    this.config = { ...this.config, ...config };
    this.clearLoadedBlocks();
  }
} 