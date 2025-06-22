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
  const thRef = useRef<HTMLTableCellElement>(null);

  if (!width) {
    return <th {...restProps} />;
  }

  // 强制设置表头宽度 + 操作colgroup
  useEffect(() => {
    if (thRef.current && width && typeof columnIndex === 'number') {
      console.log(`[ResizableTitle] 列${columnIndex} 设置宽度:`, {
        width,
        element: thRef.current,
        currentStyle: {
          width: thRef.current.style.width,
          minWidth: thRef.current.style.minWidth,
          maxWidth: thRef.current.style.maxWidth,
          computedWidth: window.getComputedStyle(thRef.current).width
        }
      });

      // 方法1：设置th样式
      thRef.current.style.setProperty('width', `${width}px`, 'important');
      thRef.current.style.setProperty('min-width', `${width}px`, 'important');
      thRef.current.style.setProperty('max-width', `${width}px`, 'important');

      // 方法2：操作colgroup + 确保表格总宽度
      const table = thRef.current.closest('table');
      if (table && containerRef?.current) {
        let colgroup = table.querySelector('colgroup');
        if (!colgroup) {
          // 如果没有colgroup，创建一个
          colgroup = document.createElement('colgroup');
          table.insertBefore(colgroup, table.firstChild);
        }

        // 动态检测表头结构
        const headerCells = table.querySelectorAll('.ant-table-thead th');
        const totalHeaderCols = headerCells.length;

        // 获取当前所有列宽
        const allColumnWidths = containerRef.current.getAttribute('data-column-widths');
        let widths = [120, 80, 60, 140, 90, 110]; // 默认宽度

        if (allColumnWidths) {
          try {
            widths = JSON.parse(allColumnWidths);
          } catch (e) {
            // 使用默认值
          }
        }

        // 更新当前列的宽度
        widths[columnIndex] = width;

        // 清空并重建colgroup
        colgroup.innerHTML = '';

        // 分析表头结构，为每一列设置宽度
        for (let i = 0; i < totalHeaderCols; i++) {
          const col = document.createElement('col');
          const headerCell = headerCells[i] as HTMLElement;

          // 判断列类型并设置宽度
          if (headerCell.classList.contains('ant-table-selection-column')) {
            // 选择框列
            col.style.width = '32px';
            col.style.minWidth = '32px';
          } else if (headerCell.classList.contains('ant-table-cell-scrollbar')) {
            // 滚动条占位列 - 设置为0宽度，因为使用浮动滚动条
            col.style.width = '0px';
            col.style.minWidth = '0px';
            col.style.display = 'none'; // 完全隐藏
          } else {
            // 数据列 - 找到对应的数据列索引
            const dataColumnIndex = Array.from(headerCells).slice(0, i).filter(
              (cell: any) => !cell.classList.contains('ant-table-selection-column') &&
                           !cell.classList.contains('ant-table-cell-scrollbar')
            ).length;

            if (dataColumnIndex < widths.length) {
              col.style.width = `${widths[dataColumnIndex]}px`;
              col.style.minWidth = `${widths[dataColumnIndex]}px`;
            } else {
              // 额外的列，设置默认宽度
              col.style.width = '50px';
              col.style.minWidth = '50px';
            }
          }

          colgroup.appendChild(col);
        }

        // 计算表格总宽度
        const totalWidth = Array.from(colgroup.children).reduce((sum, col: any) => {
          return sum + parseInt(col.style.width || '0');
        }, 0);

        table.style.width = `${totalWidth}px`;
        table.style.minWidth = `${totalWidth}px`;

        console.log(`[ResizableTitle] 设置完整表格宽度:`, {
          列宽: widths,
          总宽度: totalWidth,
          当前列: columnIndex,
          当前列宽: width,
          实际表头数量: table.querySelectorAll('.ant-table-thead th').length,
          colgroup列数: colgroup.children.length,
          表格设置前宽度: table.style.width,
          表格设置后宽度: `${totalWidth}px`
        });

        // 强制刷新表格布局
        table.style.display = 'none';
        table.offsetHeight; // 触发重排
        table.style.display = '';
      }

      // 设置后再次检查 + 详细CSS分析
      setTimeout(() => {
        if (thRef.current) {
          const computedStyle = window.getComputedStyle(thRef.current);
          const allStyles = {
            width: computedStyle.width,
            minWidth: computedStyle.minWidth,
            maxWidth: computedStyle.maxWidth,
            display: computedStyle.display,
            boxSizing: computedStyle.boxSizing,
            tableLayout: computedStyle.tableLayout,
            position: computedStyle.position
          };

          console.log(`[ResizableTitle] 列${columnIndex} 详细CSS分析:`, {
            设置的width: width,
            内联样式: {
              width: thRef.current.style.width,
              minWidth: thRef.current.style.minWidth,
              maxWidth: thRef.current.style.maxWidth,
            },
            计算后样式: allStyles,
            父元素信息: {
              parentTagName: thRef.current.parentElement?.tagName,
              parentClass: thRef.current.parentElement?.className,
              tableElement: thRef.current.closest('table')?.style.tableLayout
            }
          });

          // 尝试强制刷新布局
          thRef.current.style.display = 'none';
          thRef.current.offsetHeight; // 触发重排
          thRef.current.style.display = '';
        }
      }, 100);
    }
  }, [width, columnIndex]);

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

    console.log(`[ResizableTitle] 列${columnIndex} 拖拽中:`, {
      deltaX,
      newWidth,
      currentThWidth: thRef.current ? window.getComputedStyle(thRef.current).width : 'N/A'
    });

    // 直接操作DOM提供视觉反馈，同时更新当前表头
    if (containerRef?.current && typeof columnIndex === 'number') {
      const table = containerRef.current.querySelector('.ant-table-content table');
      if (table) {
        // 更新表头 - 包括当前正在拖拽的表头
        const headerCells = table.querySelectorAll('.ant-table-thead th');
        const headerCell = headerCells[columnIndex] as HTMLElement;
        if (headerCell) {
          headerCell.style.width = `${newWidth}px !important`;
          headerCell.style.minWidth = `${newWidth}px !important`;
          headerCell.style.maxWidth = `${newWidth}px !important`;
        }

        // 更新表体
        const bodyRows = table.querySelectorAll('.ant-table-tbody tr');
        bodyRows.forEach((row: any) => {
          const cells = row.querySelectorAll('td');
          const cell = cells[columnIndex] as HTMLElement;
          if (cell) {
            cell.style.width = `${newWidth}px !important`;
            cell.style.minWidth = `${newWidth}px !important`;
            cell.style.maxWidth = `${newWidth}px !important`;
          }
        });
      }
    }

    // 同时更新当前th元素的样式
    const currentTh = document.querySelector(`th[data-column-index="${columnIndex}"]`) as HTMLElement;
    if (currentTh) {
      currentTh.style.width = `${newWidth}px !important`;
      currentTh.style.minWidth = `${newWidth}px !important`;
      currentTh.style.maxWidth = `${newWidth}px !important`;
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
    <th
      {...restProps}
      ref={thRef}
      data-column-index={columnIndex}
      style={{
        position: 'relative',
        width: `${width}px`,
        minWidth: `${width}px`,
        maxWidth: `${width}px`,
        ...restProps.style
      }}
    >
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
