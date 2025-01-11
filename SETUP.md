# AI-SSH 开发环境配置指南

## 1. 基础环境要求

### 1.1 必需软件
- Node.js (推荐版本 18.x 或更高)
- Git
- Visual Studio Code (推荐编辑器)
- Python (用于某些npm包的编译)

### 1.2 操作系统要求
- Windows 10/11
- macOS 10.13+
- Linux (Ubuntu 16.04+ 或其他主流发行版)

## 2. 环境配置步骤

### 2.1 Node.js 安装
1. 访问 https://nodejs.org/
2. 下载并安装 Node.js 18.x LTS 版本
3. 验证安装：
```bash
node --version
npm --version
```

### 2.2 开发工具安装
1. 安装 Visual Studio Code
2. 安装推荐的 VS Code 插件：
   - ESLint
   - Prettier
   - TypeScript and JavaScript Language Features
   - Electron Developer Tools

### 2.3 项目初始化
1. 创建项目目录：
```bash
mkdir ai-ssh-tool
cd ai-ssh-tool
```

2. 初始化项目：
```bash
npm init -y
```

3. 安装基础依赖：
```bash
# 开发依赖
npm install --save-dev electron electron-builder typescript
npm install --save-dev @types/node @types/react @types/react-dom
npm install --save-dev webpack webpack-cli webpack-dev-server
npm install --save-dev eslint prettier

# 生产依赖
npm install react react-dom
npm install @ant-design/icons antd
npm install xterm xterm-addon-fit
npm install ssh2 node-ssh
npm install sqlite3
npm install openai
```

## 3. 项目结构设置

创建以下目录结构：
```
ai-ssh-tool/
├── src/
│   ├── main/           # Electron 主进程
│   ├── renderer/       # React 渲染进程
│   ├── common/         # 共享代码
│   └── types/          # TypeScript 类型定义
├── assets/             # 静态资源
├── build/              # 构建脚本
└── config/             # 配置文件
```

## 4. 配置文件准备

### 4.1 创建 TypeScript 配置
创建 `tsconfig.json`：
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["dom", "es2020"],
    "jsx": "react",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowJs": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

### 4.2 创建 Electron Builder 配置
创建 `electron-builder.json`：
```json
{
  "appId": "com.ai-ssh-tool",
  "productName": "AI SSH Tool",
  "directories": {
    "output": "dist"
  },
  "files": [
    "dist/**/*",
    "package.json"
  ],
  "win": {
    "target": ["nsis"]
  },
  "mac": {
    "target": ["dmg"]
  },
  "linux": {
    "target": ["AppImage", "deb"]
  }
}
```

## 5. 环境变量配置

创建 `.env` 文件：
```
OPENAI_API_KEY=your_api_key_here
```

## 6. 开发启动命令

在 `package.json` 中添加以下脚本：
```json
{
  "scripts": {
    "start": "electron .",
    "dev": "webpack serve --config webpack.dev.js",
    "build": "webpack --config webpack.prod.js && electron-builder",
    "lint": "eslint . --ext .ts,.tsx",
    "format": "prettier --write \"src/**/*.{ts,tsx}\""
  }
}
```

## 7. 下一步

环境配置完成后，您可以：
1. 运行 `npm install` 安装所有依赖
2. 运行 `npm run dev` 启动开发服务器
3. 在新终端中运行 `npm start` 启动 Electron 应用

## 注意事项
1. 确保所有依赖安装成功
2. 配置 OpenAI API Key
3. 如遇到编译错误，检查 Node.js 版本和系统依赖
4. Windows 用户可能需要安装 Windows Build Tools：
```bash
npm install --global windows-build-tools
``` 