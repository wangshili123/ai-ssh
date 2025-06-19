import { useCallback } from 'react';
import { message } from 'antd';
import type { FileEntry } from '../../../../../main/types/file';
import type { SessionInfo } from '../../../../types';
import { sftpConnectionManager } from '../../../../services/sftpConnectionManager';

interface UseFileOperationsProps {
  tabId: string;
  currentPath: string;
  fileList: FileEntry[];
  onFileListChange: (files: FileEntry[]) => void;
  sortedInfo: any;
}

interface FileOperationsResult {
  updateFileListWithNewFile: (fileName: string, overwrite: boolean) => Promise<void>;
  insertFileInSortedOrder: (currentList: FileEntry[], newFile: FileEntry) => FileEntry[];
  highlightFile: (fileName: string, setHighlightedFiles: React.Dispatch<React.SetStateAction<Set<string>>>) => void;
  scrollToFile: (fileName: string, fileListToUse: FileEntry[], containerRef: React.RefObject<HTMLDivElement>) => void;
}

export const useFileOperations = ({
  tabId,
  currentPath,
  fileList,
  onFileListChange,
  sortedInfo
}: UseFileOperationsProps): FileOperationsResult => {

  // 智能更新文件列表，添加新上传的文件
  const updateFileListWithNewFile = useCallback(async (fileName: string, overwrite: boolean) => {
    try {
      console.log('[FileOperations] 开始更新文件列表，新文件:', fileName);

      // 从服务器获取新文件的详细信息
      const files = await sftpConnectionManager.readDirectory(tabId, currentPath, true);
      const newFile = files.find(f => f.name === fileName);

      if (!newFile) {
        console.warn('[FileOperations] 未找到新上传的文件:', fileName);
        return;
      }

      console.log('[FileOperations] 找到新文件信息:', newFile);

      // 检查文件是否已存在（覆盖情况）
      const existingIndex = fileList.findIndex(f => f.name === fileName);
      let updatedFileList: FileEntry[];

      if (existingIndex !== -1) {
        // 文件已存在，更新现有文件信息
        console.log('[FileOperations] 更新现有文件:', fileName);
        updatedFileList = [...fileList];
        updatedFileList[existingIndex] = newFile;
      } else {
        // 新文件，按排序规则插入到正确位置
        console.log('[FileOperations] 插入新文件:', fileName);
        updatedFileList = insertFileInSortedOrder([...fileList], newFile);
      }

      // 更新文件列表
      onFileListChange(updatedFileList);

    } catch (error) {
      console.error('[FileOperations] 更新文件列表失败:', error);
    }
  }, [tabId, currentPath, fileList, onFileListChange, sortedInfo]);

  // 按当前排序规则插入文件到正确位置
  const insertFileInSortedOrder = useCallback((currentList: FileEntry[], newFile: FileEntry): FileEntry[] => {
    const { columnKey, order } = sortedInfo;

    // 如果没有排序，使用默认排序（目录优先，然后按名称）
    if (!columnKey || !order) {
      // 默认排序：目录优先，名称升序
      const insertIndex = currentList.findIndex(file => {
        if (newFile.isDirectory !== file.isDirectory) {
          return !newFile.isDirectory; // 目录排在前面
        }
        return newFile.name.localeCompare(file.name) < 0;
      });

      if (insertIndex === -1) {
        return [...currentList, newFile];
      } else {
        return [
          ...currentList.slice(0, insertIndex),
          newFile,
          ...currentList.slice(insertIndex)
        ];
      }
    }

    // 根据当前排序规则插入
    const insertIndex = currentList.findIndex(file => {
      let comparison = 0;

      switch (columnKey) {
        case 'name':
          // 目录优先排序
          if (newFile.isDirectory !== file.isDirectory) {
            comparison = newFile.isDirectory ? -1 : 1;
          } else {
            comparison = newFile.name.localeCompare(file.name);
          }
          break;
        case 'size':
          comparison = newFile.size - file.size;
          break;
        case 'modifyTime':
          comparison = newFile.modifyTime - file.modifyTime;
          break;
        default:
          comparison = newFile.name.localeCompare(file.name);
      }

      return order === 'ascend' ? comparison < 0 : comparison > 0;
    });

    if (insertIndex === -1) {
      return [...currentList, newFile];
    } else {
      return [
        ...currentList.slice(0, insertIndex),
        newFile,
        ...currentList.slice(insertIndex)
      ];
    }
  }, [sortedInfo]);

  // 高亮显示文件
  const highlightFile = useCallback((fileName: string, setHighlightedFiles: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    setHighlightedFiles(prev => new Set([...prev, fileName]));

    // 3秒后移除高亮
    setTimeout(() => {
      setHighlightedFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileName);
        return newSet;
      });
    }, 3000);
  }, []);

  // 滚动到指定文件
  const scrollToFile = useCallback((fileName: string, fileListToUse: FileEntry[], containerRef: React.RefObject<HTMLDivElement>) => {
    const index = fileListToUse.findIndex(file => file.name === fileName);
    if (index !== -1) {
      console.log('[FileOperations] 滚动到文件:', fileName, '索引:', index);

      // 计算滚动位置（每行大约32px高度）
      const rowHeight = 32;
      const scrollTop = index * rowHeight;

      // 获取表格的滚动容器
      const tableBody = containerRef.current?.querySelector('.ant-table-body');
      if (tableBody) {
        tableBody.scrollTop = scrollTop;
        console.log('[FileOperations] 已滚动到位置:', scrollTop);
      }
    }
  }, []);

  return {
    updateFileListWithNewFile,
    insertFileInSortedOrder,
    highlightFile,
    scrollToFile
  };
};
