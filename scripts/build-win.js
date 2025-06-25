const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('开始构建 Windows 版本...');

try {
  // 1. 构建项目
  console.log('1. 构建项目...');
  execSync('npm run build', { stdio: 'inherit' });

  // 2. 备份有问题的原生依赖
  console.log('2. 处理原生依赖...');
  const problematicModules = [
    'node_modules/cpu-features',
    'node_modules/tree-sitter/build',
    'node_modules/tree-sitter-bash/build'
  ];

  const backupDir = 'temp_backup';
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
  }

  problematicModules.forEach(modulePath => {
    if (fs.existsSync(modulePath)) {
      const backupPath = path.join(backupDir, path.basename(modulePath));
      console.log(`备份 ${modulePath} 到 ${backupPath}`);
      try {
        if (fs.statSync(modulePath).isDirectory()) {
          fs.renameSync(modulePath, backupPath);
        }
      } catch (err) {
        console.log(`跳过 ${modulePath}: ${err.message}`);
      }
    }
  });

  // 3. 运行 electron-builder
  console.log('3. 运行 electron-builder...');
  execSync('cross-env NODE_ENV=production ELECTRON_BUILDER_CACHE=node_modules/.cache/electron electron-builder --win', { 
    stdio: 'inherit',
    env: {
      ...process.env,
      ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES: 'true'
    }
  });

  console.log('构建完成！');

} catch (error) {
  console.error('构建失败:', error.message);
  process.exit(1);
} finally {
  // 4. 恢复备份的模块
  console.log('4. 清理临时文件...');
  const backupDir = 'temp_backup';
  if (fs.existsSync(backupDir)) {
    try {
      fs.rmSync(backupDir, { recursive: true, force: true });
    } catch (err) {
      console.log('清理备份文件失败:', err.message);
    }
  }
}
