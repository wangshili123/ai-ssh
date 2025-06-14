import React, { useState, useRef, useEffect } from 'react';
import { Input, Modal, Typography } from 'antd';

const { Text } = Typography;

interface ShortcutInputProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * 快捷键输入组件 - 双击弹框监听修改
 */
export const ShortcutInput: React.FC<ShortcutInputProps> = ({
  value,
  onChange,
  placeholder,
  disabled = false
}) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [currentKeys, setCurrentKeys] = useState<string>('');
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());

  // 双击打开弹框
  const handleDoubleClick = () => {
    if (disabled) return;
    setIsModalVisible(true);
    setIsListening(false);
    setCurrentKeys('');
    setPressedKeys(new Set());
  };

  // 开始监听
  const startListening = () => {
    setIsListening(true);
    setCurrentKeys('');
    setPressedKeys(new Set());
  };

  // 停止监听并保存
  const stopListening = () => {
    setIsListening(false);
    if (currentKeys && onChange) {
      onChange(currentKeys);
    }
    setIsModalVisible(false);
  };

  // 取消监听
  const cancelListening = () => {
    setIsListening(false);
    setIsModalVisible(false);
    setCurrentKeys('');
    setPressedKeys(new Set());
  };

  // 清除快捷键
  const clearShortcut = () => {
    if (onChange) {
      onChange('');
    }
    setIsModalVisible(false);
  };

  // 处理键盘按下事件
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isListening) return;

    e.preventDefault();
    e.stopPropagation();

    const newPressedKeys = new Set(pressedKeys);

    // 添加当前按下的键
    if (e.ctrlKey) newPressedKeys.add('Ctrl');
    if (e.altKey) newPressedKeys.add('Alt');
    if (e.shiftKey) newPressedKeys.add('Shift');
    if (e.metaKey) newPressedKeys.add('Meta');

    // 添加主键（排除修饰键本身）
    if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
      let mainKey = e.key;

      // 特殊键名映射
      const keyMap: { [key: string]: string } = {
        ' ': 'Space',
        'ArrowUp': 'ArrowUp',
        'ArrowDown': 'ArrowDown',
        'ArrowLeft': 'ArrowLeft',
        'ArrowRight': 'ArrowRight',
        'Enter': 'Enter',
        'Escape': 'Escape',
        'Tab': 'Tab',
        'Backspace': 'Backspace',
        'Delete': 'Delete'
      };

      if (keyMap[mainKey]) {
        mainKey = keyMap[mainKey];
      }

      newPressedKeys.add(mainKey);
    }

    setPressedKeys(newPressedKeys);

    // 构建快捷键字符串
    const keys: string[] = [];
    const modifiers = ['Ctrl', 'Alt', 'Shift', 'Meta'];

    // 先添加修饰键
    modifiers.forEach(modifier => {
      if (newPressedKeys.has(modifier)) {
        keys.push(modifier);
      }
    });

    // 再添加主键
    const mainKeys = Array.from(newPressedKeys).filter(key => !modifiers.includes(key));
    keys.push(...mainKeys);

    if (keys.length > 0) {
      const shortcut = keys.join('+');
      setCurrentKeys(shortcut);
    }
  };

  // 处理键盘释放事件
  const handleKeyUp = (e: KeyboardEvent) => {
    if (!isListening) return;

    // 如果有完整的快捷键且所有键都释放了，则完成录制
    if (currentKeys && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
      setTimeout(() => {
        stopListening();
      }, 100);
    }
  };

  // 监听全局键盘事件
  useEffect(() => {
    if (isListening) {
      document.addEventListener('keydown', handleKeyDown, true);
      document.addEventListener('keyup', handleKeyUp, true);

      return () => {
        document.removeEventListener('keydown', handleKeyDown, true);
        document.removeEventListener('keyup', handleKeyUp, true);
      };
    }
  }, [isListening, pressedKeys, currentKeys]);

  return (
    <>
      <Input
        value={value || ''}
        placeholder={placeholder}
        readOnly
        onDoubleClick={handleDoubleClick}
        style={{
          cursor: disabled ? 'not-allowed' : 'pointer'
        }}
        disabled={disabled}
      />

      <Modal
        title="设置快捷键"
        open={isModalVisible}
        onOk={isListening ? stopListening : startListening}
        onCancel={cancelListening}
        okText={isListening ? '确定' : '开始录制'}
        cancelText="取消"
        width={400}
        footer={[
          <button key="clear" onClick={clearShortcut} style={{
            background: 'none',
            border: 'none',
            color: '#ff4d4f',
            cursor: 'pointer',
            marginRight: 'auto'
          }}>
            清除
          </button>,
          <button key="cancel" onClick={cancelListening} style={{
            marginLeft: '8px',
            padding: '4px 15px',
            border: '1px solid #d9d9d9',
            borderRadius: '6px',
            background: '#fff',
            cursor: 'pointer'
          }}>
            取消
          </button>,
          <button
            key="ok"
            onClick={isListening ? stopListening : startListening}
            style={{
              marginLeft: '8px',
              padding: '4px 15px',
              border: '1px solid #1890ff',
              borderRadius: '6px',
              background: '#1890ff',
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            {isListening ? '确定' : '开始录制'}
          </button>
        ]}
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          {!isListening ? (
            <div>
              <Text type="secondary">双击输入框或点击"开始录制"来设置快捷键</Text>
              {value && (
                <div style={{ marginTop: '16px' }}>
                  <Text>当前快捷键: </Text>
                  <Text code>{value}</Text>
                </div>
              )}
            </div>
          ) : (
            <div>
              <Text type="secondary">请按下您想要设置的快捷键组合</Text>
              <div style={{
                marginTop: '16px',
                padding: '12px',
                border: '2px dashed #1890ff',
                borderRadius: '6px',
                backgroundColor: '#f0f8ff',
                minHeight: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Text strong style={{ fontSize: '16px' }}>
                  {currentKeys || '等待按键...'}
                </Text>
              </div>
              <div style={{ marginTop: '12px' }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  按下快捷键后松开所有按键即可完成设置
                </Text>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};
