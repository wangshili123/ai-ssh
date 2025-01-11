import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { List, Button, Modal, Form, Input, Tree, Card, Typography, Dropdown, Badge, message, Select, InputNumber, Radio, Upload } from 'antd';
import type { MenuProps } from 'antd';
import { PlusOutlined, FolderOutlined, FolderOpenOutlined, EditOutlined, DeleteOutlined, CopyOutlined, UploadOutlined } from '@ant-design/icons';
import { debounce } from 'lodash';
import { storageService } from '../../services/storage';
import type { SessionInfo, GroupInfo } from '../../../main/services/storage';
import './index.css';

const { Title } = Typography;
const { Search } = Input;

interface SessionListProps {
  onSelect?: (session: SessionInfo) => void;
  onSave?: () => void;
  onReload?: () => void;
  onImport?: () => void;
  onExport?: () => void;
  onSettings?: () => void;
}

const SessionList: React.FC<SessionListProps> = ({
  onSelect,
  onSave,
  onReload,
  onImport,
  onExport,
  onSettings
}) => {
  // 状态管理
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [isSessionModalVisible, setIsSessionModalVisible] = useState(false);
  const [isGroupModalVisible, setIsGroupModalVisible] = useState(false);
  const [editingSession, setEditingSession] = useState<SessionInfo | null>(null);
  const [editingGroup, setEditingGroup] = useState<GroupInfo | null>(null);
  const [searchText, setSearchText] = useState('');
  const [sessionForm] = Form.useForm();
  const [groupForm] = Form.useForm();

  // 加载数据
  useEffect(() => {
    loadData();
  }, []);

  // 加载所有数据
  const loadData = async () => {
    try {
      const [loadedSessions, loadedGroups] = await Promise.all([
        storageService.loadSessions(),
        storageService.loadGroups()
      ]);
      setSessions(loadedSessions);
      setGroups(loadedGroups);
    } catch (error) {
      message.error('加载数据失败');
      console.error('加载数据失败:', error);
    }
  };

  // 使用防抖的搜索处理函数
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearchText(value);
    }, 300),
    []
  );

  // 处理新建分组
  const handleAddGroup = () => {
    setEditingGroup(null);
    groupForm.resetFields();
    setIsGroupModalVisible(true);
  };

  // 处理编辑分组
  const handleEditGroup = (group: GroupInfo) => {
    setEditingGroup(group);
    groupForm.setFieldsValue(group);
    setIsGroupModalVisible(true);
  };

  // 处理删除分组
  const handleDeleteGroup = (group: GroupInfo) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除分组 "${group.name}" 吗？分组内的会话将被移动到未分组。`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          const newGroups = groups.filter(g => g.id !== group.id);
          const newSessions = sessions.map(s => 
            s.group === group.id ? { ...s, group: undefined } : s
          );
          
          await Promise.all([
            storageService.saveGroups(newGroups),
            storageService.saveSessions(newSessions)
          ]);
          
          setGroups(newGroups);
          setSessions(newSessions);
          message.success('分组已删除');
        } catch (error) {
          message.error('删除分组失败');
          console.error('删除分组失败:', error);
        }
      }
    });
  };

  // 处理分组表单提交
  const handleGroupModalOk = async () => {
    try {
      const values = await groupForm.validateFields();
      let newGroups: GroupInfo[];
      
      if (editingGroup) {
        newGroups = groups.map(g => 
          g.id === editingGroup.id ? { ...g, ...values } : g
        );
        message.success('分组已更新');
      } else {
        const newGroup: GroupInfo = {
          id: Date.now().toString(),
          name: values.name,
          expanded: true,
          order: groups.length
        };
        newGroups = [...groups, newGroup];
        message.success('分组已创建');
      }

      await storageService.saveGroups(newGroups);
      setGroups(newGroups);
      setIsGroupModalVisible(false);
      groupForm.resetFields();
      setEditingGroup(null);
    } catch (error) {
      if (error instanceof Error) {
        message.error('保存分组失败');
        console.error('保存分组失败:', error);
      }
    }
  };

  // 处理分组取消
  const handleGroupModalCancel = () => {
    setIsGroupModalVisible(false);
    groupForm.resetFields();
    setEditingGroup(null);
  };

  // 获取会话状态的徽标状态
  const getSessionBadgeStatus = (status: SessionInfo['status']) => {
    switch (status) {
      case 'connected':
        return 'success';
      case 'connecting':
        return 'processing';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  // 获取会话状态的文本
  const getSessionStatusText = (status: SessionInfo['status']) => {
    switch (status) {
      case 'connected':
        return '已连接';
      case 'connecting':
        return '连接中';
      case 'error':
        return '连接错误';
      default:
        return '未连接';
    }
  };

  // 渲染会话节点
  const renderSessionNode = (session: SessionInfo) => (
    <div className="session-node">
      <Badge 
        status={getSessionBadgeStatus(session.status)} 
        text={
          <span className="session-title">
            {session.name}
            <span className="session-subtitle">
              {`${session.username}@${session.host}:${session.port}`}
            </span>
          </span>
        }
      />
      <div className="session-actions">
        <Button
          type="text"
          icon={<EditOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            handleEditSession(session);
          }}
        />
        <Button
          type="text"
          icon={<CopyOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            handleCopySession(session);
          }}
        />
        <Button
          type="text"
          icon={<DeleteOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteSession(session);
          }}
        />
      </div>
    </div>
  );

  // 渲染分组节点
  const renderGroupNode = (group: GroupInfo) => (
    <div className="group-node">
      <span className="group-title">
        {group.name}
        <span className="group-count">
          ({sessions.filter(s => s.group === group.id).length})
        </span>
      </span>
      <div className="group-actions">
        <Button
          type="text"
          icon={<EditOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            handleEditGroup(group);
          }}
        />
        <Button
          type="text"
          icon={<DeleteOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteGroup(group);
          }}
        />
      </div>
    </div>
  );

  // 构建树形数据
  const treeData = useMemo(() => {
    const groupedSessions = new Map<string | undefined, SessionInfo[]>();
    sessions.forEach(session => {
      const groupId = session.group;
      if (!groupedSessions.has(groupId)) {
        groupedSessions.set(groupId, []);
      }
      groupedSessions.get(groupId)?.push(session);
    });

    const result = [
      {
        key: 'ungrouped',
        title: (
          <div className="group-title">
            <span>未分组</span>
            <span className="group-count">
              ({groupedSessions.get(undefined)?.length || 0})
            </span>
          </div>
        ),
        children: (groupedSessions.get(undefined) || [])
          .filter(session => 
            !searchText || 
            session.name.toLowerCase().includes(searchText.toLowerCase()) ||
            session.host.toLowerCase().includes(searchText.toLowerCase()) ||
            session.username.toLowerCase().includes(searchText.toLowerCase())
          )
          .sort((a, b) => (a.groupOrder || 0) - (b.groupOrder || 0))
          .map(session => ({
            key: session.id,
            title: renderSessionNode(session),
            isLeaf: true
          }))
      },
      ...groups
        .sort((a, b) => a.order - b.order)
        .map(group => ({
          key: group.id,
          title: renderGroupNode(group),
          children: (groupedSessions.get(group.id) || [])
            .filter(session => 
              !searchText || 
              session.name.toLowerCase().includes(searchText.toLowerCase()) ||
              session.host.toLowerCase().includes(searchText.toLowerCase()) ||
              session.username.toLowerCase().includes(searchText.toLowerCase())
            )
            .sort((a, b) => (a.groupOrder || 0) - (b.groupOrder || 0))
            .map(session => ({
              key: session.id,
              title: renderSessionNode(session),
              isLeaf: true
            }))
        }))
    ];

    return result;
  }, [sessions, groups, searchText]);

  // 处理会话选择
  const handleSelect = (selectedKeys: React.Key[]) => {
    const sessionId = selectedKeys[0]?.toString();
    if (sessionId && sessionId !== 'ungrouped' && !groups.find(g => g.id === sessionId)) {
      const session = sessions.find(s => s.id === sessionId);
      if (session) {
        onSelect?.(session);
      }
    }
  };

  // 处理树节点拖拽
  const handleTreeDrop = async (info: any) => {
    const dropKey = info.node.key;
    const dragKey = info.dragNode.key;
    const dropPos = info.node.pos.split('-');
    const dropPosition = info.dropPosition - Number(dropPos[dropPos.length - 1]);

    try {
      let newSessions = [...sessions];
      let newGroups = [...groups];

      if (groups.find(g => g.id === dragKey)) {
        // 拖拽的是分组
        newGroups = reorderGroups(dragKey, dropKey, dropPosition);
        await storageService.saveGroups(newGroups);
        setGroups(newGroups);
      } else {
        // 拖拽的是会话
        const targetGroup = dropKey === 'ungrouped' ? undefined : dropKey;
        newSessions = reorderSessions(dragKey, targetGroup);
        await storageService.saveSessions(newSessions);
        setSessions(newSessions);
      }
    } catch (error) {
      message.error('更新顺序失败');
      console.error('更新顺序失败:', error);
    }
  };

  // 重新排序分组
  const reorderGroups = (dragKey: string, dropKey: string, dropPosition: number): GroupInfo[] => {
    const newGroups = [...groups];
    const dragIndex = groups.findIndex(g => g.id === dragKey);
    const dropIndex = groups.findIndex(g => g.id === dropKey);
    
    const [removed] = newGroups.splice(dragIndex, 1);
    newGroups.splice(dropPosition < 0 ? dropIndex : dropIndex + 1, 0, removed);
    
    return newGroups.map((group, index) => ({
      ...group,
      order: index
    }));
  };

  // 重新排序会话
  const reorderSessions = (dragKey: string, targetGroup: string | undefined): SessionInfo[] => {
    const newSessions = [...sessions];
    const draggedSession = sessions.find(s => s.id === dragKey);
    if (!draggedSession) return newSessions;

    const groupSessions = newSessions.filter(s => s.group === targetGroup);
    const maxOrder = Math.max(...groupSessions.map(s => s.groupOrder || 0), -1);

    return newSessions.map(s => 
      s.id === dragKey 
        ? { ...s, group: targetGroup, groupOrder: maxOrder + 1 }
        : s
    );
  };

  // 处理新建会话
  const handleAddSession = () => {
    setEditingSession(null);
    sessionForm.resetFields();
    setIsSessionModalVisible(true);
  };

  // 处理会话表单提交
  const handleSessionModalOk = async () => {
    try {
      const values = await sessionForm.validateFields();
      let newSessions: SessionInfo[];
      
      if (editingSession) {
        newSessions = sessions.map(s => 
          s.id === editingSession.id 
            ? { ...s, ...values, status: 'disconnected' }
            : s
        );
        message.success('会话已更新');
      } else {
        const newSession: SessionInfo = {
          id: Date.now().toString(),
          ...values,
          status: 'disconnected'
        };
        newSessions = [...sessions, newSession];
        message.success('会话已创建');
      }

      await storageService.saveSessions(newSessions);
      setSessions(newSessions);
      setIsSessionModalVisible(false);
      sessionForm.resetFields();
      setEditingSession(null);
    } catch (error) {
      if (error instanceof Error) {
        message.error('保存会话失败');
        console.error('保存会话失败:', error);
      }
    }
  };

  // 处理会话表单取消
  const handleSessionModalCancel = () => {
    setIsSessionModalVisible(false);
    sessionForm.resetFields();
    setEditingSession(null);
  };

  // 获取会话操作菜单
  const getSessionMenu = (session: SessionInfo): { items: Required<MenuProps>['items'] } => {
    const items: Required<MenuProps>['items'] = [
      {
        key: 'edit',
        icon: <EditOutlined />,
        label: '编辑',
        onClick: () => handleEditSession(session)
      },
      {
        key: 'copy',
        icon: <CopyOutlined />,
        label: '复制',
        onClick: () => handleCopySession(session)
      },
      {
        key: 'delete',
        icon: <DeleteOutlined />,
        label: '删除',
        onClick: () => handleDeleteSession(session)
      }
    ];
    return { items };
  };

  // 处理编辑会话
  const handleEditSession = (session: SessionInfo) => {
    setEditingSession(session);
    sessionForm.setFieldsValue(session);
    setIsSessionModalVisible(true);
  };

  // 处理复制会话
  const handleCopySession = async (session: SessionInfo) => {
    try {
      const newSession: SessionInfo = {
        ...session,
        id: Date.now().toString(),
        name: `${session.name} (复制)`,
        status: 'disconnected'
      };
      const newSessions = [...sessions, newSession];
      await storageService.saveSessions(newSessions);
      setSessions(newSessions);
      message.success('会话已复制');
    } catch (error) {
      message.error('复制会话失败');
      console.error('复制会话失败:', error);
    }
  };

  // 处理删除会话
  const handleDeleteSession = (session: SessionInfo) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除会话 "${session.name}" 吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          const newSessions = sessions.filter(s => s.id !== session.id);
          await storageService.saveSessions(newSessions);
          setSessions(newSessions);
          message.success('会话已删除');
        } catch (error) {
          message.error('删除会话失败');
          console.error('删除会话失败:', error);
        }
      }
    });
  };

  return (
    <div className="session-list">
      <Card>
        <Title level={4}>会话列表</Title>
        <div className="session-list-header">
          <div className="session-list-actions">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddSession}
            >
              新建会话
            </Button>
            <Button
              icon={<FolderOutlined />}
              onClick={handleAddGroup}
            >
              新建分组
            </Button>
          </div>
          <Search
            placeholder="搜索会话..."
            allowClear
            onChange={e => debouncedSearch(e.target.value)}
            style={{ width: 200 }}
          />
        </div>

        <Tree
          className="session-tree"
          treeData={treeData}
          showLine={{ showLeafIcon: false }}
          showIcon
          icon={({ expanded }: { expanded?: boolean }) => expanded ? <FolderOpenOutlined /> : <FolderOutlined />}
          draggable
          onSelect={handleSelect}
          onDrop={handleTreeDrop}
          expandedKeys={groups.filter(g => g.expanded).map(g => g.id)}
          onExpand={(expandedKeys) => {
            const newGroups = groups.map(g => ({
              ...g,
              expanded: expandedKeys.includes(g.id)
            }));
            setGroups(newGroups);
            storageService.saveGroups(newGroups).catch(console.error);
          }}
        />

        {/* 会话表单模态框 */}
        <Modal
          title={editingSession ? '编辑会话' : '新建会话'}
          open={isSessionModalVisible}
          onOk={handleSessionModalOk}
          onCancel={handleSessionModalCancel}
          width={500}
        >
          <Form
            form={sessionForm}
            layout="vertical"
            initialValues={{ port: 22, authType: 'password' }}
          >
            <Form.Item
              name="name"
              label="会话名称"
              rules={[{ required: true, message: '请输入会话名称' }]}
            >
              <Input placeholder="请输入会话名称" />
            </Form.Item>

            <Form.Item
              name="host"
              label="主机地址"
              rules={[{ required: true, message: '请输入主机地址' }]}
            >
              <Input placeholder="请输入主机地址" />
            </Form.Item>

            <Form.Item
              name="port"
              label="端口"
              rules={[{ required: true, message: '请输入端口号' }]}
            >
              <InputNumber min={1} max={65535} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              name="username"
              label="用户名"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input placeholder="请输入用户名" />
            </Form.Item>

            <Form.Item
              name="authType"
              label="认证方式"
              rules={[{ required: true, message: '请选择认证方式' }]}
            >
              <Radio.Group onChange={() => {
                sessionForm.setFieldsValue({
                  password: undefined,
                  privateKey: undefined
                });
              }}>
                <Radio value="password">密码认证</Radio>
                <Radio value="privateKey">密钥认证</Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) => prevValues.authType !== currentValues.authType}
            >
              {({ getFieldValue }) =>
                getFieldValue('authType') === 'password' ? (
                  <Form.Item
                    name="password"
                    label="密码"
                    rules={[{ required: true, message: '请输入密码' }]}
                  >
                    <Input.Password placeholder="请输入密码" />
                  </Form.Item>
                ) : (
                  <Form.Item
                    name="privateKey"
                    label="私钥文件"
                    rules={[{ required: true, message: '请选择私钥文件' }]}
                  >
                    <Upload
                      beforeUpload={file => {
                        const reader = new FileReader();
                        reader.readAsText(file);
                        reader.onload = () => {
                          sessionForm.setFieldsValue({ privateKey: reader.result });
                        };
                        return false;
                      }}
                    >
                      <Button icon={<UploadOutlined />}>选择私钥文件</Button>
                    </Upload>
                  </Form.Item>
                )
              }
            </Form.Item>

            <Form.Item
              name="group"
              label="所属分组"
            >
              <Select allowClear>
                {groups.map(group => (
                  <Select.Option key={group.id} value={group.id}>
                    {group.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Form>
        </Modal>

        {/* 分组表单模态框 */}
        <Modal
          title={editingGroup ? '编辑分组' : '新建分组'}
          open={isGroupModalVisible}
          onOk={handleGroupModalOk}
          onCancel={handleGroupModalCancel}
        >
          <Form form={groupForm} layout="vertical">
            <Form.Item
              name="name"
              label="分组名称"
              rules={[{ required: true, message: '请输入分组名称' }]}
            >
              <Input />
            </Form.Item>
          </Form>
        </Modal>
      </Card>
    </div>
  );
};

export default SessionList; 