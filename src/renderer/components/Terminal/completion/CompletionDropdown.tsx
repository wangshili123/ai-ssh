import React, { MutableRefObject, useEffect, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { ICompletionSuggestion } from '../hooks/useCompletion';
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
}

const CompletionDropdown: React.FC<CompletionDropdownProps> = ({
  visible,
  suggestions,
  selectedIndex,
  position,
  onSelect,
  terminalRef,
}) => {
  const [fixedPosition, setFixedPosition] = useState({ left: 0, top: 0 });

  useEffect(() => {
    if (visible && terminalRef.current) {
      const terminal = terminalRef.current;
      const element = terminal.element;
      if (!element) return;

      // 获取终端元素相对于视口的位置
      const rect = element.getBoundingClientRect();
      
      // 计算下拉框的绝对位置
      const absoluteLeft = rect.left + position.left;
      const absoluteTop = rect.top + position.top;

      setFixedPosition({
        left: absoluteLeft,
        top: absoluteTop
      });
    }
  }, [visible, position, terminalRef]);

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