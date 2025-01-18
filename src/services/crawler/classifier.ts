import OpenAI from "openai";
import logger from "../../utils/logger";
import { executeWithKeyRotation } from "../apiKeyManager";

const categories = ["網路購物", "投資理財", "假冒行政機關", "假冒銀行機關", "假冒親朋好友", "假商場假買家", "假檢警", "假廣告", "假交友", "假中獎", "假求職", "色情相關", "交予金融帳戶", "遊戲虛寶", "感情", "釣魚簡訊或連結", "其他"] as const;

type ScamCategory = (typeof categories)[number];

export async function classifyScamTypeAndTitle(
  content: string,
  retry?: boolean
): Promise<{
  category: ScamCategory;
  title: string;
}> {
  if (retry) {
    logger.info(`開始重試分類`);
  }

  try {
    const response = await executeWithKeyRotation(async (apiKey) => {
      const openai = new OpenAI({ apiKey });
      return await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `你是一個詐騙案例分類專家。
              請根據內容分析該案例的"分類"以及產生一句"標題"。
              <分類>
              如果多數內容明顯有關於詐騙實際案例，就分類為以下類別之一：
              ${categories.join("、")}
              如果內容明顯與詐騙無關，就分類為 "無"。
              如果內容明顯是詐騙，但無法明確分類，就分類為 "其他"。
              不需要其他任何說明或解釋。
              </分類>
              <標題>
              請根據內容分析該案例的"標題"，語言為繁體中文，不超過20字，內容須包含該案例關鍵重點。
              不需要其他任何說明或解釋。
              </標題>

              <Response_format_JSON>
              {
                "category": "網路購物", "title": "網路購物詐騙"
              }
              </Response_format_JSON>

            **非常重要：回覆格式為合法 JSON 格式，你只需要回覆 Stringify 後的 JSON 字串，不需要回傳任何額外的文字或解釋以及 markdown code block**

            `,
          },
          {
            role: "user",
            content: content,
          },
        ],
        temperature: 0.2,
        max_tokens: 150,
      });
    });

    const resJson = JSON.parse(response.choices[0]?.message?.content as string) as {
      category: ScamCategory;
      title: string;
    };

    if (!categories.includes(resJson.category as any)) {
      logger.warn(`無效的分類結果: ${resJson.category}，使用預設分類: 其他`);
      resJson.category = "其他";
    }

    logger.info(`分類結果: ${resJson.category} - ${resJson.title}`);

    return resJson;
  } catch (error: any) {
    logger.error(`分類失敗: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
