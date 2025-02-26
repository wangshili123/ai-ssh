/**
 * 编辑模式自动保存管理
 * 负责管理编辑器的自动保存功能
 */

// 默认配置
const AUTOSAVE_INTERVAL = 30000; // 30秒

/**
 * 编辑模式自动保存管理器
 * 负责处理自动保存功能
 */
export class EditModeAutoSave {
  // 编辑模式引用
  private editMode: any;
  
  // 自动保存定时器
  private autoSaveTimer: NodeJS.Timeout | null = null;
  
  // 是否启用自动保存
  private autoSaveEnabled: boolean = false;
  
  // 自动保存间隔
  private interval: number = AUTOSAVE_INTERVAL;

  /**
   * 构造函数
   * @param editMode 编辑模式引用
   */
  constructor(editMode: any) {
    this.editMode = editMode;
  }

  /**
   * 启用自动保存
   * @param interval 自动保存间隔（毫秒）
   */
  public enableAutoSave(interval: number = AUTOSAVE_INTERVAL): void {
    this.autoSaveEnabled = true;
    this.interval = interval;
    
    // 如果文件已加载，开始自动保存
    if (this.editMode.getState().isLoaded) {
      this.startAutoSave();
    }
  }

  /**
   * 禁用自动保存
   */
  public disableAutoSave(): void {
    this.autoSaveEnabled = false;
    this.stopAutoSave();
  }

  /**
   * 开始自动保存
   */
  public startAutoSave(): void {
    // 先停止现有的定时器
    this.stopAutoSave();
    
    // 创建新的定时器
    this.autoSaveTimer = setInterval(() => {
      if (this.editMode.contentManager.isModified()) {
        this.editMode.saveFile();
      }
    }, this.interval);
  }

  /**
   * 停止自动保存
   */
  public stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  /**
   * 检查自动保存是否已启用
   * @returns 是否已启用自动保存
   */
  public isAutoSaveEnabled(): boolean {
    return this.autoSaveEnabled;
  }

  /**
   * 获取自动保存间隔
   * @returns 自动保存间隔（毫秒）
   */
  public getInterval(): number {
    return this.interval;
  }

  /**
   * 设置自动保存间隔
   * @param interval 自动保存间隔（毫秒）
   */
  public setInterval(interval: number): void {
    this.interval = interval;
    
    // 如果自动保存已启用且定时器存在，重新启动定时器
    if (this.autoSaveEnabled && this.autoSaveTimer) {
      this.startAutoSave();
    }
  }
} 