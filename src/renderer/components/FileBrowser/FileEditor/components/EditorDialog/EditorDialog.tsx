import React, { useEffect } from 'react';
import { Drawer } from 'antd';
import { EditorTabs } from '../EditorTabs/EditorTabs';
import './EditorDialog.css';

interface EditorDialogProps {
  onClose: () => void;
}

export const EditorDialog: React.FC<EditorDialogProps> = ({
  onClose
}) => {
  return (
    <Drawer
      title="文件编辑器"
      open={true}
      onClose={onClose}
      width="80%"
      placement="right"
      className="editor-drawer"
      closable={true}
      destroyOnClose
      mask={false}
      keyboard={true}
    >
      <div className="editor-dialog-content">
        <EditorTabs />
      </div>
    </Drawer>
  );
}; 