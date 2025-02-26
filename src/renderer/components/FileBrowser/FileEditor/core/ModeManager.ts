/**
 * 模式管理器
 * 负责管理浏览模式和编辑模式之间的切换
 */

import { EventEmitter } from 'events';
import { 
  EditorEvents, 
  EditorErrorType, 
  EditorMode,
  ModeSwitchOptions,
  ModeSwitchResult
} from '../types/FileEditorTypes';
import { ErrorManager } from './ErrorManager';
import { BrowseMode } from './BrowseMode';
import { EditMode } from './EditMode';

/**
 * 模式管理器
 * 负责协调浏览模式和编辑模式之间的切换
 */
export class ModeManager extends EventEmitter {
  private filePath: string;
  private sessionId: string;
  private errorManager: ErrorManager;
  private browseMode: BrowseMode;
  private editMode: EditMode;
  private currentMode: EditorMode = EditorMode.BROWSE;
  private isSwitching: boolean = false;

  /**
   * 构造函数
   * @param filePath 文件路径
   * @param sessionId 会话ID
   * @param errorManager 错误管理器
   */
  constructor(filePath: string, sessionId: string, errorManager: ErrorManager) {
    super();
    this.filePath = filePath;
    this.sessionId = sessionId;
    this.errorManager = errorManager;
    
    // 创建浏览模式和编辑模式实例
    this.browseMode = new BrowseMode(filePath, sessionId, errorManager);
    this.editMode = new EditMode(filePath, sessionId, errorManager);
    
    // 转发浏览模式的事件
    this.forwardEvents(this.browseMode);
    
    // 初始化为浏览模式
    this.currentMode = EditorMode.BROWSE;
  }

  /**
   * 转发事件
   * 将子模式的事件转发到模式管理器
   * @param emitter 事件发射器
   */
  private forwardEvents(emitter: EventEmitter): void {
    // 获取所有 EditorEvents 枚举值
    const events = Object.values(EditorEvents);
    
    // 为每个事件添加监听器
    for (const event of events) {
      emitter.on(event, (...args) => {
        this.emit(event, ...args);
      });
    }
  }

  /**
   * 切换到浏览模式
   * @param options 切换选项
   * @returns 切换结果
   */
  public async switchToBrowseMode(options: ModeSwitchOptions = {}): Promise<ModeSwitchResult> {
    // 如果已经是浏览模式，直接返回
    if (this.currentMode === EditorMode.BROWSE && !this.isSwitching) {
      return { success: true, mode: EditorMode.BROWSE };
    }
    
    // 如果正在切换中，返回错误
    if (this.isSwitching) {
      return { 
        success: false, 
        error: '模式切换正在进行中，请稍后再试' 
      };
    }
    
    this.isSwitching = true;
    this.emit(EditorEvents.MODE_SWITCHING_STARTED, { 
      fromMode: this.currentMode, 
      toMode: EditorMode.BROWSE 
    });
    
    try {
      // 如果当前是编辑模式，需要先保存文件
      if (this.currentMode === EditorMode.EDIT && this.editMode.isFileModified()) {
        const shouldSave = options.saveOnSwitch !== false;
        
        if (shouldSave) {
          const saveResult = await this.editMode.saveFile();
          if (!saveResult) {
            throw new Error('保存文件失败，无法切换模式');
          }
        }
      }
      
      // 停止转发编辑模式的事件
      this.stopForwardingEvents(this.editMode);
      
      // 开始转发浏览模式的事件
      this.forwardEvents(this.browseMode);
      
      // 更新当前模式
      this.currentMode = EditorMode.BROWSE;
      
      // 发出模式切换完成事件
      this.emit(EditorEvents.MODE_SWITCHING_COMPLETED, { 
        mode: EditorMode.BROWSE 
      });
      
      this.isSwitching = false;
      return { success: true, mode: EditorMode.BROWSE };
    } catch (error: any) {
      this.isSwitching = false;
      
      // 发出模式切换失败事件
      this.emit(EditorEvents.MODE_SWITCHING_FAILED, { 
        fromMode: EditorMode.EDIT, 
        toMode: EditorMode.BROWSE,
        error: error.message
      });
      
      this.errorManager.handleError(
        EditorErrorType.MODE_SWITCH_ERROR,
        `切换到浏览模式失败: ${error.message}`
      );
      
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * 切换到编辑模式
   * @param options 切换选项
   * @returns 切换结果
   */
  public async switchToEditMode(options: ModeSwitchOptions = {}): Promise<ModeSwitchResult> {
    // 如果已经是编辑模式，直接返回
    if (this.currentMode === EditorMode.EDIT && !this.isSwitching) {
      return { success: true, mode: EditorMode.EDIT };
    }
    
    // 如果正在切换中，返回错误
    if (this.isSwitching) {
      return { 
        success: false, 
        error: '模式切换正在进行中，请稍后再试' 
      };
    }
    
    this.isSwitching = true;
    this.emit(EditorEvents.MODE_SWITCHING_STARTED, { 
      fromMode: this.currentMode, 
      toMode: EditorMode.EDIT 
    });
    
    try {
      // 加载文件内容
      const loadResult = await this.editMode.loadFile();
      if (!loadResult) {
        throw new Error('加载文件失败，无法切换到编辑模式');
      }
      
      // 停止转发浏览模式的事件
      this.stopForwardingEvents(this.browseMode);
      
      // 开始转发编辑模式的事件
      this.forwardEvents(this.editMode);
      
      // 更新当前模式
      this.currentMode = EditorMode.EDIT;
      
      // 发出模式切换完成事件
      this.emit(EditorEvents.MODE_SWITCHING_COMPLETED, { 
        mode: EditorMode.EDIT 
      });
      
      this.isSwitching = false;
      return { success: true, mode: EditorMode.EDIT };
    } catch (error: any) {
      this.isSwitching = false;
      
      // 发出模式切换失败事件
      this.emit(EditorEvents.MODE_SWITCHING_FAILED, { 
        fromMode: EditorMode.BROWSE, 
        toMode: EditorMode.EDIT,
        error: error.message
      });
      
      this.errorManager.handleError(
        EditorErrorType.MODE_SWITCH_ERROR,
        `切换到编辑模式失败: ${error.message}`
      );
      
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * 停止转发事件
   * @param emitter 事件发射器
   */
  private stopForwardingEvents(emitter: EventEmitter): void {
    emitter.removeAllListeners();
  }

  /**
   * 获取当前模式
   * @returns 当前模式
   */
  public getCurrentMode(): EditorMode {
    return this.currentMode;
  }

  /**
   * 获取浏览模式实例
   * @returns 浏览模式实例
   */
  public getBrowseMode(): BrowseMode {
    return this.browseMode;
  }

  /**
   * 获取编辑模式实例
   * @returns 编辑模式实例
   */
  public getEditMode(): EditMode {
    return this.editMode;
  }

  /**
   * 是否正在切换模式
   * @returns 是否正在切换
   */
  public isSwitchingMode(): boolean {
    return this.isSwitching;
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    this.browseMode.dispose();
    this.editMode.dispose();
    this.removeAllListeners();
  }

  /**
   * 切换到指定模式
   * @param mode 目标模式
   * @returns 切换是否成功
   */
  public switchToMode(mode: EditorMode): Promise<boolean> {
    if (mode === EditorMode.EDIT) {
      return this.switchToEditMode().then(result => result.success);
    } else {
      return this.switchToBrowseMode().then(result => result.success);
    }
  }
} 