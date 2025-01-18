import express from "express";
import path from "path";
import { initializeDatabase } from "./database/index";
import { router as fraudRouter } from "./routes/fraud";
import { ScamCrawler } from "./services/crawler";
import { scheduleCrawler } from "./services/crawler/scheduler";

const app = express();
const port = process.env.PORT || 3000;

// 配置 express
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 設定 EJS 模板引擎
app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "src/views"));
//public
app.use("/public", express.static(path.join(process.cwd(), "src/views/public")));
// 路由
app.use("/", fraudRouter);

// 初始化資料庫
initializeDatabase()
  .then(() => {
    console.log("資料庫初始化成功");
    console.log("開始執行爬蟲任務");
    const crawler = new ScamCrawler();
    // crawler.processNoTitleCases();
    // crawler.crawl();
    console.log("建立排程爬蟲任務");
    scheduleCrawler();
    console.log("排程爬蟲任務建立完成");
    app.listen(port, () => {
      console.log(`伺服器運行在 http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("資料庫初始化失敗:", error);
    process.exit(1);
  });