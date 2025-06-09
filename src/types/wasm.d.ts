declare module '*.wasm' {
  const content: string;
  export default content;
}

// 扩展Window接口，添加加载页面相关方法
declare global {
  interface Window {
    hideInitialLoading?: () => void;
  }
}

declare module 'tree-sitter-bash/tree-sitter-bash.wasm' {
  const content: string;
  export default content;
} 