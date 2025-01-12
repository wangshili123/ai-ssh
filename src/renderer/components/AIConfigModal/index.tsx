import React from 'react';
import { Modal, message } from 'antd';
import AIConfigComponent from '../AIConfig';

interface AIConfigModalProps {
  visible: boolean;
  onClose: () => void;
}

const AIConfigModal: React.FC<AIConfigModalProps> = ({ visible, onClose }) => {
  // 处理配置保存成功
  const handleSaveSuccess = () => {
    message.success('配置保存成功');
    onClose();
  };

  // 处理配置保存失败
  const handleSaveError = (error: Error) => {
    message.error(`配置保存失败: ${error.message}`);
  };

  return (
    <Modal
      title="模型配置"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={700}
      destroyOnClose
      maskClosable={false}
    >
      <AIConfigComponent
        onSaveSuccess={handleSaveSuccess}
        onSaveError={handleSaveError}
      />
    </Modal>
  );
};

export default AIConfigModal; 