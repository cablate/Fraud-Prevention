import cron from "node-cron";
import logger from "../../utils/logger";
import { ScamCrawler } from "./index";

export function scheduleCrawler() {
  // 每天凌晨 3 點執行爬蟲
  cron.schedule("0 3 * * *", async () => {
    logger.info("開始執行排程爬蟲任務");

    try {
      const crawler = new ScamCrawler();
      await crawler.crawl();
      logger.info("排程爬蟲任務完成");
    } catch (error) {
      logger.error(`排程爬蟲任務失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  logger.info("爬蟲排程已設定");
}
