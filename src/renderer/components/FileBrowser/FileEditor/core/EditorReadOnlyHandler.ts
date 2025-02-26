/**
 * 编辑器只读模式处理
 * 负责处理编辑器在只读模式下的交互行为和提示
 */

import * as monaco from 'monaco-editor';
import { EditorMode } from '../types/FileEditorTypes';

/**
 * 编辑器只读处理器类
 * 处理只读模式下的用户交互，提供自定义提示和键盘事件拦截
 */
export class EditorReadOnlyHandler {
  private editor: monaco.editor.IStandaloneCodeEditor;
  private currentMode: EditorMode;
  private customTooltipElement: HTMLElement | null = null;
  private keydownDisposable: monaco.IDisposable | null = null;
  private mouseDownDisposable: monaco.IDisposable | null = null;
  private tooltipTimeout: NodeJS.Timeout | null = null;

  /**
   * 构造函数
   * @param editor Monaco编辑器实例
   * @param mode 当前编辑器模式
   */
  constructor(editor: monaco.editor.IStandaloneCodeEditor, mode: EditorMode) {
    this.editor = editor;
    this.currentMode = mode;

    // 如果初始模式是浏览模式，立即设置只读处理
    if (this.currentMode === EditorMode.BROWSE) {
      this.setupReadOnlyHandler();
    }
  }

  /**
   * 更新编辑器模式
   * @param mode 新的编辑器模式
   */
  public updateMode(mode: EditorMode): void {
    this.currentMode = mode;
    
    if (this.currentMode === EditorMode.BROWSE) {
      this.setupReadOnlyHandler();
    } else {
      this.removeReadOnlyHandler();
    }
  }

  /**
   * 设置只读模式处理器
   * 创建提示元素并设置事件监听
   */
  public setupReadOnlyHandler(): void {
    if (!this.editor) return;
    
    // 清除之前的处理器
    this.removeReadOnlyHandler();
    
    // 创建并保存一个自定义工具提示元素
    const tooltipElement = document.createElement('div');
    tooltipElement.className = 'custom-readonly-tooltip';
    tooltipElement.style.position = 'absolute';
    tooltipElement.style.zIndex = '1000';
    tooltipElement.style.backgroundColor = '#e74c3c';
    tooltipElement.style.color = 'white';
    tooltipElement.style.padding = '5px 10px';
    tooltipElement.style.borderRadius = '3px';
    tooltipElement.style.fontSize = '12px';
    tooltipElement.style.display = 'none';
    tooltipElement.textContent = '浏览模式下无法编辑文件';
    
    // 将提示元素添加到编辑器容器中
    const domNode = this.editor.getDomNode();
    if (domNode && domNode.parentNode) {
      domNode.parentNode.appendChild(tooltipElement);
      this.customTooltipElement = tooltipElement;
    }
    
    // 添加键盘和鼠标事件监听器
    this.keydownDisposable = this.editor.onKeyDown((e) => {
      // 如果用户在浏览模式下按键
      if (this.currentMode === EditorMode.BROWSE) {
        // 允许的组合键列表：复制、全选、查找
        const allowedCombos = [
          // Ctrl+C 或 Command+C（复制）
          (e.ctrlKey || e.metaKey) && e.keyCode === monaco.KeyCode.KeyC,
          // Ctrl+A 或 Command+A（全选）
          (e.ctrlKey || e.metaKey) && e.keyCode === monaco.KeyCode.KeyA,
          // Ctrl+F 或 Command+F（查找）
          (e.ctrlKey || e.metaKey) && e.keyCode === monaco.KeyCode.KeyF,
          // 方向键（允许导航）
          e.keyCode === monaco.KeyCode.LeftArrow || 
          e.keyCode === monaco.KeyCode.RightArrow || 
          e.keyCode === monaco.KeyCode.UpArrow || 
          e.keyCode === monaco.KeyCode.DownArrow,
          // Page Up/Down（允许翻页）
          e.keyCode === monaco.KeyCode.PageUp || 
          e.keyCode === monaco.KeyCode.PageDown,
          // Home/End（允许跳到行首/行尾）
          e.keyCode === monaco.KeyCode.Home || 
          e.keyCode === monaco.KeyCode.End
        ];
        
        // 如果不是允许的组合键，则阻止并显示提示
        if (!allowedCombos.some(combo => combo === true)) {
          // 显示自定义提示
          this.showCustomTooltip();
          
          // 阻止默认行为
          e.preventDefault();
          e.stopPropagation();
        }
      }
    });
    
    // 添加鼠标点击监听器
    this.mouseDownDisposable = this.editor.onMouseDown(() => {
      if (this.currentMode === EditorMode.BROWSE) {
        // 点击时隐藏提示
        this.hideCustomTooltip();
      }
    });
  }
  
  /**
   * 移除只读模式处理器
   * 清理事件监听和DOM元素
   */
  public removeReadOnlyHandler(): void {
    // 清理事件监听器
    if (this.keydownDisposable) {
      this.keydownDisposable.dispose();
      this.keydownDisposable = null;
    }
    
    if (this.mouseDownDisposable) {
      this.mouseDownDisposable.dispose();
      this.mouseDownDisposable = null;
    }
    
    // 移除提示元素
    if (this.customTooltipElement) {
      if (this.customTooltipElement.parentNode) {
        this.customTooltipElement.parentNode.removeChild(this.customTooltipElement);
      }
      this.customTooltipElement = null;
    }
    
    // 清除超时计时器
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
      this.tooltipTimeout = null;
    }
  }
  
  /**
   * 显示自定义提示
   * 在光标位置显示提示，并设置自动隐藏
   */
  private showCustomTooltip(): void {
    if (!this.customTooltipElement || !this.editor) return;
    
    const position = this.editor.getPosition();
    
    if (position) {
      // 获取光标位置的坐标
      const coordinates = this.editor.getScrolledVisiblePosition(position);
      
      if (coordinates) {
        const editorDomNode = this.editor.getDomNode();
        if (editorDomNode) {
          // 设置提示位置
          this.customTooltipElement.style.top = `${coordinates.top + editorDomNode.getBoundingClientRect().top}px`;
          this.customTooltipElement.style.left = `${coordinates.left + editorDomNode.getBoundingClientRect().left}px`;
          this.customTooltipElement.style.display = 'block';
          
          // 3秒后自动隐藏
          if (this.tooltipTimeout) {
            clearTimeout(this.tooltipTimeout);
          }
          
          this.tooltipTimeout = setTimeout(() => {
            this.hideCustomTooltip();
          }, 3000);
        }
      }
    }
  }
  
  /**
   * 隐藏自定义提示
   */
  private hideCustomTooltip(): void {
    if (this.customTooltipElement) {
      this.customTooltipElement.style.display = 'none';
    }
    
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
      this.tooltipTimeout = null;
    }
  }
  
  /**
   * 销毁处理器
   * 清理所有资源
   */
  public dispose(): void {
    this.removeReadOnlyHandler();
  }
} 