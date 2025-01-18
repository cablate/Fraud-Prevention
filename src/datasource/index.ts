import * as cheerio from "cheerio";

export interface CrawlerSource {
  name: string;
  baseUrl: string;
  params: Record<string, any>;
  matcher: string;
  strategy: {
    list: {
      selector: string;
      extract: (
        element: any,
        $: cheerio.CheerioAPI
      ) => {
        title: string;
        url: string;
        publishDate: Date;
      };
    };
    url: {
      domain: string;
      process: (rawUrl: string, baseUrl: string) => string;
    };
    pagination: {
      pageSize: number;
      param: string;
      buildUrl: (baseUrl: string, page: number, params: Record<string, string | number>) => string;
    };
  };
  isAPI?: boolean;
  option?: string;
  apiParams?: Record<string, string | number>;
  headers?: Record<string, string>;
  dataProcessor?: (data: any) => any;
  dataList?: (resData: any) => any;
}

export const SOURCES: CrawlerSource[] = [
  {
    name: "高雄市政府警察局刑事警察大隊",
    baseUrl: "https://kcpd-cic.kcg.gov.tw/News.aspx",
    params: {
      n: "F1F83458BBCAB0EB",
      sms: "73BE5B81302C4CAD",
      PageSize: "200",
    },
    matcher: ".data_midlle_news_box02",
    strategy: {
      list: {
        selector: "table tbody tr",
        extract: (element, $) => {
          const dateCell = $(element).find("td:first-child");
          const titleCell = $(element).find("td:nth-child(2)");
          const link = titleCell.find("a");

          return {
            title: link.text().trim(),
            url: link.attr("href") || "",
            publishDate: new Date(dateCell.text().trim()),
          };
        },
      },
      url: {
        domain: "https://kcpd-cic.kcg.gov.tw",
        process: (rawUrl, baseUrl) => new URL(rawUrl, baseUrl).href,
      },
      pagination: {
        pageSize: 200,
        param: "page",
        buildUrl: (baseUrl, page, params) => {
          const searchParams = new URLSearchParams();
          Object.entries(params).forEach(([key, value]) => {
            searchParams.append(key, String(value));
          });
          searchParams.append("page", String(page));
          return `${baseUrl}?${searchParams.toString()}`;
        },
      },
    },
  },
  {
    name: "新北市政府警察局新店分局",
    baseUrl: "https://www.xindian.police.ntpc.gov.tw/lp-182-16-xCat-01-1-60.html",
    params: {
      PageSize: "60",
    },
    matcher: "body > div.mpwrap > div.mainContent.cp > table > tbody > tr > td",
    strategy: {
      list: {
        selector: "table > tbody > tr > td > div.list > ul > li",
        extract: (element, $) => {
          const link = $(element).find("a");
          const dateText = $(element).find(".date").text().trim();

          return {
            title: link.text().trim(),
            url: link.attr("href") || "",
            publishDate: new Date(dateText),
          };
        },
      },
      url: {
        domain: "https://www.xindian.police.ntpc.gov.tw",
        process: (rawUrl, baseUrl) => new URL(rawUrl, baseUrl).href,
      },
      pagination: {
        pageSize: 60,
        param: "p",
        buildUrl: (baseUrl, page, params) => {
          return baseUrl.replace(/-\d+-60\.html$/, `-${page}-60.html`);
        },
      },
    },
  },
  {
    isAPI: true,
    name: "內政部警政署165打詐儀錶板",
    baseUrl: "https://165dashboard.tw/CIB_DWS_API/api/CaseSummary/GetCaseSummaryList",
    headers: {
      "accept": "application/json, text/plain, */*",
      "accept-language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7", 
      "cache-control": "no-cache",
      "content-type": "application/json",
      "origin": "https://165dashboard.tw",
      "pragma": "no-cache",
      "referer": "https://165dashboard.tw/city-case-summary",
      "sec-ch-ua": "\"Google Chrome\";v=\"131\", \"Chromium\";v=\"131\", \"Not_A Brand\";v=\"24\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"Windows\"",
      "sec-fetch-dest": "empty", 
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    },
    params: {
      "UsingPaging": true,
      "NumberOfPerPage": 20000,
      "PageIndex": 1,
      "SortOrderInfos": [
          {
              "SortField": "CaseDate",
              "SortOrder": "DESC"
          }
      ],
      "SearchTermInfos": [],
      "Keyword": null,
      "CityId": null,
      "CaseDate": null
    },
    dataList: (resData: any) => {
      return resData.body.Detail;
    },
    dataProcessor: (data: any) => {
      return {
        title: "",
        url: `https://165dashboard.tw/?id=${data.Id}`,
        publishDate: new Date(data.CaseDate),
        source: "內政部警政署165打詐儀錶板",
        content: data.Summary,
        rawHtml: data.Summary,
      }
    },
    matcher: "",
    strategy: {
      list: {
        selector: "table > tbody > tr > td > div.list > ul > li",
        extract: (element, $) => {
          const link = $(element).find("a");
          const dateText = $(element).find(".date").text().trim();

          return {
            title: link.text().trim(),
            url: link.attr("href") || "",
            publishDate: new Date(dateText),
          };
        },
      },
      url: {
        domain: "https://www.xindian.police.ntpc.gov.tw",
        process: (rawUrl, baseUrl) => new URL(rawUrl, baseUrl).href,
      },
      pagination: {
        pageSize: 60,
        param: "p",
        buildUrl: (baseUrl, page, params) => {
          return baseUrl.replace(/-\d+-60\.html$/, `-${page}-60.html`);
        },
      },
    },
  },
];
