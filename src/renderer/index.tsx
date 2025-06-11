import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './store';
import App from './App';
import './index.css';
import 'antd/dist/reset.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Failed to find the root element');
}

const root = createRoot(container);

// 创建应用组件包装器，用于处理加载完成事件
const AppWrapper: React.FC = () => {
  React.useEffect(() => {
    // 当React应用挂载完成后，隐藏初始加载页面
    const timer = setTimeout(() => {
      if (window.hideInitialLoading) {
        window.hideInitialLoading();
      }
    }, 100); // 稍微延迟一下，确保应用完全渲染

    return () => clearTimeout(timer);
  }, []);

  return (
    <Provider store={store}>
      <App />
    </Provider>
  );
};

root.render(<AppWrapper />);