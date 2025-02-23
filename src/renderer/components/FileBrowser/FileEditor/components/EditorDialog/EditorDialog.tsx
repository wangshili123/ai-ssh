import React, { useRef, useEffect } from 'react';
import { Modal } from 'antd';
import { FileEditorMain, FileEditorMainRef } from '../FileEditorMain/FileEditorMain';
import './EditorDialog.css';

interface EditorDialogProps {
  visible: boolean;
  title: string;
  filePath: string;
  sessionId: string;
  onClose: () => void;
}

export const EditorDialog: React.FC<EditorDialogProps> = ({
  visible,
  title,
  filePath,
  sessionId,
  onClose
}) => {
  const editorRef = useRef<FileEditorMainRef>(null);

  // 处理关闭事件
  const handleClose = async () => {
    if (editorRef.current?.isDirty) {
      const result = await Modal.confirm({
        title: '保存更改',
        content: '文件已修改，是否保存更改？',
        okText: '保存',
        cancelText: '不保存'
      });
      
      if (result) {
        await editorRef.current.save();
      }
    }
    onClose();
  };

  return (
    <Modal
      title={title}
      open={visible}
      footer={null}
      width="80%"
      style={{ top: 20 }}
      onCancel={handleClose}
      maskClosable={false}
      keyboard={true}
      className="editor-dialog"
    >
      <div className="editor-dialog-content">
        <FileEditorMain
          filePath={filePath}
          sessionId={sessionId}
          initialConfig={{
            readOnly: false
          }}
          ref={editorRef}
        />
      </div>
    </Modal>
  );
}; 