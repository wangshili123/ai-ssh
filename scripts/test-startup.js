const { spawn } = require('child_process');
const path = require('path');

function testStartupTime() {
  console.log('测试应用启动时间...');
  const startTime = Date.now();
  
  // 启动打包后的应用
  const appPath = path.join(__dirname, '../release/win-unpacked/AI SSH Tool.exe');
  const child = spawn(appPath, [], {
    stdio: 'pipe'
  });
  
  child.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('应用程序初始化完成') || output.includes('渲染进程加载完成')) {
      const endTime = Date.now();
      const startupTime = endTime - startTime;
      console.log(`应用启动时间: ${startupTime}ms (${(startupTime/1000).toFixed(2)}秒)`);
      child.kill();
    }
  });
  
  child.on('error', (err) => {
    console.error('启动测试失败:', err.message);
  });
  
  // 10秒超时
  setTimeout(() => {
    console.log('启动测试超时');
    child.kill();
  }, 10000);
}

if (require.main === module) {
  testStartupTime();
}

module.exports = { testStartupTime };
