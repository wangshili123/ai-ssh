import React, { useState, useEffect } from 'react';
import { Progress, Typography } from 'antd';
import './AppLoadingScreen.css';

const { Title, Text } = Typography;

interface LoadingStep {
  key: string;
  label: string;
  duration: number;
}

const loadingSteps: LoadingStep[] = [
  { key: 'database', label: '初始化数据库', duration: 800 },
  { key: 'services', label: '启动核心服务', duration: 600 },
  { key: 'ui', label: '加载用户界面', duration: 400 },
  { key: 'ready', label: '准备就绪', duration: 200 }
];

interface AppLoadingScreenProps {
  visible: boolean;
  onComplete?: () => void;
}

export const AppLoadingScreen: React.FC<AppLoadingScreenProps> = ({
  visible,
  onComplete
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!visible) return;

    let stepTimer: NodeJS.Timeout;
    let progressTimer: NodeJS.Timeout;

    const runLoadingSequence = async () => {
      for (let i = 0; i < loadingSteps.length; i++) {
        setCurrentStep(i);
        
        // 模拟加载进度
        const step = loadingSteps[i];
        const startProgress = (i / loadingSteps.length) * 100;
        const endProgress = ((i + 1) / loadingSteps.length) * 100;
        
        await new Promise<void>((resolve) => {
          let currentProgress = startProgress;
          const progressIncrement = (endProgress - startProgress) / (step.duration / 50);
          
          progressTimer = setInterval(() => {
            currentProgress += progressIncrement;
            if (currentProgress >= endProgress) {
              currentProgress = endProgress;
              setProgress(currentProgress);
              clearInterval(progressTimer);
              resolve();
            } else {
              setProgress(currentProgress);
            }
          }, 50);
        });

        // 在最后一步添加额外延迟
        if (i === loadingSteps.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      setIsComplete(true);
      setTimeout(() => {
        onComplete?.();
      }, 500);
    };

    runLoadingSequence();

    return () => {
      clearTimeout(stepTimer);
      clearInterval(progressTimer);
    };
  }, [visible, onComplete]);

  if (!visible) return null;

  return (
    <div className={`app-loading-screen ${isComplete ? 'fade-out' : ''}`}>
      <div className="loading-container">
        <div className="loading-header">
          <div className="loading-icon">
            <div className="icon-terminal">
              <div className="terminal-screen">
                <div className="terminal-line"></div>
                <div className="terminal-line"></div>
                <div className="terminal-cursor"></div>
              </div>
            </div>
          </div>
          
          <Title level={2} className="loading-title">
            AI SSH Tool
          </Title>
          
          <Text className="loading-description">
            智能SSH客户端正在为您准备最佳体验
          </Text>
        </div>

        <div className="loading-progress-section">
          <Progress
            percent={Math.round(progress)}
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
            trailColor="rgba(255, 255, 255, 0.1)"
            showInfo={false}
            strokeWidth={6}
          />
          
          <div className="loading-step-info">
            <Text className="step-text">
              {currentStep < loadingSteps.length ? loadingSteps[currentStep].label : '启动完成'}
            </Text>
            <Text className="progress-text">
              {Math.round(progress)}%
            </Text>
          </div>
        </div>

        <div className="loading-features">
          <div className="feature-grid">
            <div className="feature-item">
              <div className="feature-icon">🧠</div>
              <div className="feature-text">AI智能补全</div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">⚡</div>
              <div className="feature-text">高性能终端</div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">📁</div>
              <div className="feature-text">文件管理</div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🔒</div>
              <div className="feature-text">安全连接</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
