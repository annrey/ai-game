/**
 * 配置加载工具
 * 生产只读 .env；测试才加载 .env.test.local 并覆盖同名项
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

/** 加载 .env，不覆盖进程里已有的环境变量 */
export function loadEnv(): void {
  const defaultEnvPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(defaultEnvPath)) {
    dotenv.config({ path: defaultEnvPath, override: false });
  }
}

/**
 * 测试配置：先 .env，再 .env.test.local（覆盖 .env 中的同名变量）。
 * 进程里预先存在的环境变量仍优先于 .env，但会被 .env.test.local 覆盖。
 */
export function loadTestConfig(): void {
  loadEnv();
  const testEnvPath = path.join(process.cwd(), '.env.test.local');
  if (fs.existsSync(testEnvPath)) {
    dotenv.config({ path: testEnvPath, override: true });
  }
}

/**
 * 检查是否在开发/测试环境
 */
export function isDevEnvironment(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined;
}
