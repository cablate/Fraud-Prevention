import path from "path";
import winston from "winston";

// 定義日誌級別
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// 創建 Winston logger 實例
const logger = winston.createLogger({
  level: "debug", // 設置最低日誌級別為 debug
  levels,
  format: winston.format.combine(
    winston.format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss",
    }),
    winston.format.json()
  ),
  transports: [
    // 錯誤日誌
    new winston.transports.File({
      filename: path.join("logs", "error.log"),
      level: "error",
    }),
    // 所有日誌
    new winston.transports.File({
      filename: path.join("logs", "combined.log"),
    }),
    // 開發環境下的控制台輸出
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  ],
});

// 確保日誌目錄存在
import fs from "fs";
if (!fs.existsSync("logs")) {
  fs.mkdirSync("logs");
}

export default logger;
