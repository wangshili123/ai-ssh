import React from 'react';
import { Button, Dropdown } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import { HistoryProps } from './HistoryTypes';
import HistoryMenu from './HistoryMenu';

const HistoryButton: React.FC<HistoryProps> = (props) => {
  const menu = <HistoryMenu {...props} />;

  return (
    <Dropdown
      overlay={menu}
      trigger={['click']}
      placement="bottomRight"
    >
      <Button icon={<HistoryOutlined />} size="small" />
    </Dropdown>
  );
};

export default HistoryButton; 