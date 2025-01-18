import axios from "axios";
import * as cheerio from "cheerio";
import crypto from "crypto";
import { getDatabase } from "../../database";
import { CrawlerSource, SOURCES } from "../../datasource";
import logger from "../../utils/logger";
import { generateEmbedding } from "../ai";
import { classifyScamTypeAndTitle } from "./classifier";

interface ScrapedCase {
  title: string;
  content: string;
  source: string;
  url: string;
  publishDate: Date;
  rawHtml: string;
  contentHash?: `${string & { length: 128 }}`;
}

interface ProcessedCase extends Omit<ScrapedCase, "publishDate" | "rawHtml"> {
  category: string;
  embedding: number[];
  publishDate: string;
  created_at: string;
  updated_at: string;
}

export class ScamCrawler {
  private readonly sources: CrawlerSource[] = SOURCES;

  async crawl(): Promise<void> {
    logger.info("開始爬取詐騙案例");

    for (const source of this.sources) {
      if (source.isAPI) {
        await this.processAPI(source);
      } else {
        // await this.crawlSource(source);
      }
    }
  }

  private async crawlSource(source: CrawlerSource): Promise<void> {
    try {
      logger.info(`正在爬取來源: ${source.name}`);

      const cases = await this.fetchCases(source);
      const newCases = await this.filterNewCases(cases);

      await this.processCases(newCases, source);

      logger.info(`完成爬取 ${source.name}`);
    } catch (error) {
      logger.error(`爬取 ${source.name} 失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async fetchCases(source: CrawlerSource): Promise<ScrapedCase[]> {
    const allCases: ScrapedCase[] = [];
    let page = 1;
    let hasNextPage = true;

    while (hasNextPage) {
      try {
        const url = source.strategy.pagination.buildUrl(source.baseUrl, page, source.params);
        const response = await axios.get(url);
        const cases = await this.parseTablePage(response.data, source);

        if (cases.length === 0) {
          hasNextPage = false;
        } else {
          allCases.push(...cases);

          // 如果獲取的案例數小於每頁大小，表示已經是最後一頁
          if (cases.length < source.strategy.pagination.pageSize) {
            hasNextPage = false;
          } else {
            page++;
            // 避免請求過於頻繁
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      } catch (error) {
        logger.error(`爬取第 ${page} 頁失敗: ${error instanceof Error ? error.message : String(error)}`);
        hasNextPage = false;
      }
    }

    return allCases;
  }

  private async processAPI(source: CrawlerSource): Promise<void> {
    logger.info(`開始爬取來源: ${source.name}`);
    const response = await axios.post(source.baseUrl, source.params, {
      headers: source.headers,
    });
    const cases = source.dataList && (source.dataList(response.data));
    const processedCases = cases.map((c:any) => source.dataProcessor?.(c));
    const newCases = await this.filterNewCases(processedCases);
    const processedNewCases = newCases.map((c:any) => {
      return {
        ...c, contentHash: this.generateHash(c.content)
      }
    });
    
    for (const case_ of processedNewCases) {
      logger.info(`開始處理案例: ${case_.url}`);
      await this.processAndSave(case_);
    }
  }

  private async processCases(cases: ScrapedCase[], source: CrawlerSource): Promise<void> {
    for (const case_ of cases) {
      const detailResponse = await axios.get(case_.url);
      const { content, contentHash } = await this.parseDetailPage(detailResponse.data, source.matcher);

      if (await this.isDuplicate(case_.url, contentHash)) {
        logger.info(`案例已存在 (URL: ${case_.url} 或 hash: ${contentHash})，跳過處理`);
        continue;
      }

      case_.content = content;
      case_.contentHash = contentHash;
      await this.processAndSave(case_);

      // 避免請求過於頻繁
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  private async parseTablePage(html: string, source: CrawlerSource): Promise<ScrapedCase[]> {
    const cases: ScrapedCase[] = [];
    const $ = cheerio.load(html);

    $(source.strategy.list.selector).each((_, element) => {
      try {
        const { title, url, publishDate } = source.strategy.list.extract(element, $);
        const processedUrl = source.strategy.url.process(url, source.strategy.url.domain);

        cases.push({
          title,
          content: "", // 稍後在詳細頁面填充
          source: source.name,
          url: processedUrl,
          publishDate,
          rawHtml: $(element).html() || "",
        });
      } catch (error) {
        logger.error(`解析列表項目失敗: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    return cases;
  }

  private async parseDetailPage(
    html: string,
    matcher: string
  ): Promise<{
    content: string;
    contentHash: `${string & { length: 128 }}`;
  }> {
    const $ = cheerio.load(html);
    // 調整選擇器以匹配詳細內容頁面的結構
    const content = $(matcher).text().trim();
    const contentHash = this.generateHash(content);
    return { content, contentHash };
  }

  private generateHash(content: string): `${string & { length: 128 }}` {
    return crypto.createHash("sha256").update(content).digest("hex") as `${string & { length: 128 }}`;
  }

  private async processAndSave(case_: ScrapedCase): Promise<void> {
    try {
      const { category, title } = await classifyScamTypeAndTitle(case_.content);
      const embedding = await generateEmbedding(case_.content);

      const processedCase: ProcessedCase = {
        title: case_.title || title,
        content: case_.content,
        category,
        embedding,
        contentHash: case_.contentHash!,
        url: case_.url,
        source: case_.source,
        publishDate: case_.publishDate.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await this.saveToDatabase(processedCase);
    } catch (error) {
      logger.error(`處理案例失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async saveToDatabase(case_: ProcessedCase): Promise<void> {
    const db = getDatabase();
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO scam_cases (
        title,
        content,
        category,
        url,
        source,
        publish_date,
        embedding,
        content_hash,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [case_.title, case_.content, case_.category, case_.url, case_.source, case_.publishDate, JSON.stringify(case_.embedding), case_.contentHash, now, now]
    );
  }

  private async isDuplicate(url: string, contentHash: string): Promise<boolean> {
    const db = getDatabase();
    const result = await db.get(`SELECT COUNT(*) as count FROM scam_cases WHERE url = ? OR content_hash = ?`, [url, contentHash]);
    return (result?.count ?? 0) > 0;
  }

  private async filterNewCases(cases: ScrapedCase[]): Promise<ScrapedCase[]> {
    const db = getDatabase();
    const existingUrls = await db.all(`SELECT DISTINCT url FROM scam_cases WHERE url IN (${cases.map(() => "?").join(",")})`, cases.map((c) => c.url));
    const existingHashSet = new Set(existingUrls.map((row: any) => row.url));
    const newCases = cases.filter((case_) => !existingHashSet.has(case_.url));
    logger.info(`發現 ${cases.length} 個案例，其中 ${newCases.length} 個為新案例`);
    return newCases;
    
  }
}
