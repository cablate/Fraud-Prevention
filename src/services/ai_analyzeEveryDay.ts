import { format } from "date-fns";
import OpenAI from "openai";
import { getDatabase } from "../database";
import { analyzePrompt } from "../prompt/analyze";
import { batchAnalyzePrompt } from "../prompt/batchAnalyze";
import logger from "../utils/logger";
import { executeWithKeyRotation } from "./apiKeyManager";
import crypto from "crypto";

// 新增分批處理函數
async function analyzeBatch(cases: any[], openai: OpenAI) {
  const xml = cases
    .map((item: any) => {
      return `
      <case_${item.id}>
        <title>${item.title}</title>
        <content>${item.content}</content>
        <category>${item.category}</category>
      </case_${item.id}>`;
    })
    .join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: batchAnalyzePrompt("", ""),
      },
      {
        role: "user",
        content: `
          <Today_Cases>
            <batch_number>${crypto.randomUUID()}</batch_number>
            <cases_count>${cases.length}</cases_count>
            <cases>
              ${xml}
            </cases>
          </Today_Cases>
        `.trim(),
      },
    ],
  });

  logger.info(`GPT Token 使用量 - 輸入: ${response.usage?.prompt_tokens || 0}, 輸出: ${response.usage?.completion_tokens || 0}, 總計: ${response.usage?.total_tokens || 0}`);

  return response.choices[0]?.message?.content || "";
}

export const aiAnalyzeEveryDay = async () => {
  logger.info("開始分析每日詐騙案例");
  const db = getDatabase();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 取得最新的 publish_date
  const latestCase = await db.get("SELECT publish_date FROM scam_cases ORDER BY publish_date DESC LIMIT 1");

  // 檢查是否有最新案例
  if (!latestCase) {
    logger.info("找不到任何案例");
    return;
  }

  // 將日期字串轉換為 Date 物件並調整時區
  const publishDate = new Date(latestCase.publish_date);
  publishDate.setMinutes(publishDate.getMinutes() + publishDate.getTimezoneOffset());
  const latestDate = format(new Date(publishDate), "yyyy-MM-dd");

  logger.info(`最新案例日期: ${latestDate}`);

  // 取得最新案例
  const cases = await db.all("SELECT id, title, content, category FROM scam_cases WHERE DATE(publish_date) = ?", latestDate);
  logger.info(`取得 ${cases.length} 個案例`);

  const BATCH_SIZE = 100; // 每批處理的案例數
  const batchResults: string[] = [];
  const startTime = new Date();

  // 分批處理案例
  for (let i = 0; i < cases.length; i += BATCH_SIZE) {
    const batch = cases.slice(i, i + BATCH_SIZE);
    logger.info(`處理第 ${i / BATCH_SIZE + 1} 批案例，共 ${batch.length} 個`);

    const batchResult = await executeWithKeyRotation(async (apiKey) => {
      const openai = new OpenAI({ apiKey });
      return await analyzeBatch(batch, openai);
    });

    batchResults.push(batchResult);
  }

  // 合併所有批次的分析結果
  const combinedAnalysis = await executeWithKeyRotation(async (apiKey) => {
    const openai = new OpenAI({ apiKey });
    return await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: analyzePrompt("", ""),
        },
        {
          role: "user",
          content: `
            <Batch_Results>
            ${batchResults
              .map(
                (result, index) => `
              <batch_${index + 1}>
                ${result}
              </batch_${index + 1}>
            `
              )
              .join("\n")}
            </Batch_Results>
          `.trim(),
        },
      ],
    });
  });

  const endTime = new Date();
  const duration = endTime.getTime() - startTime.getTime();

  logger.info(`GPT 分析完成 - 耗時: ${duration}ms`);
  logger.info(`GPT Token 使用量 - 輸入: ${combinedAnalysis.usage?.prompt_tokens || 0}, 輸出: ${combinedAnalysis.usage?.completion_tokens || 0}, 總計: ${combinedAnalysis.usage?.total_tokens || 0}`);

  const analysisContent = combinedAnalysis.choices[0]?.message?.content || "無法獲取分析結果";

  // 將分析結果存入資料庫
  await db.run(
    `INSERT INTO daily_analysis (analysis_date, content, case_count) 
     VALUES (?, ?, ?)`,
    latestDate,
    analysisContent,
    cases.length
  );

  logger.info(`已將最終分析結果存入資料庫 - 日期: ${latestDate}, 案例數: ${cases.length}`);
};
