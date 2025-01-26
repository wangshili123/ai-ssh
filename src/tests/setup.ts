import { app } from 'electron';
import fs from 'fs';
import path from 'path';

const TEST_DB_DIR = path.join(process.cwd(), 'test-db');

// 确保测试数据库目录存在
if (!fs.existsSync(TEST_DB_DIR)) {
  fs.mkdirSync(TEST_DB_DIR, { recursive: true });
}

// Mock Electron app
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn().mockReturnValue(TEST_DB_DIR)
  }
}));

// 清理函数
afterAll(() => {
  if (fs.existsSync(TEST_DB_DIR)) {
    fs.rmSync(TEST_DB_DIR, { recursive: true, force: true });
  }
}); 
