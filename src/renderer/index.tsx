import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { store } from './store';
import App from './App';
import './index.css';
import 'antd/dist/antd.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Failed to find the root element');
}

ReactDOM.render(
  <Provider store={store}>
    <App />
  </Provider>,
  container
); 