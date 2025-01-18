export interface ScrapedCase {
  title: string;
  content: string;
  source: string;
  url: string;
  publishDate: Date;
  rawHtml?: string;
}

export interface ProcessedCase {
  content: string;
  category: string;
  embedding: number[];
  metadata: {
    source: string;
    url: string;
    publishDate: string;
  };
}
