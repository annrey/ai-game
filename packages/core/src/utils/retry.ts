/**
 * 重试工具函数
 * 提供指数退避策略的重试机制
 */

export interface RetryOptions {
  /** 最大重试次数，默认 3 */
  maxRetries?: number;
  /** 基础延迟（毫秒），默认 1000ms */
  baseDelay?: number;
  /** 自定义重试判断函数 */
  shouldRetry?: (error: Error) => boolean;
  /** 日志函数 */
  onRetry?: (attempt: number, maxRetries: number, delay: number, error: Error) => void;
}

/**
 * 判断错误是否应该重试
 * 默认对网络错误、超时、5xx 服务器错误进行重试，不重试 4xx 客户端错误
 */
export function defaultShouldRetry(error: Error): boolean {
  const errorMessage = error.message.toLowerCase();
  
  // 网络错误
  if (
    errorMessage.includes('network') ||
    errorMessage.includes('fetch') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('econnrefused') ||
    errorMessage.includes('etimedout') ||
    errorMessage.includes('enotfound')
  ) {
    return true;
  }
  
  // 超时错误
  if (
    errorMessage.includes('timeout') ||
    errorMessage.includes('timed out')
  ) {
    return true;
  }
  
  // 5xx 服务器错误
  const serverErrorMatch = errorMessage.match(/\b(5\d{2})\b/);
  if (serverErrorMatch) {
    return true;
  }
  
  // 4xx 客户端错误不重试
  const clientErrorMatch = errorMessage.match(/\b(4\d{2})\b/);
  if (clientErrorMatch) {
    return false;
  }
  
  // 默认重试其他错误
  return true;
}

/**
 * 使用指数退避策略执行重试
 * delay = baseDelay * (2 ^ attempt)
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    shouldRetry = defaultShouldRetry,
    onRetry,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // 最后一次尝试，抛出错误
      if (attempt >= maxRetries) {
        throw lastError;
      }

      // 检查是否应该重试
      if (!shouldRetry(lastError)) {
        throw lastError;
      }

      // 计算指数退避延迟
      const delay = baseDelay * Math.pow(2, attempt);

      // 调用日志回调
      if (onRetry) {
        onRetry(attempt + 1, maxRetries, delay, lastError);
      }

      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * 创建带重试的异步生成器包装器
 */
export async function* retryWithBackoffStream<T>(
  fn: () => AsyncIterable<T>,
  options: RetryOptions = {}
): AsyncIterable<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    shouldRetry = defaultShouldRetry,
    onRetry,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const stream = fn();
      for await (const chunk of stream) {
        yield chunk;
      }
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // 最后一次尝试，抛出错误
      if (attempt >= maxRetries) {
        throw lastError;
      }

      // 检查是否应该重试
      if (!shouldRetry(lastError)) {
        throw lastError;
      }

      // 计算指数退避延迟
      const delay = baseDelay * Math.pow(2, attempt);

      // 调用日志回调
      if (onRetry) {
        onRetry(attempt + 1, maxRetries, delay, lastError);
      }

      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
