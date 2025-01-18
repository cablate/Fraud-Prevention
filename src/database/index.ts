import path from "path";
import { open } from "sqlite";
import sqlite3 from "sqlite3";

// 資料庫連接實例
let db: any = null;

// 初始化資料庫
export async function initializeDatabase() {
  const dbPath = path.join(process.cwd(), "data", "fraud.db");

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  // 創建詐騙案例表
  await db.exec(`
    CREATE TABLE IF NOT EXISTS scam_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category VARCHAR(100) NOT NULL,
      url TEXT NOT NULL,
      source TEXT NOT NULL,
      publish_date TIMESTAMP NOT NULL,
      embedding TEXT,
      content_hash CHAR(64) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 創建索引
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_content_hash ON scam_cases(content_hash);
    CREATE INDEX IF NOT EXISTS idx_url ON scam_cases(url);
    CREATE INDEX IF NOT EXISTS idx_publish_date ON scam_cases(publish_date);
    CREATE INDEX IF NOT EXISTS idx_source ON scam_cases(source);
  `);

  return db;
}

// 取得資料庫實例
export function getDatabase() {
  if (!db) {
    throw new Error("資料庫尚未初始化");
  }
  return db;
}
