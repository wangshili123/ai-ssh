# 文件编码切换功能实现计划

## 一、功能概述

实现文件编码动态切换功能，允许用户在查看或编辑远程文件时选择不同的字符编码，确保正确显示各种语言的文本内容。同时提供编码自动检测功能，提高用户体验。

## 二、需求分析

### 1. 核心需求

- **编码切换**：允许用户手动切换文件编码
- **编码检测**：自动检测文件可能的编码
- **多种编码支持**：支持常见的编码格式（UTF-8、UTF-16、ASCII、GB18030等）
- **持久化**：记住特定文件的编码设置
- **实时预览**：切换编码时实时预览文件内容变化

### 2. 用户场景

- **查看含有中文字符的日志文件**：系统默认可能使用UTF-8编码，而实际文件可能是GB18030编码
- **查看多语言文件**：包含特殊字符或多种语言的文件可能需要特定编码
- **编辑配置文件**：确保使用正确的编码保存，防止乱码

## 三、技术方案

### 1. 编码管理器设计

创建 `EncodingManager` 类：
- 提供编码列表
- 实现编码检测算法
- 管理编码持久化
- 提供编码转换功能

### 2. 与现有组件集成

- 在 `FileLoaderManager` 中添加编码处理
- 在 `BrowseMode` 和 `EditMode` 中添加编码切换方法
- 添加编码切换的 UI 组件

### 3. UI 设计

- 工具栏添加编码选择下拉菜单
- 提供编码自动检测按钮
- 显示当前编码状态

## 四、实现步骤

### 第一步：创建 EncodingManager 类

```typescript
export class EncodingManager {
  // 支持的编码列表
  private supportedEncodings: string[] = [
    'utf8', 'utf16le', 'ascii', 'latin1', 'gb18030', 'big5', 'euc-kr', 'shift-jis'
  ];
  
  // 当前编码
  private currentEncoding: string = 'utf8';
  
  // 编码记忆表
  private encodingMemory: Map<string, string> = new Map();
  
  /**
   * 获取支持的编码列表
   */
  public getSupportedEncodings(): string[] {
    return [...this.supportedEncodings];
  }
  
  /**
   * 设置当前编码
   */
  public setEncoding(encoding: string): void {
    if (this.supportedEncodings.includes(encoding)) {
      this.currentEncoding = encoding;
    }
  }
  
  /**
   * 获取当前编码
   */
  public getCurrentEncoding(): string {
    return this.currentEncoding;
  }
  
  /**
   * 记住文件的编码
   */
  public rememberEncoding(filePath: string, encoding: string): void {
    this.encodingMemory.set(filePath, encoding);
  }
  
  /**
   * 获取文件记忆的编码
   */
  public getRememberedEncoding(filePath: string): string | undefined {
    return this.encodingMemory.get(filePath);
  }
  
  /**
   * 检测内容可能的编码
   * 使用启发式算法检测编码
   */
  public detectEncoding(content: Buffer): string {
    // 实现编码检测算法
    // 可以使用 chardet 或实现简单的启发式算法
    return 'utf8'; // 默认返回 UTF-8
  }
}
```

### 第二步：添加 UI 组件

创建 `EncodingSelector` 组件：

```tsx
interface EncodingSelectorProps {
  currentEncoding: string;
  onEncodingChange: (encoding: string) => void;
  onDetectEncoding: () => void;
  supportedEncodings: string[];
}

const EncodingSelector: React.FC<EncodingSelectorProps> = ({
  currentEncoding,
  onEncodingChange,
  onDetectEncoding,
  supportedEncodings
}) => {
  return (
    <div className="encoding-selector">
      <select 
        value={currentEncoding}
        onChange={(e) => onEncodingChange(e.target.value)}
      >
        {supportedEncodings.map(encoding => (
          <option key={encoding} value={encoding}>
            {encoding.toUpperCase()}
          </option>
        ))}
      </select>
      <button onClick={onDetectEncoding}>
        检测编码
      </button>
    </div>
  );
};
```

### 第三步：修改 FileLoaderManager

```typescript
// 在 FileLoaderManager 中添加编码支持
import { EncodingManager } from './EncodingManager';

export class FileLoaderManager {
  // 现有代码...
  private encodingManager: EncodingManager;
  
  constructor() {
    // 现有代码...
    this.encodingManager = new EncodingManager();
  }
  
  /**
   * 设置编码
   */
  public setEncoding(encoding: string): void {
    this.encodingManager.setEncoding(encoding);
    // 重新加载文件
    this.reloadWithEncoding();
  }
  
  /**
   * 使用新编码重新加载
   */
  private async reloadWithEncoding(): Promise<void> {
    if (!this.currentFile) return;
    
    try {
      // 使用新编码加载文件
      const content = await this.readFileWithEncoding(
        this.currentFile,
        this.encodingManager.getCurrentEncoding()
      );
      
      // 触发重新加载事件
      this.emit(EditorEvents.FILE_LOADED, {
        content,
        encoding: this.encodingManager.getCurrentEncoding()
      });
    } catch (error) {
      // 处理错误
    }
  }
  
  /**
   * 使用指定编码读取文件
   */
  private async readFileWithEncoding(
    filePath: string,
    encoding: string
  ): Promise<string> {
    // 实现读取文件内容的逻辑
    return '';
  }
}
```

### 第四步：修改浏览模式和编辑模式

- 在 `BrowseMode` 和 `EditMode` 中添加编码切换方法
- 处理不同编码下的文件内容显示

### 第五步：集成到编辑器组件

- 在编辑器工具栏中添加编码选择器
- 处理编码切换事件
- 保存用户编码选择

## 五、测试计划

### 1. 单元测试
- 测试编码检测功能
- 测试编码转换功能
- 测试记忆功能

### 2. 集成测试
- 测试编码切换后内容显示
- 测试自动检测功能
- 测试与编辑/浏览模式的集成

### 3. 用户场景测试
- 测试多语言文件显示
- 测试特殊字符处理
- 测试大文件性能

## 六、可能的问题与解决方案

| 问题 | 解决方案 |
|------|----------|
| 编码检测不准确 | 使用成熟的字符编码检测库，如 chardet |
| 切换编码性能问题 | 仅重新加载可视区域，实现虚拟化 |
| 保存时编码问题 | 提供明确的保存编码选项，警告不兼容情况 |
| 不支持的编码 | 提供自定义编码选项，说明可能的风险 |

## 七、时间估计

1. 设计和实现基础功能：1天
2. UI组件和集成：1天
3. 测试和优化：1天

总计：3个工作日

## 八、扩展计划

如果时间允许，可以考虑以下扩展功能：

1. 添加编码转换工具，允许将文件从一种编码转换为另一种
2. 提供编码问题自动修复建议
3. 添加特定语言的编码预设（中文、日语、韩语等）
4. 实现更高级的编码检测算法，提高准确率 