import React, { useState, useEffect, useRef } from 'react';

interface ResizableTitleProps {
  onResizeStop?: (width: number) => void;
  width?: number;
  columnIndex?: number;
  containerRef?: React.RefObject<HTMLDivElement>;
  [key: string]: any;
}

/**
 * 原生实现的可调整大小列头组件
 */
export const ResizableTitle: React.FC<ResizableTitleProps> = (props) => {
  const { onResizeStop, width, columnIndex, containerRef, ...restProps } = props;
  const [isResizing, setIsResizing] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  if (!width) {
    return <th {...restProps} />;
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsResizing(true);
    setStartX(e.clientX);
    setStartWidth(width);

    console.log('[ResizableTitle] 开始拖拽:', { startX: e.clientX, startWidth: width });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;

    const deltaX = e.clientX - startX;
    const newWidth = Math.max(startWidth + deltaX, 50); // 最小宽度50px

    console.log('[ResizableTitle] 拖拽中:', { deltaX, newWidth });

    // 直接操作DOM提供视觉反馈，不更新React状态
    if (containerRef?.current && typeof columnIndex === 'number') {
      const table = containerRef.current.querySelector('.ant-table-content table');
      if (table) {
        // 更新表头
        const headerCells = table.querySelectorAll('.ant-table-thead th');
        const headerCell = headerCells[columnIndex] as HTMLElement;
        if (headerCell) {
          headerCell.style.width = `${newWidth}px`;
          headerCell.style.minWidth = `${newWidth}px`;
          headerCell.style.maxWidth = `${newWidth}px`;
        }

        // 更新表体
        const bodyRows = table.querySelectorAll('.ant-table-tbody tr');
        bodyRows.forEach((row: any) => {
          const cells = row.querySelectorAll('td');
          const cell = cells[columnIndex] as HTMLElement;
          if (cell) {
            cell.style.width = `${newWidth}px`;
            cell.style.minWidth = `${newWidth}px`;
            cell.style.maxWidth = `${newWidth}px`;
          }
        });
      }
    }
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (!isResizing) return;

    setIsResizing(false);

    const deltaX = e.clientX - startX;
    const finalWidth = Math.max(startWidth + deltaX, 50);

    console.log('[ResizableTitle] 拖拽结束:', {
      startX,
      endX: e.clientX,
      deltaX,
      startWidth,
      finalWidth
    });

    if (onResizeStop) {
      onResizeStop(finalWidth);
    }
  };

  // 添加全局鼠标事件监听
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, startX, startWidth]);

  return (
    <th {...restProps} style={{ position: 'relative', ...restProps.style }}>
      {restProps.children}
      <div
        className="file-list-resize-handle-native"
        onMouseDown={handleMouseDown}
        style={{
          position: 'absolute',
          right: '-2px',
          top: 0,
          bottom: 0,
          width: '4px',
          cursor: 'col-resize',
          backgroundColor: 'transparent',
          zIndex: 999,
        }}
      />
    </th>
  );
};
