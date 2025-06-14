import React, { useState } from 'react';
import {
  Modal,
  Radio,
  Space,
  Typography,
  Switch,
  Alert,
  Empty
} from 'antd';
import { 
  FileOutlined, 
  EditOutlined,
  StarFilled,
  SettingOutlined
} from '@ant-design/icons';
import type { 
  EditorSelectorDialogProps, 
  EditorConfig 
} from '../types/ExternalEditorTypes';
import { unifiedEditorConfig } from '../config/UnifiedEditorConfig';
import * as path from 'path';

const { Text: AntText, Title } = Typography;

export const EditorSelectorDialog: React.FC<EditorSelectorDialogProps> = ({
  visible,
  file,
  editors,
  onSelect,
  onCancel
}) => {
  const [selectedEditorId, setSelectedEditorId] = useState<string>('');
  const [rememberChoice, setRememberChoice] = useState(false);
  const [recommendedEditor, setRecommendedEditor] = useState<EditorConfig | undefined>();

  // 获取文件扩展名
  const getFileExtension = (fileName: string): string => {
    return path.extname(fileName).replace(/^\./, '').toLowerCase();
  };

  // 获取推荐编辑器
  const getRecommendedEditor = async (): Promise<EditorConfig | undefined> => {
    // 首先检查文件关联
    const associatedEditor = await unifiedEditorConfig.getEditorForFile(file.name);
    if (associatedEditor) return associatedEditor;

    // 然后返回默认编辑器
    return await unifiedEditorConfig.getDefaultEditor();
  };

  // 初始化选中的编辑器
  React.useEffect(() => {
    if (visible && editors.length > 0) {
      const initializeEditor = async () => {
        try {
          const recommended = await getRecommendedEditor();
          setRecommendedEditor(recommended);

          if (recommended) {
            setSelectedEditorId(recommended.id);
          } else {
            setSelectedEditorId(editors[0].id);
          }

          // 根据配置决定是否默认记住选择
          const settings = await unifiedEditorConfig.getSettings();
          setRememberChoice(settings.rememberChoices);
        } catch (error) {
          console.error('[EditorSelectorDialog] 初始化失败:', error);
          setSelectedEditorId(editors[0].id);
        }
      };

      initializeEditor();
    }
  }, [visible, editors, file]);

  // 处理确认选择
  const handleConfirm = () => {
    if (!selectedEditorId) return;
    
    onSelect(selectedEditorId, rememberChoice);
  };

  // 处理取消
  const handleCancel = () => {
    setSelectedEditorId('');
    setRememberChoice(false);
    onCancel();
  };

  // 渲染编辑器选项
  const renderEditorOption = (editor: EditorConfig) => {
    const isRecommended = recommendedEditor?.id === editor.id;
    
    return (
      <div key={editor.id} className="editor-option">
        <div className="editor-info">
          <Space>
            <AntText strong>{editor.name}</AntText>
            {editor.isDefault && <StarFilled style={{ color: '#faad14' }} />}
            {isRecommended && <AntText type="success">(推荐)</AntText>}
          </Space>
          <div>
            <AntText type="secondary" style={{ fontSize: '12px' }}>
              {editor.executablePath}
            </AntText>
          </div>
          {editor.arguments && (
            <div>
              <AntText type="secondary" style={{ fontSize: '12px' }}>
                参数: {editor.arguments}
              </AntText>
            </div>
          )}
        </div>
      </div>
    );
  };

  const fileExtension = getFileExtension(file.name);

  return (
    <Modal
      title={
        <Space>
          <EditOutlined />
          <span>选择外部编辑器</span>
        </Space>
      }
      open={visible}
      onOk={handleConfirm}
      onCancel={handleCancel}
      okText="打开"
      cancelText="取消"
      width={500}
      okButtonProps={{
        disabled: !selectedEditorId
      }}
    >
      <div className="editor-selector-content">
        {/* 文件信息 */}
        <div className="file-info" style={{ marginBottom: 16 }}>
          <Space>
            <FileOutlined />
            <AntText strong>文件: {file.name}</AntText>
          </Space>
          {fileExtension && (
            <div style={{ marginTop: 4 }}>
              <AntText type="secondary" style={{ fontSize: '12px' }}>
                文件类型: .{fileExtension}
              </AntText>
            </div>
          )}
        </div>

        {/* 推荐信息 */}
        {recommendedEditor && (
          <Alert
            message={`推荐使用 ${recommendedEditor.name}`}
            description="推荐使用此编辑器"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {/* 编辑器选择 */}
        <div style={{ marginBottom: 16 }}>
          <Title level={5}>选择编辑器:</Title>
          {editors.length > 0 ? (
            <Radio.Group
              value={selectedEditorId}
              onChange={(e) => setSelectedEditorId(e.target.value)}
              style={{ width: '100%' }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                {editors.map((editor) => (
                  <Radio key={editor.id} value={editor.id} style={{ width: '100%' }}>
                    {renderEditorOption(editor)}
                  </Radio>
                ))}
              </Space>
            </Radio.Group>
          ) : (
            <Empty
              description="暂无配置的编辑器"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </div>

        {/* 记住选择 */}
        {fileExtension && editors.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <Space>
              <Switch
                checked={rememberChoice}
                onChange={setRememberChoice}
                size="small"
              />
              <AntText>记住 .{fileExtension} 文件的选择</AntText>
            </Space>
          </div>
        )}

        {/* 操作说明 */}
        <Alert
          message="操作说明"
          description={
            <div style={{ fontSize: '12px' }}>
              <p>• 文件将下载到本地临时目录进行编辑</p>
              <p>• 使用选择的编辑器打开文件</p>
              <p>• 保存后会自动上传到服务器</p>
              <p>• 可以在设置中配置更多编辑器</p>
            </div>
          }
          type="info"
          showIcon
        />
      </div>

      <style jsx>{`
        .editor-selector-content {
          padding: 0;
        }
        
        .file-info {
          padding: 12px;
          background-color: #f8f9fa;
          border-radius: 6px;
          border-left: 4px solid #1890ff;
        }
        
        .editor-option {
          width: 100%;
          padding: 8px 0;
        }
        
        .editor-info {
          width: 100%;
        }
        
        .ant-radio-wrapper {
          width: 100%;
          margin-right: 0;
        }
        
        .ant-radio {
          align-self: flex-start;
          margin-top: 2px;
        }
      `}</style>
    </Modal>
  );
};
