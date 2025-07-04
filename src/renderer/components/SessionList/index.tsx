import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { List, Button, Modal, Form, Input, Tree, Card, Typography, Dropdown, message, Select, InputNumber, Radio, Upload, Checkbox, Divider, Space } from 'antd';
import type { MenuProps } from 'antd';
import { PlusOutlined, FolderOutlined, FolderOpenOutlined, EditOutlined, DeleteOutlined, CopyOutlined, UploadOutlined } from '@ant-design/icons';
import { debounce } from 'lodash';
import { storageService } from '../../services/storage';
import type { SessionInfo, GroupInfo } from '../../../renderer/types/index';
import './index.css';
import { eventBus } from '../../services/eventBus';
import { v4 as uuidv4 } from 'uuid';

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
  const [ungroupedExpanded, setUngroupedExpanded] = useState(true); // 未分组的展开状态
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

      // 清理数据：确保会话的分组ID都是有效的
      const validGroupIds = new Set(loadedGroups.map(g => g.id));
      const cleanedSessions = loadedSessions.map(session => {
        if (session.group && !validGroupIds.has(session.group)) {
          console.warn(`会话 ${session.name} 的分组ID ${session.group} 无效，已移动到未分组`);
          return { ...session, group: undefined };
        }
        return session;
      });

      // 如果有数据被清理，保存清理后的数据
      if (cleanedSessions.some((session, index) => session.group !== loadedSessions[index].group)) {
        await storageService.saveSessions(cleanedSessions);
      }

      setSessions(cleanedSessions);
      setGroups(loadedGroups);

      // 验证数据一致性
      setTimeout(() => validateDataConsistency(), 100);
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

  // 验证数据一致性
  const validateDataConsistency = useCallback(() => {
    const validGroupIds = new Set(groups.map(g => g.id));
    const inconsistentSessions = sessions.filter(session =>
      session.group && !validGroupIds.has(session.group)
    );

    if (inconsistentSessions.length > 0) {
      console.warn('发现数据不一致的会话:', inconsistentSessions.map(s => ({
        name: s.name,
        id: s.id,
        invalidGroupId: s.group
      })));
      return false;
    }
    return true;
  }, [sessions, groups]);

  // 处理新建分组
  const handleAddGroup = () => {
    const newGroup: GroupInfo = {
      id: uuidv4(),
      name: '新分组',
      order: groups.length,
      expanded: true
    };
    setGroups([...groups, newGroup]);
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
          id: uuidv4(),
          name: values.name,
          order: groups.length,
          expanded: true
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
      message.error('保存分组失败');
      console.error('保存分组失败:', error);
    }
  };

  // 处理分组取消
  const handleGroupModalCancel = () => {
    setIsGroupModalVisible(false);
    groupForm.resetFields();
    setEditingGroup(null);
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

  // 渲染会话节点
  const renderSessionNode = (session: SessionInfo) => (
    <Dropdown
      menu={getSessionMenu(session)}
      trigger={['contextMenu']}
    >
      <div className="session-node">
        <div className="session-info">
          <span className="session-title">
            <span className="session-name">{session.name || '未命名会话'}</span>
            <span className="session-subtitle">
              {`${session.username}@${session.host}:${session.port}`}
            </span>
          </span>
        </div>
        <div className="session-actions">
          <Space size="small">
            <Button
              type="primary"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.({...session, type: 'terminal'});
              }}
            >
              终端
            </Button>
            <Button
              type="default"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.({...session, type: 'monitor'});
              }}
            >
              监控
            </Button>
          </Space>
        </div>
      </div>
    </Dropdown>
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
        expanded: ungroupedExpanded,
        children: (groupedSessions.get(undefined) || [])
          .filter(session => 
            !searchText || 
            session.name?.toLowerCase().includes(searchText.toLowerCase()) ||
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
              session.name?.toLowerCase().includes(searchText.toLowerCase()) ||
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
      // 只选中会话，不触发连接
      // const session = sessions.find(s => s.id === sessionId);
      // if (session) {
      //   onSelect?.(session);
      // }
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

      // 判断拖拽的是分组还是会话
      const isDragGroup = groups.find(g => g.id === dragKey);
      const isDropGroup = groups.find(g => g.id === dropKey) || dropKey === 'ungrouped';
      const isDragSession = sessions.find(s => s.id === dragKey);

      if (isDragGroup) {
        // 拖拽的是分组 - 只允许分组间的重新排序
        if (isDropGroup) {
          newGroups = reorderGroups(dragKey, dropKey, dropPosition);
          await storageService.saveGroups(newGroups);
          setGroups(newGroups);
        } else {
          message.warning('分组只能拖拽到其他分组位置');
          return;
        }
      } else if (isDragSession) {
        // 拖拽的是会话
        if (isDropGroup) {
          // 拖拽到分组或未分组
          const targetGroup = dropKey === 'ungrouped' ? undefined : dropKey;
          newSessions = reorderSessions(dragKey, targetGroup);
          await storageService.saveSessions(newSessions);
          setSessions(newSessions);
        } else {
          // 拖拽到另一个会话 - 不允许此操作
          message.warning('不能将会话拖拽到另一个会话下');
          return;
        }
      } else {
        message.error('无效的拖拽操作');
        return;
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
    
    // 重新计算所有分组的order
    return newGroups.map((group, index) => ({
      ...group,
      order: index
    }));
  };

  // 重新排序会话
  const reorderSessions = (dragKey: string, targetGroup: string | undefined): SessionInfo[] => {
    const newSessions = [...sessions];
    const draggedSession = sessions.find(s => s.id === dragKey);
    if (!draggedSession) {
      console.error(`找不到要拖拽的会话: ${dragKey}`);
      return newSessions;
    }

    // 验证目标分组的有效性
    if (targetGroup && !groups.find(g => g.id === targetGroup)) {
      console.error(`目标分组不存在: ${targetGroup}`);
      return newSessions;
    }

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
      
      // 处理会话数据
      const sessionData = {
        ...values,
        status: 'disconnected'
      };
      
      if (editingSession) {
        newSessions = sessions.map(s => 
          s.id === editingSession.id 
            ? { ...s, ...sessionData }
            : s
        );
        message.success('会话已更新');
      } else {
        const newSession: SessionInfo = {
          id: Date.now().toString(),
          ...sessionData
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
        <div className="session-list-header">
          <div className="session-list-actions">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddSession}
              size="small"
            >
              新建会话
            </Button>
            <Button
              icon={<FolderOutlined />}
              onClick={handleAddGroup}
              size="small"
            >
              新建分组
            </Button>
          </div>
          <Search
            placeholder="搜索会话..."
            allowClear
            onChange={e => debouncedSearch(e.target.value)}
            style={{ width: 180 }}
            size="small"
          />
        </div>

        <Tree
          className="session-tree"
          treeData={treeData}
          showLine={false}
          showIcon
          icon={({ expanded }: { expanded?: boolean }) => expanded ? <FolderOpenOutlined /> : <FolderOutlined />}
          draggable
          onSelect={handleSelect}
          onDrop={handleTreeDrop}
          expandedKeys={[
            ...(ungroupedExpanded ? ['ungrouped'] : []),
            ...groups.filter(g => g.expanded).map(g => g.id)
          ]}
          onExpand={(expandedKeys) => {
            // 处理未分组的展开状态
            const isUngroupedExpanded = expandedKeys.includes('ungrouped');
            setUngroupedExpanded(isUngroupedExpanded);

            // 处理分组的展开状态
            const newGroups = groups.map(g => ({
              ...g,
              expanded: expandedKeys.includes(g.id),
              order: g.order || groups.indexOf(g)
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
          width={900}
        >
          <Form
            form={sessionForm}
            layout="vertical"
            initialValues={{
              port: 22,
              authType: 'password'
            }}
          >
            <Typography.Title level={5}>基本配置</Typography.Title>
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