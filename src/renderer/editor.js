// 等待 DOM 加载完成
window.addEventListener('DOMContentLoaded', () => {
  try {
    // 获取URL参数
    const urlParams = new URLSearchParams(window.location.search);
    const windowId = urlParams.get('windowId');
    const filePath = decodeURIComponent(urlParams.get('filePath'));
    const sessionId = urlParams.get('sessionId');

    console.log('编辑器窗口参数:', { windowId, filePath, sessionId });

    // 直接引入所需的模块
    const ReactDOM = require('react-dom/client');
    const React = require('react');
    
    // 使用相对路径导入 EditorWindow 组件
    const EditorWindowPath = require.resolve('./components/FileBrowser/FileEditor/components/EditorWindow/EditorWindow');
    console.log('EditorWindow 组件路径:', EditorWindowPath);
    
    // 使用 require 导入组件
    const EditorWindow = require('./components/FileBrowser/FileEditor/components/EditorWindow/EditorWindow').default;
    console.log('EditorWindow 组件已加载:', !!EditorWindow);
    
    if (!EditorWindow) {
      throw new Error('无法加载 EditorWindow 组件');
    }
    
    // 渲染编辑器窗口
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(
      React.createElement(EditorWindow, {
        windowId,
        filePath,
        sessionId
      })
    );
    
    console.log('编辑器窗口渲染完成');
  } catch (error) {
    console.error('编辑器窗口渲染失败:', error);
    document.body.innerHTML = `<div style="color: red; padding: 20px;">
      初始化失败: ${error.message}
    </div>`;
  }
}); 