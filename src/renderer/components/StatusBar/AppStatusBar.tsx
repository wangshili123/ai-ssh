import React, { useState, useEffect } from 'react';
import './AppStatusBar.css';

/**
 * 应用全局状态栏组件 - 显示时间
 */
const AppStatusBar: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // 更新时间
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="app-status-bar">
      <span className="time-display">
        {currentTime.toLocaleTimeString()}
      </span>
    </div>
  );
};

export default AppStatusBar; 