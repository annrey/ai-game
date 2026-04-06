/**
 * 配置加载工具
 * 统一处理 .env.test.local 和 .env 的加载逻辑
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

/**
 * 加载测试环境配置
 * 配置优先级：环境变量 > .env.test.local > .env
 *
 * 加载顺序（dotenv 不会覆盖已存在的环境变量）：
 * 1. 首先加载 .env（基础配置）
 * 2. 然后加载 .env.test.local（测试配置，覆盖 .env 中的同名变量）
 * 3. 已存在的环境变量优先级最高，不会被覆盖
 */
export function loadTestConfig(): void {
  const cwd = process.cwd();
  const testEnvPath = path.join(cwd, '.env.test.local');
  const defaultEnvPath = path.join(cwd, '.env');

  // 先加载 .env（如果存在）
  if (fs.existsSync(defaultEnvPath)) {
    dotenv.config({ path: defaultEnvPath });
  }

  // 然后加载 .env.test.local（如果存在），会覆盖 .env 中的同名变量
  // 但不会影响已存在的环境变量（环境变量优先级最高）
  if (fs.existsSync(testEnvPath)) {
    console.log('📄 检测到测试环境配置，加载 .env.test.local');
    dotenv.config({ path: testEnvPath });
  }
}

/**
 * 检查是否在开发/测试环境
 */
export function isDevEnvironment(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined;
}
