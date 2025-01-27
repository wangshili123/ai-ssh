import React, { MutableRefObject } from 'react';
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
  if (!visible || suggestions.length === 0) {
    return null;
  }

  // 创建下拉框内容
  const dropdownContent = (
    <div 
      className="completion-dropdown"
      style={{
        position: 'absolute',
        left: `${position.left}px`,
        top: `${position.top}px`,
        zIndex: 99999,
        pointerEvents: 'auto'
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

  return dropdownContent;
};

export default CompletionDropdown; 