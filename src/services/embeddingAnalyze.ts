import { pipeline } from "@xenova/transformers";
import elasticlunr from "elasticlunr";
import { getDatabase } from "../database/index.js";

interface ElasticLunrIndex {
  addField(fieldName: string): void;
  setRef(refName: string): void;
  addDoc(doc: any): void;
  search(
    query: string,
    options?: {
      fields: {
        [key: string]: { boost: number };
      };
    }
  ): Array<{ ref: string; score: number }>;
  documentStore: {
    getDoc(ref: string): any;
  };
}

interface Case {
  id: string;
  title: string;
  content: string;
  embedding?: string;
}

interface SearchResult extends Case {
  score: number;
}

interface SearchResultItem {
  ref: string;
  score: number;
}

interface DBCase {
  id: number;
  title: string;
  content: string;
  embedding: string | null;
  category: string;
  url: string;
  source: string;
  publish_date: string;
}

export class HybridSearch {
  private static instance: HybridSearch;
  private bm25Index: ElasticLunrIndex;
  private model: any;
  private initialized: boolean = false;
  private embeddingCache: Map<string, number[]> = new Map();

  private constructor() {
    // 初始化 BM25 索引
    this.bm25Index = elasticlunr(function (this: ElasticLunrIndex) {
      this.addField("title");
      this.addField("content");
      this.setRef("id");
    });
  }

  public static getInstance(): HybridSearch {
    if (!HybridSearch.instance) {
      HybridSearch.instance = new HybridSearch();
    }
    return HybridSearch.instance;
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // 初始化 Sentence-BERT 模型
      this.model = await pipeline("feature-extraction", "Xenova/paraphrase-multilingual-MiniLM-L12-v2");

      // 從資料庫載入現有案例
      await this.loadCasesFromDB();

      this.initialized = true;
    } catch (error) {
      console.error("初始化失敗:", error);
      throw error;
    }
  }

  private async loadCasesFromDB() {
    const db = getDatabase();
    const cases = await db.all("SELECT id, title, content, embedding FROM scam_cases");

    for (const case_ of cases) {
      // 添加到 BM25 索引
      this.bm25Index.addDoc({
        id: case_.id.toString(),
        title: case_.title,
        content: case_.content,
      });

      // 如果有現存的 embedding，加入快取
      if (case_.embedding) {
        this.embeddingCache.set(case_.id.toString(), JSON.parse(case_.embedding));
      }
    }
  }

  private checkInitialized() {
    if (!this.initialized) {
      throw new Error("HybridSearch 尚未初始化，請先呼叫 initialize() 方法");
    }
  }

  // 添加案例到索引和資料庫
  async addCase(case_: Case) {
    this.checkInitialized();

    const db = getDatabase();
    const embedding = await this.getEmbedding(case_.title + " " + case_.content);

    // 儲存到資料庫
    const result = await db.run(`INSERT INTO scam_cases (title, content, embedding) VALUES (?, ?, ?)`, [case_.title, case_.content, JSON.stringify(embedding)]);

    const id = result.lastID.toString();

    // 添加到 BM25 索引
    this.bm25Index.addDoc({
      id,
      title: case_.title || "",
      content: case_.content,
    });

    // 快取 embedding
    this.embeddingCache.set(id, embedding);
  }

  // 批量添加案例
  async addCases(cases: Case[]) {
    this.checkInitialized();
    for (const case_ of cases) {
      await this.addCase(case_);
    }
  }

  // 獲取文本的嵌入向量
  private async getEmbedding(text: string): Promise<number[]> {
    this.checkInitialized();
    const output = await this.model(text, { pooling: "mean", normalize: true });
    return output.data;
  }

  // 計算兩個向量的餘弦相似度
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  // 雙階段搜索
  async search(query: string, firstStageLimit: number = 10, finalLimit: number = 5): Promise<SearchResult[]> {
    this.checkInitialized();

    // 第一階段：BM25 搜索
    const bm25Results = this.bm25Index
      .search(query, {
        fields: {
          title: { boost: 2 },
          content: { boost: 1 },
        },
      })
      .slice(0, firstStageLimit);

    if (bm25Results.length === 0) {
      return [];
    }

    // 獲取查詢文本的嵌入向量
    const queryEmbedding = await this.getEmbedding(query);

    // 第二階段：語義相似度計算
    const semanticResults = await Promise.all(
      bm25Results.map(async (result: SearchResultItem) => {
        const doc = this.bm25Index.documentStore.getDoc(result.ref);

        // 優先使用快取的 embedding
        let docEmbedding: number[];
        if (this.embeddingCache.has(result.ref)) {
          docEmbedding = this.embeddingCache.get(result.ref)!;
        } else {
          const docText = doc.title ? `${doc.title} ${doc.content}` : doc.content;
          docEmbedding = await this.getEmbedding(docText);
          this.embeddingCache.set(result.ref, docEmbedding);

          // 更新資料庫中的 embedding
          const db = getDatabase();
          await db.run("UPDATE scam_cases SET embedding = ? WHERE id = ?", [JSON.stringify(docEmbedding), result.ref]);
        }

        const semanticScore = this.cosineSimilarity(queryEmbedding, docEmbedding);

        return {
          id: doc.id,
          title: doc.title,
          content: doc.content,
          score: semanticScore,
        };
      })
    );

    // 根據語義相似度分數排序並返回前K個結果
    return semanticResults.sort((a: SearchResult, b: SearchResult) => b.score - a.score).slice(0, finalLimit);
  }
}
