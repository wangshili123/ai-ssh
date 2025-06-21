# 📋 rsync 命令详解

## 🔧 基础参数说明

### 常用参数组合
```bash
rsync -avz --progress
```

#### 参数详解：
- `-a` (archive): 归档模式，等同于 `-rlptgoD`
  - `-r`: 递归处理目录
  - `-l`: 保持符号链接
  - `-p`: 保持权限
  - `-t`: 保持时间戳
  - `-g`: 保持组信息
  - `-o`: 保持所有者信息
  - `-D`: 保持设备文件和特殊文件

- `-v` (verbose): 详细输出模式
- `-z` (compress): 传输时压缩数据
- `--progress`: 显示传输进度

## 🚀 复制粘贴功能专用命令

### 1. 同会话内操作

#### 文件复制
```bash
# 单个文件复制
rsync -avz --progress "/source/path/file.txt" "/target/path/"

# 大文件复制（带断点续传）
rsync -avz --progress --partial "/source/path/large_file.txt" "/target/path/"

# 保持完整路径结构
rsync -avz --progress "/source/path/file.txt" "/target/path/file.txt"
```

#### 文件夹复制
```bash
# 复制整个目录内容（注意源路径末尾的斜杠）
rsync -avz --progress "/source/path/directory/" "/target/path/directory/"

# 复制目录本身到目标目录内
rsync -avz --progress "/source/path/directory" "/target/path/"

# 递归复制大目录（带详细输出）
rsync -avz --progress --stats "/source/path/directory/" "/target/path/directory/"
```

#### 文件移动（剪切）
```bash
# 单个文件移动
rsync -avz --progress --remove-source-files "/source/path/file.txt" "/target/path/"

# 文件夹移动（需要额外删除空目录）
rsync -avz --progress --remove-source-files "/source/path/directory/" "/target/path/directory/"
find "/source/path/directory" -type d -empty -delete

# 简化的文件夹移动命令（一行完成）
rsync -avz --progress --remove-source-files "/source/path/directory/" "/target/path/directory/" && find "/source/path/directory" -type d -empty -delete
```

#### 批量文件操作
```bash
# 批量文件复制（分别执行，便于进度监控）
rsync -avz --progress "/source/path/file1.txt" "/target/path/"
rsync -avz --progress "/source/path/file2.txt" "/target/path/"
rsync -avz --progress "/source/path/file3.txt" "/target/path/"

# 批量文件移动
rsync -avz --progress --remove-source-files "/source/path/file1.txt" "/target/path/"
rsync -avz --progress --remove-source-files "/source/path/file2.txt" "/target/path/"
rsync -avz --progress --remove-source-files "/source/path/file3.txt" "/target/path/"
```

#### 同会话内rsync的优势
- **统一进度格式**: 所有操作都有一致的进度显示
- **本地优化**: rsync会自动检测本地操作并优化性能
- **增量复制**: 如果目标文件已存在，只复制差异部分
- **断点续传**: 大文件操作支持中断后继续
- **属性保持**: 自动保持文件的所有属性和权限
- **错误恢复**: 内置的错误处理和重试机制

### 2. 跨会话操作

#### 基本跨服务器复制
```bash
# 文件复制
rsync -avz --progress user@source_host:/path/to/file user@target_host:/path/to/target/

# 文件夹复制
rsync -avz --progress user@source_host:/path/to/directory/ user@target_host:/path/to/target/
```

#### 使用SSH密钥
```bash
# 指定SSH密钥
rsync -avz --progress -e "ssh -i ~/.ssh/id_rsa" user@source_host:/path/ user@target_host:/path/

# 指定SSH端口和密钥
rsync -avz --progress -e "ssh -p 2222 -i ~/.ssh/id_rsa" user@source_host:/path/ user@target_host:/path/
```

### 3. 剪切操作（移动）

#### 同会话内移动
```bash
# 统一使用rsync（保持一致性和进度显示）
rsync -avz --progress --remove-source-files "/source/path/file" "/target/path/"

# 文件夹移动（需要删除空目录）
rsync -avz --progress --remove-source-files "/source/path/directory/" "/target/path/directory/" && find "/source/path/directory" -type d -empty -delete
```

#### 跨会话移动
```bash
# 使用rsync的--remove-source-files参数
rsync -avz --progress --remove-source-files user@source_host:/path/file user@target_host:/path/

# 注意：--remove-source-files只删除文件，不删除空目录
# 如果需要删除空目录，需要额外执行：
find /source/path -type d -empty -delete
```

## 📊 进度监控和输出解析

### 进度输出格式
```
1,234,567  45%  1.23MB/s    0:00:12
```

#### 输出字段说明：
- `1,234,567`: 已传输字节数
- `45%`: 传输进度百分比
- `1.23MB/s`: 当前传输速度
- `0:00:12`: 剩余时间估计

### 进度解析正则表达式
```typescript
// 解析rsync进度输出
const progressRegex = /(\d+(?:,\d+)*)\s+(\d+)%\s+([\d.]+[KMGT]?B\/s)\s+(\d+:\d+:\d+)/;

function parseRsyncProgress(output: string): {
  bytesTransferred: number;
  percentage: number;
  speed: string;
  timeRemaining: string;
} | null {
  const match = output.match(progressRegex);
  if (match) {
    return {
      bytesTransferred: parseInt(match[1].replace(/,/g, '')),
      percentage: parseInt(match[2]),
      speed: match[3],
      timeRemaining: match[4]
    };
  }
  return null;
}
```

## ⚠️ 注意事项

### 路径处理
```bash
# 正确：源路径末尾有斜杠，复制目录内容
rsync -avz source_dir/ target_dir/

# 错误：源路径末尾无斜杠，会创建source_dir目录
rsync -avz source_dir target_dir/
```

### 特殊字符处理
```bash
# 文件名包含空格或特殊字符时，使用引号
rsync -avz --progress "source file with spaces.txt" "/target/path/"

# 或使用转义字符
rsync -avz --progress source\ file\ with\ spaces.txt /target/path/
```

### 错误处理
```bash
# 忽略某些错误继续传输
rsync -avz --progress --ignore-errors source/ target/

# 设置超时时间
rsync -avz --progress --timeout=300 source/ target/

# 限制带宽使用
rsync -avz --progress --bwlimit=1000 source/ target/  # 限制为1MB/s
```

## 🔍 常见问题和解决方案

### 1. 权限问题
```bash
# 保持权限但忽略权限错误
rsync -rltvz --progress --chmod=ugo=rwX source/ target/
```

### 2. 大文件传输
```bash
# 启用断点续传
rsync -avz --progress --partial source/ target/

# 显示更详细的进度信息
rsync -avz --progress --stats source/ target/
```

### 3. 网络不稳定
```bash
# 增加重试次数和超时设置
rsync -avz --progress --timeout=60 --contimeout=60 source/ target/
```

### 4. 跨防火墙传输
```bash
# 使用非标准SSH端口
rsync -avz --progress -e "ssh -p 2222" user@host:/path/ /local/path/
```

这个rsync命令参考文档涵盖了复制粘贴功能需要的所有命令场景，可以作为开发时的技术参考。
