import logger from "../utils/logger";

export class APIKeyManager {
  private static instance: APIKeyManager;
  private apiKeys: string[] = [];
  private currentKeyIndex: number = 0;

  private constructor() {
    // 從環境變數讀取所有可用的 API Keys
    for (let i = 1; ; i++) {
      const key = process.env[`OPENAI_API_KEY_${i}`];
      if (!key) break;
      this.apiKeys.push(key);
    }

    if (this.apiKeys.length === 0) {
      throw new Error("未設定 OpenAI API Key");
    }
  }

  public static getInstance(): APIKeyManager {
    if (!APIKeyManager.instance) {
      APIKeyManager.instance = new APIKeyManager();
    }
    return APIKeyManager.instance;
  }

  getCurrentKey(): string {
    return this.apiKeys[this.currentKeyIndex];
  }

  rotateKey(): string | null {
    if (this.currentKeyIndex + 1 < this.apiKeys.length) {
      this.currentKeyIndex++;
      logger.info(`切換至備用 API Key ${this.currentKeyIndex + 1}`);
      logger.info(`切換後的 API Key: ${this.getCurrentKey().slice(0, 10)}...${this.getCurrentKey().slice(-10)}`);
      return this.getCurrentKey();
    }
    logger.warn("已無可用的備用 API Key，維持使用當前 API Key");
    return null;
  }

  resetKeyRotation(): void {
    this.currentKeyIndex = 0;
  }
}

// 提供一個方便的輔助函數來執行 API 呼叫並處理 Key 輪換
export async function executeWithKeyRotation<T>(operation: (apiKey: string) => Promise<T>): Promise<T> {
  const apiKeyManager = APIKeyManager.getInstance();

  while (true) {
    try {
      return await operation(apiKeyManager.getCurrentKey());
    } catch (error) {
      if (error instanceof Error && error.message.includes("Rate limit")) {
        logger.error(`Rate limit 錯誤: ${error.message}`);
        logger.info(`切換至下一個 API Key`);
        const nextKey = apiKeyManager.rotateKey();
        if (!nextKey) {
          throw error; // 如果沒有更多的 API Key 可用，拋出原始錯誤
        }
        // 繼續下一次迴圈，使用新的 API Key
        continue;
      }
      throw error; // 如果不是 Rate Limit 錯誤，直接拋出
    }
  }
}
