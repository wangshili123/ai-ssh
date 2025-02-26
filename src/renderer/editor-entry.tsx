import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorWindow } from './components/FileBrowser/FileEditor/components/EditorWindow/EditorWindow';
import { ipcRenderer } from 'electron';
import { editorTabStore } from './components/FileBrowser/FileEditor/store/EditorTabStore';

// 等待 DOM 加载完成
window.addEventListener('DOMContentLoaded', () => {
  try {
    // 获取URL参数
    const urlParams = new URLSearchParams(window.location.search);
    const windowId = urlParams.get('windowId') || '';
    const filePath = decodeURIComponent(urlParams.get('filePath') || '');
    const sessionId = urlParams.get('sessionId') || '';

    console.log('编辑器窗口参数:', { windowId, filePath, sessionId });

    if (!windowId || !filePath || !sessionId) {
      throw new Error('缺少必要的参数');
    }

    // 添加初始标签页
    editorTabStore.addTab({
      id: windowId,
      filePath: filePath,
      sessionId: sessionId,
      title: filePath.split('/').pop() || 'Editor',
      isActive: true
    });

    // 监听添加新标签的消息
    const addTabListener = (event: Electron.IpcRendererEvent, tabInfo: any) => {
      console.log('收到添加标签消息:', tabInfo);
      
      // 检查标签是否已存在
      const existingTab = editorTabStore.getTab(tabInfo.id);
      if (existingTab) {
        console.log('标签已存在，激活它:', tabInfo.id);
        editorTabStore.setActiveTab(tabInfo.id);
        return;
      }
      
      // 添加新标签
      editorTabStore.addTab({
        id: tabInfo.id,
        filePath: tabInfo.filePath,
        sessionId: tabInfo.sessionId,
        title: tabInfo.title || tabInfo.filePath.split('/').pop() || 'Editor',
        isActive: true
      });
    };

    // 移除旧的监听器（如果有）
    ipcRenderer.removeAllListeners('add-editor-tab');
    
    // 添加新的监听器
    ipcRenderer.on('add-editor-tab', addTabListener);

    // 渲染编辑器窗口
    const root = createRoot(document.getElementById('root')!);
    root.render(
      <EditorWindow />
    );
    
    console.log('编辑器窗口渲染完成');
    
    // 通知主进程窗口已准备好接收标签
    ipcRenderer.send('editor-window-ready');
  } catch (error) {
    console.error('编辑器窗口渲染失败:', error);
    document.body.innerHTML = `<div style="color: red; padding: 20px;">
      初始化失败: ${(error as Error).message}
    </div>`;
  }
}); 