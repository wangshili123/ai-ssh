import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react';
import { ipcRenderer } from 'electron';
import { EditorTabs } from '../EditorTabs/EditorTabs';
import './EditorWindow.css';

export const EditorWindow: React.FC = observer(() => {
  // 处理窗口关闭
  const handleClose = () => {
    window.close();
  };

  return (
    <div className="editor-window">
      <EditorTabs />
    </div>
  );
});

// 确保默认导出
export default EditorWindow; 