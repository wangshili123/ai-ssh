/**
 * 文件编辑器状态管理提供者组件
 */

import React, { ReactNode } from 'react';
import { FileEditorStore, EditorStoreContext } from './FileEditorStore';

interface EditorStoreProviderProps {
  children: ReactNode;
}

export const EditorStoreProvider: React.FC<EditorStoreProviderProps> = ({ children }) => {
  const store = React.useMemo(() => new FileEditorStore(), []);

  return (
    <EditorStoreContext.Provider value={store}>
      {children}
    </EditorStoreContext.Provider>
  );
}; 