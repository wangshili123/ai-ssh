import { FC } from 'react';
import type { Key } from 'rc-tree/lib/interface';
import type { SessionInfo } from '../../types';

interface DirectoryTreeProps {
  sessionInfo: SessionInfo;
  tabId: string;
  treeData: any[];
  expandedKeys: string[];
  loading: boolean;
  onExpand: (keys: Key[]) => void;
  onSelect: (path: string) => void;
}

declare const DirectoryTree: FC<DirectoryTreeProps>;

export default DirectoryTree; 