import dotenv from "dotenv";
import OpenAI from "openai";
import { getDatabase } from "../database/index";
import { systemPrompt } from "../prompt/system";
import logger from "../utils/logger";
import { APIKeyManager } from "./apiKeyManager";

dotenv.config();

const apiKeyManager = APIKeyManager.getInstance();

async function executeWithKeyRotation<T>(operation: (apiKey: string) => Promise<T>): Promise<T> {
  while (true) {
    try {
      return await operation(apiKeyManager.getCurrentKey());
    } catch (error) {
      if (error instanceof Error && error.message.includes("Rate limit")) {
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

// 定義案例類型
interface ScamCase {
  id: number;
  content: string;
  category: string;
  embedding: string;
  created_at: string;
}

interface ScamCaseWithSimilarity extends ScamCase {
  similarity: number;
}

const SIMILARITY_THRESHOLD = 0.85;

// 生成文本的向量表示
export async function generateEmbedding(text: string): Promise<number[]> {
  logger.info(`開始生成文本向量 - 文本長度: ${text.length}`);
  return executeWithKeyRotation(async (apiKey) => {
    const openai = new OpenAI({ apiKey });

    try {
      const startTime = Date.now();
      const response = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: text,
      });
      const endTime = Date.now();
      const duration = endTime - startTime;

      logger.info(`向量生成完成 - 耗時: ${duration}ms, 向量維度: ${response.data[0].embedding.length}`);

      return response.data[0].embedding;
    } catch (error) {
      logger.error(`生成 embedding 失敗: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  });
}

// 找出相似案例
async function findSimilarCases(embedding: number[]): Promise<ScamCaseWithSimilarity[]> {
  console.log(embedding.length);
  logger.info(`開始搜索相似案例`);

  const db = getDatabase();
  const cases = (await db.all("SELECT * FROM scam_cases")) as ScamCase[];

  logger.info(`從資料庫讀取案例 - 總案例數: ${cases.length}`);

  const startTime = Date.now();
  const similarities = cases
    .map((case_: ScamCase) => {
      const similarity = cosineSimilarity(embedding, JSON.parse(case_.embedding));
      return {
        ...case_,
        similarity,
      };
    })
    .filter((c) => c.similarity >= SIMILARITY_THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity);

  const endTime = Date.now();
  const duration = endTime - startTime;

  logger.info(`相似度計算完成 - 耗時: ${duration}ms, 找到總計相似案例: ${similarities.length}個`);

  return similarities;
}

// 分析詐騙風險
export async function analyzeFraudRisk(content: string) {
  logger.info(`開始詐騙風險分析 - 內容長度: ${content.length}`);

  try {
    logger.debug("生成輸入內容的向量表示 - 步驟 1/4");
    const embedding = await generateEmbedding(content);

    logger.debug("搜索相似案例 - 步驟 2/4");
    const similarCases = await findSimilarCases(embedding);

    const topSimilarCases = similarCases.slice(0, 3);

    logger.debug("準備 GPT 分析上下文 - 步驟 3/4");
    const context = topSimilarCases.map((c) => `相似案例 (相似度: ${c.similarity.toFixed(2)}):\n${c.content}`).join("\n\n");

    logger.debug("調用 GPT 進行分析 - 步驟 4/4");
    const startTime = Date.now();

    const response = await executeWithKeyRotation(async (apiKey) => {
      const openai = new OpenAI({ apiKey });
      return await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: `
              <Similar_Cases>
              ${context}
              </Similar_Cases>

              <Analysis_Request>
              ${content}
              </Analysis_Request>
            `,
          },
        ],
      });
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    logger.debug(`GPT 回應內容 - 回應長度: ${response.choices[0]?.message?.content?.length || 0}, 耗時: ${duration}ms`);

    const analysisContent = response.choices[0]?.message?.content || "無法獲取分析結果";

    const analysisResult = JSON.parse(analysisContent);

    logger.debug(`GPT Token 使用量 - 輸入: ${response.usage?.prompt_tokens || 0}, 輸出: ${response.usage?.completion_tokens || 0}, 總計: ${response.usage?.total_tokens || 0}`);

    logger.info(`GPT 分析完成 - 耗時: ${duration}ms, 相似案例數: ${similarCases.length}`);

    const result = {
      analysis: analysisResult.result,
      riskScore: analysisResult.isMeaningfulContent ? analysisResult.riskScore : 0,
      relatedCount: analysisResult.isMeaningfulContent ? similarCases.length : 0,
      similarCases: analysisResult.isMeaningfulContent
        ? topSimilarCases.map(({ content, category, similarity }) => ({
            content,
            category,
            similarity: similarity.toFixed(2),
          }))
        : [],
    };

    logger.debug(`處理分析結果 - 分析長度: ${result.analysis.length}, 相似案例數: ${result.similarCases.length}, 類別: ${result.similarCases.map((c) => c.category).join(", ")}`);

    logger.info(`風險分析完成 - 分析長度: ${result.analysis.length}, 相似案例數: ${result.similarCases.length}`);

    return result;
  } catch (error) {
    logger.error(`分析過程中發生錯誤 - ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// 計算餘弦相似度
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  const dotProduct = vec1.reduce((acc, val, i) => acc + val * vec2[i], 0);
  const norm1 = Math.sqrt(vec1.reduce((acc, val) => acc + val * val, 0));
  const norm2 = Math.sqrt(vec2.reduce((acc, val) => acc + val * val, 0));
  return dotProduct / (norm1 * norm2);
}
