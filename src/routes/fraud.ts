import express from "express";
import { getDatabase } from "../database/index";
import { analyzeFraudRisk, generateEmbedding } from "../services/ai";

export const router = express.Router();

// 首頁
router.get("/", (req, res) => {
  res.render("index");
});

// 獲取所有詐騙案例
router.get("/cases", async (req, res) => {
  try {
    const db = getDatabase();
    const cases = await db.all("SELECT * FROM scam_cases ORDER BY created_at DESC");
    res.json(cases);
  } catch (error) {
    console.error("獲取案例失敗:", error);
    res.status(500).json({ error: "獲取案例失敗" });
  }
});

// 新增詐騙案例
router.post("/cases", async (req, res) => {
  try {
    const { content, category } = req.body;
    if (!content || !category) {
      return res.status(400).json({ error: "內容和分類都是必填項目" });
    }

    const embedding = await generateEmbedding(content);
    const db = getDatabase();

    await db.run("INSERT INTO scam_cases (content, category, embedding) VALUES (?, ?, ?)", [content, category, JSON.stringify(embedding)]);

    res.json({ message: "案例新增成功" });
  } catch (error) {
    console.error("新增案例失敗:", error);
    res.status(500).json({ error: "新增案例失敗" });
  }
});

// 分析對話內容
router.post("/analyze", async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: "請提供對話內容" });
    }

    const analysis = await analyzeFraudRisk(content.slice(0, 1000));
    res.json(analysis);
  } catch (error) {
    console.error("分析失敗:", error);
    res.status(500).json({ error: "分析失敗" });
  }
});
