import React, { MutableRefObject, useEffect, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { ICompletionSuggestion } from '../hooks/useCompletion';
import { CompletionService } from '../../../../services/completion/CompletionService';
import './CompletionDropdown.css';

interface CompletionDropdownProps {
  visible: boolean;
  suggestions: ICompletionSuggestion[];
  selectedIndex: number;
  position: {
    left: number;
    top: number;
  };
  onSelect: (suggestion: ICompletionSuggestion) => void;
  terminalRef: MutableRefObject<XTerm | null>;
  navigateSuggestions: (direction: 'up' | 'down') => void;
  completionService: CompletionService | null;
}

const CompletionDropdown: React.FC<CompletionDropdownProps> = ({
  visible,
  suggestions,
  selectedIndex,
  position,
  onSelect,
  terminalRef,
  navigateSuggestions,
  completionService,
}) => {
  const [fixedPosition, setFixedPosition] = useState({ left: 0, top: 0 });

  useEffect(() => {
    if (visible && terminalRef.current) {
      const terminal = terminalRef.current;
      const element = terminal.element;
      if (!element) return;

      // 获取终端元素相对于视口的位置
      const rect = element.getBoundingClientRect();
      
      // 计算下拉框的位置（相对于视口）
      let absoluteLeft = position.left;
      let absoluteTop = position.top;

      // 确保下拉框不会超出视口
      const dropdownWidth = 400; // max-width from CSS
      const dropdownHeight = 300; // max-height from CSS

      console.log('[CompletionDropdown] absoluteLeft,absoluteTop:', {absoluteLeft,absoluteTop});

      setFixedPosition({
        left: Math.max(0, absoluteLeft),
        top: Math.max(0, absoluteTop)
      });
    }
  }, [visible, position, terminalRef]);

  // 添加键盘事件处理
  useEffect(() => {
    if (!visible || !terminalRef.current) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        switch (e.key) {
          case 'ArrowUp':
            e.preventDefault();
            e.stopPropagation();
            navigateSuggestions('up');
            if (completionService) {
              const newIndex = selectedIndex > 0 ? selectedIndex - 1 : suggestions.length - 1;
              completionService.setSelectedIndex(newIndex);
            }
            break;
          case 'ArrowDown':
            e.preventDefault();
            e.stopPropagation();
            navigateSuggestions('down');
            if (completionService) {
              const newIndex = selectedIndex < suggestions.length - 1 ? selectedIndex + 1 : 0;
              completionService.setSelectedIndex(newIndex);
            }
            break;
        }
      }
    };

    const terminal = terminalRef.current;
    terminal.element?.addEventListener('keydown', handleKeyDown, true);

    return () => {
      terminal.element?.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [visible, terminalRef, navigateSuggestions, completionService, selectedIndex, suggestions.length]);

  if (!visible || suggestions.length === 0) {
    return null;
  }

  return (
    <div 
      className="completion-dropdown"
      style={{
        left: `${fixedPosition.left}px`,
        top: `${fixedPosition.top}px`
      }}
    >
      {suggestions.map((suggestion, index) => (
        <div
          key={suggestion.fullCommand}
          className={`completion-item ${index === selectedIndex ? 'selected' : ''}`}
          onClick={() => onSelect(suggestion)}
        >
          <span className="command">{suggestion.fullCommand}</span>
          <span className="source">{suggestion.source}</span>
        </div>
      ))}
    </div>
  );
};

export default CompletionDropdown; 