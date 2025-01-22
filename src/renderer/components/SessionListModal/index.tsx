import React from 'react';
import { Modal } from 'antd';
import SessionList from '../SessionList';
import type { SessionInfo } from '../../../main/services/storage';
import './style.css';

interface SessionListModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (session: SessionInfo) => void;
}

const SessionListModal: React.FC<SessionListModalProps> = ({
  visible,
  onClose,
  onSelect
}) => {
  // 处理会话选择
  const handleSelect = (session: SessionInfo) => {
    // 先触发选择事件，这样会更新 App 组件中的 activeSession
    onSelect(session);
    // 然后关闭弹窗
    onClose();
  };

  return (
    <Modal
      title="会话列表"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={600}
      bodyStyle={{ padding: 0, height: '70vh' }}
      className="session-list-modal"
    >
      <SessionList onSelect={handleSelect} />
    </Modal>
  );
};

export default SessionListModal; 