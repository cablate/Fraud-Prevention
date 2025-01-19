// 分析模組
const analyzer = {
  async analyzeContent(content) {
    try {
      // 顯示 Loading 狀態
      const analyzeBtn = document.getElementById("analyzeBtn");
      const originalBtnText = analyzeBtn.innerHTML;

      analyzeBtn.disabled = true;
      analyzeBtn.innerHTML = `
        <div class="flex items-center">
          <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          AI 分析中...
        </div>
      `;

      // 顯示 Loading 遮罩
      const loadingOverlay = document.createElement("div");
      loadingOverlay.id = "loadingOverlay";
      loadingOverlay.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
      loadingOverlay.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full mx-4">
          <div class="flex items-center justify-center mb-4">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
          <div class="text-center">
            <h3 class="text-lg font-semibold text-gray-900 mb-2">AI 正在分析中</h3>
            <p class="text-sm text-gray-600">請稍候，我們正在深入分析對話內容...</p>
          </div>
        </div>
      `;
      document.body.appendChild(loadingOverlay);

      const response = await fetch("/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error("分析請求失敗");
      }

      const data = await response.json();

      // 移除 Loading 狀態
      analyzeBtn.disabled = false;
      analyzeBtn.innerHTML = originalBtnText;
      document.body.removeChild(loadingOverlay);

      return data;
    } catch (error) {
      // 發生錯誤時也要移除 Loading 狀態
      const analyzeBtn = document.getElementById("analyzeBtn");
      analyzeBtn.disabled = false;
      analyzeBtn.innerHTML = "開始分析";
      const loadingOverlay = document.getElementById("loadingOverlay");
      if (loadingOverlay) {
        document.body.removeChild(loadingOverlay);
      }

      console.error("分析錯誤:", error);
      throw error;
    }
  },

  displayResult(data) {
    const resultDiv = document.getElementById("analysisResult");
    resultDiv.classList.remove("hidden");

    // 更新風險指數
    document.getElementById("riskScore").textContent = `${data.riskScore ?? 0}%`;

    // 更新關鍵字數量
    document.getElementById("keywordCount").textContent = data.relatedCount ?? 0;

    // 顯示詳細分析（支援 Markdown）
    if (data.analysis) {
      const detailedAnalysisDiv = document.getElementById("detailedAnalysis");
      // 設置 marked 選項
      marked.setOptions({
        gfm: true, // 啟用 GitHub Flavored Markdown
        breaks: true, // 轉換換行符為 <br>
        sanitize: false, // 允許 HTML 標籤
        smartLists: true, // 優化列表輸出
        smartypants: true, // 優化標點符號
      });

      // 轉換 Markdown 為 HTML 並包裝在框框中
      const htmlContent = marked.parse(data.analysis);
      detailedAnalysisDiv.innerHTML = `
        <div class="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div class="prose prose-sm md:prose-base max-w-none">
            ${htmlContent}
          </div>
        </div>
      `;
    }

    // 顯示相似案例
    if (data.similarCases && data.similarCases.length > 0) {
      const similarCasesContainer = document.getElementById("similarCases");
      similarCasesContainer.innerHTML = data.similarCases
        .map(
          (case_) => `
            <div class="py-4 first:pt-0 last:pb-0">
              <div class="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center">
                    <i class="fas fa-exclamation-circle text-yellow-500 mr-2"></i>
                    <span class="font-medium text-gray-900">相似度：${case_.similarity}</span>
                  </div>
                  <span class="text-sm text-gray-500">${case_.category}</span>
                </div>
                <p class="text-gray-600 mt-2">${case_.content}</p>
              </div>
            </div>
          `
        )
        .join("");
    }
  },
};

// 每日報告模組
const dailyReport = {
  async fetchDailyReport() {
    try {
      const response = await fetch("/api/daily-report");
      if (!response.ok) {
        throw new Error("獲取每日報告失敗");
      }
      return await response.json();
    } catch (error) {
      console.error("獲取每日報告錯誤:", error);
      throw error;
    }
  },

  displayReport(data) {
    // 更新日期
    const reportDate = document.getElementById("reportDate");
    const date = new Date(data.analysis_date);
    reportDate.innerHTML = `
      <i class="fas fa-calendar-alt mr-1"></i>
      <span>${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日</span>
    `;

    // 更新重點摘要
    const highlights = document.getElementById("dailyHighlights");
    if (data.content) {
      // 添加警語提示
      const disclaimer = `
        <div class="mb-6">
          <div class="bg-gradient-to-r from-blue-50 to-blue-100 border-l-4 border-blue-500 p-5 rounded-lg shadow-sm">
            <div class="flex items-start space-x-4">
              <div class="flex-shrink-0">
                <div class="bg-blue-100 p-2 rounded-full">
                  <i class="fas fa-robot text-blue-500 text-lg"></i>
                </div>
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-blue-900 mb-2 flex items-center">
                  <i class="fas fa-info-circle w-5 text-center mr-2"></i>
                  說明
                </h3>
                <ul class="text-blue-800 space-y-2">
                  <li class="flex items-start">
                    <i class="fas fa-check-circle w-5 text-center text-blue-500 mr-2 mt-1"></i>
                    <span class="flex-1">本報告內容由 AI 智能分析與整理生成</span>
                  </li>
                  <li class="flex items-start">
                    <i class="fas fa-exclamation-circle w-5 text-center text-yellow-500 mr-2 mt-1"></i>
                    <span class="flex-1">數字相關展示可能因分析時間差異而與實際情況有所出入</span>
                  </li>
                  <li class="flex items-start">
                    <i class="fas fa-lightbulb w-5 text-center text-green-500 mr-2 mt-1"></i>
                    <span class="flex-1">建議重點關注文字描述內容及防範建議</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      `;

      // 將 Markdown 內容按照中標題分段
      const sections = data.content.split(/(?=## )/);

      // 過濾掉主標題（以 # 開頭的行）
      const contentSections = sections.filter((section) => !section.trim().startsWith("# "));

      // 生成 HTML（加入警語）
      const htmlContent =
        disclaimer +
        contentSections
          .map((section, index) => {
            // 提取中標題
            const titleMatch = section.match(/## (.*)\n/);
            const title = titleMatch ? titleMatch[1] : "其他內容";

            // 提取內容（移除中標題行）
            let content = section.replace(/## .*\n/, "").trim();

            // 處理小標題
            const subSections = content
              .split(/(?=### )/)
              .map((subSection) => {
                const subTitleMatch = subSection.match(/### (.*)\n/);
                if (subTitleMatch) {
                  const subTitle = subTitleMatch[1];
                  const subContent = subSection.replace(/### .*\n/, "").trim();
                  return `
                <div class="mb-3">
                  <div class="px-3 py-2 border-l-4 border-blue-300">
                    <div class="flex items-center">
                      <i class="fas fa-angle-right text-blue-400 mr-2"></i>
                      <h4 class="text-sm font-medium text-gray-600">${subTitle}</h4>
                    </div>
                  </div>
                  <div class="px-3 py-2 text-gray-600 leading-relaxed">
                    ${marked.parse(subContent)}
                  </div>
                </div>
              `;
                }
                return `<div class="text-gray-600 leading-relaxed">${marked.parse(subSection)}</div>`;
              })
              .join("\n");

            // 生成唯一ID
            const sectionId = `section-${index}`;

            return `
          <div class="mb-4 bg-white rounded-lg shadow-sm overflow-hidden">
            <button 
              class="w-full px-4 py-3 text-left bg-gradient-to-r from-blue-50 to-white hover:from-blue-100 hover:to-blue-50 transition-all duration-200 flex items-center justify-between"
              onclick="toggleSection('${sectionId}')"
            >
              <div class="flex items-center">
                <i class="fas fa-chart-line text-blue-500 mr-2"></i>
                <span class="font-medium text-gray-700">${title}</span>
              </div>
              <i id="icon-${sectionId}" class="fas fa-chevron-down text-blue-400 transform transition-transform duration-200"></i>
            </button>
            <div id="${sectionId}" class="hidden">
              <div class="p-4 prose prose-sm max-w-none">
                <style>
                  .prose p {
                    margin-top: 0.5em;
                    margin-bottom: 0.5em;
                    line-height: 1.6;
                    color: #4B5563;
                  }
                  .prose ul {
                    margin-top: 0.5em;
                    margin-bottom: 0.5em;
                    color: #4B5563;
                  }
                  .prose li {
                    margin-top: 0.25em;
                    margin-bottom: 0.25em;
                  }
                  .prose strong {
                    color: #374151;
                    font-weight: 500;
                  }
                  .prose a {
                    color: #3B82F6;
                    text-decoration: none;
                  }
                  .prose a:hover {
                    text-decoration: underline;
                  }
                </style>
                ${subSections}
              </div>
            </div>
          </div>
        `;
          })
          .join("");

      highlights.innerHTML = htmlContent;

      // 添加切換函數到全局作用域
      window.toggleSection = function (sectionId) {
        const section = document.getElementById(sectionId);
        const icon = document.getElementById(`icon-${sectionId}`);

        if (section.classList.contains("hidden")) {
          // 展開
          section.classList.remove("hidden");
          icon.classList.add("rotate-180");

          // 添加展開動畫
          section.style.maxHeight = "0px";
          section.style.transition = "max-height 0.3s ease-out";
          requestAnimationFrame(() => {
            section.style.maxHeight = section.scrollHeight + "px";
          });
        } else {
          // 收起
          icon.classList.remove("rotate-180");
          section.style.maxHeight = "0px";

          // 等待動畫完成後隱藏
          setTimeout(() => {
            section.classList.add("hidden");
            section.style.maxHeight = "";
          }, 300);
        }
      };
    } else {
      highlights.innerHTML = '<p class="text-gray-500 text-center">暫無資料</p>';
    }

    // 更新詐騙類型分布
    const distributionChart = document.getElementById("fraudTypeDistribution");
    if (data.typeDistribution && Object.keys(data.typeDistribution).length > 0) {
      createFraudTypeChart(data);
    } else {
      // 清除畫布並顯示無數據訊息
      const ctx = distributionChart.getContext("2d");
      ctx.clearRect(0, 0, distributionChart.width, distributionChart.height);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#6B7280";
      ctx.font = "14px sans-serif";
      ctx.fillText("暫無資料", distributionChart.width / 2, distributionChart.height / 2);
    }
  },
};

// 工具模組
const tools = {
  async checkPhoneNumber(phoneNumber) {
    // 電話號碼查詢邏輯
    try {
      const response = await fetch("/check-phone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phoneNumber }),
      });
      return await response.json();
    } catch (error) {
      console.error("電話查詢錯誤:", error);
      throw error;
    }
  },

  async checkUrl(url) {
    // 網址安全檢測邏輯
    try {
      const response = await fetch("/check-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });
      return await response.json();
    } catch (error) {
      console.error("網址檢測錯誤:", error);
      throw error;
    }
  },
};

// 事件處理模組
const eventHandlers = {
  async handleAnalyzeClick() {
    const termsCheck = document.getElementById("termsCheck");
    const chatContent = document.getElementById("chatContent");
    const analyzeBtn = document.getElementById("analyzeBtn");

    // 檢查是否已同意使用條款
    if (!termsCheck || !termsCheck.checked) {
      const termsSection = document.getElementById("termsSection");
      if (termsSection) {
        termsSection.scrollIntoView({ behavior: "smooth", block: "center" });
        termsSection.classList.remove("highlight-border");
        void termsSection.offsetWidth;
        termsSection.classList.add("highlight-border");
        setTimeout(() => {
          termsSection.classList.remove("highlight-border");
        }, 1000);
      }
      return;
    }

    const content = chatContent.value;
    if (!content.trim()) {
      alert("請輸入對話內容");
      return;
    }

    try {
      const result = await analyzer.analyzeContent(content);
      analyzer.displayResult(result);

      // 分析完成後滾動到結果區域
      const resultSection = document.getElementById("analysisResult");
      if (resultSection) {
        resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (error) {
      alert(error.message);
    }
  },

  async handlePhoneCheck() {
    const phoneNumber = document.getElementById("phoneInput").value;
    if (!phoneNumber.trim()) {
      alert("請輸入電話號碼");
      return;
    }

    try {
      const result = await tools.checkPhoneNumber(phoneNumber);
      // 處理結果顯示邏輯
    } catch (error) {
      alert(error.message);
    }
  },

  async handleUrlCheck() {
    const url = document.getElementById("urlInput").value;
    if (!url.trim()) {
      alert("請輸入網址");
      return;
    }

    try {
      const result = await tools.checkUrl(url);
      // 處理結果顯示邏輯
    } catch (error) {
      alert(error.message);
    }
  },
};

// 自動調整文本框高度
function autoResizeTextarea() {
  const textarea = document.getElementById("chatContent");
  if (!textarea) return;

  let resizeTimeout;
  textarea.addEventListener("input", function () {
    // 使用防抖處理避免頻繁觸發
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      this.style.height = "auto";
      const newHeight = Math.min(this.scrollHeight, 500);
      this.style.height = newHeight + "px";
      this.style.overflowY = this.scrollHeight > 500 ? "auto" : "hidden";
    }, 100);
  });

  // 初始化高度
  textarea.dispatchEvent(new Event("input"));
}

// 初始化事件監聽器
document.addEventListener("DOMContentLoaded", async () => {
  // 自動調整文本框高度
  autoResizeTextarea();

  // 獲取所有需要的元素
  const analyzeBtn = document.getElementById("analyzeBtn");
  const termsCheck = document.getElementById("termsCheck");
  const chatContent = document.getElementById("chatContent");

  // 確保所有元素都存在
  if (termsCheck && chatContent && analyzeBtn) {
    // 初始狀態設置
    chatContent.disabled = true;
    analyzeBtn.disabled = true;
    chatContent.classList.add("bg-gray-100", "cursor-not-allowed");
    analyzeBtn.classList.add("opacity-50", "cursor-not-allowed");

    // 點擊輸入框時的處理（不論是否禁用）
    const handleContentClick = function (e) {
      // 如果未勾選，阻止所有默認行為
      if (!termsCheck.checked) {
        // 阻止所有可能的默認行為
        e.preventDefault();
        e.stopPropagation();

        // 移除任何可能的焦點
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }

        const termsSection = document.getElementById("termsSection");
        if (termsSection) {
          // 滾動到使用須知區塊
          termsSection.scrollIntoView({ behavior: "smooth", block: "center" });

          // 移除可能存在的之前的動畫類
          termsSection.classList.remove("highlight-border");

          // 強制重繪
          void termsSection.offsetWidth;

          // 添加閃爍動畫
          termsSection.classList.add("highlight-border");

          // 動畫結束後移除類
          setTimeout(() => {
            termsSection.classList.remove("highlight-border");
          }, 1000);
        }
        return false;
      }
    };

    // 綁定所有可能的交互事件
    chatContent.addEventListener("mousedown", handleContentClick, true);
    chatContent.addEventListener("mouseup", handleContentClick, true);
    chatContent.addEventListener("click", handleContentClick, true);
    chatContent.addEventListener("focus", handleContentClick, true);
    chatContent.addEventListener("touchstart", handleContentClick, true);
    chatContent.addEventListener("touchend", handleContentClick, true);

    // 防止在未勾選時輸入
    chatContent.addEventListener(
      "keydown",
      function (e) {
        if (!termsCheck.checked) {
          e.preventDefault();
          handleContentClick(e);
          return false;
        }
      },
      true
    );

    // 監聽勾選框狀態變化
    termsCheck.addEventListener("change", function () {
      const isChecked = this.checked;

      // 更新輸入框狀態
      chatContent.disabled = !isChecked;
      if (isChecked) {
        chatContent.classList.remove("bg-gray-100", "cursor-not-allowed");
        chatContent.classList.add("bg-white", "cursor-text");
        chatContent.focus();
      } else {
        chatContent.classList.add("bg-gray-100", "cursor-not-allowed");
        chatContent.classList.remove("bg-white", "cursor-text");
      }

      // 更新按鈕狀態
      analyzeBtn.disabled = !isChecked;
      if (isChecked) {
        analyzeBtn.classList.remove("opacity-50", "cursor-not-allowed");
      } else {
        analyzeBtn.classList.add("opacity-50", "cursor-not-allowed");
      }
    });

    // 綁定分析按鈕點擊事件
    analyzeBtn.addEventListener("click", eventHandlers.handleAnalyzeClick);
  }

  // 載入每日報告
  try {
    const reportData = await dailyReport.fetchDailyReport();
    dailyReport.displayReport(reportData);
  } catch (error) {
    console.error("載入每日報告失敗:", error);
    // 顯示錯誤提示
    const elements = ["dailyHighlights", "fraudTypeDistribution", "riskLevelStats", "typicalCases"];
    elements.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        element.innerHTML = '<p class="text-red-500 text-center">載入失敗，請稍後再試</p>';
      }
    });
  }

  // 電話查詢按鈕
  const phoneCheckBtn = document.getElementById("phoneCheckBtn");
  if (phoneCheckBtn) {
    phoneCheckBtn.addEventListener("click", eventHandlers.handlePhoneCheck);
  }

  // 網址檢測按鈕
  const urlCheckBtn = document.getElementById("urlCheckBtn");
  if (urlCheckBtn) {
    urlCheckBtn.addEventListener("click", eventHandlers.handleUrlCheck);
  }
});

// 手機版選單控制
const mobileMenuButton = document.getElementById("mobile-menu-button");
const mobileMenu = document.getElementById("mobile-menu");

if (mobileMenuButton && mobileMenu) {
  let menuTimeout;
  mobileMenuButton.addEventListener("click", function () {
    clearTimeout(menuTimeout);

    if (mobileMenu.classList.contains("hidden")) {
      mobileMenu.classList.remove("hidden");
      requestAnimationFrame(() => {
        mobileMenu.classList.add("animate-slide-in");
      });
    } else {
      mobileMenu.classList.add("animate-slide-out");
      menuTimeout = setTimeout(() => {
        mobileMenu.classList.add("hidden");
        mobileMenu.classList.remove("animate-slide-out");
      }, 300);
    }
  });
}

// 創建詐騙類型分布圖表
function createFraudTypeChart(data) {
  const ctx = document.getElementById("fraudTypeDistribution").getContext("2d");

  // 檢查是否有資料
  if (!data.typeDistribution || Object.keys(data.typeDistribution).length === 0) {
    if (window.typeChart) {
      window.typeChart.destroy();
      window.typeChart = null;
    }
    document.getElementById("noDataOverlay").style.opacity = "1";
    return;
  }

  // 使用 requestAnimationFrame 優化渲染
  requestAnimationFrame(() => {
    if (window.typeChart) {
      window.typeChart.destroy();
    }

    window.typeChart = new Chart(ctx, {
      type: "pie",
      data: {
        labels: Object.keys(data.typeDistribution),
        datasets: [
          {
            data: Object.values(data.typeDistribution),
            backgroundColor: [
              "rgba(255, 99, 132, 0.8)", // 紅色
              "rgba(54, 162, 235, 0.8)", // 藍色
              "rgba(255, 206, 86, 0.8)", // 黃色
              "rgba(75, 192, 192, 0.8)", // 青色
              "rgba(153, 102, 255, 0.8)", // 紫色
              "rgba(255, 159, 64, 0.8)", // 橙色
              "rgba(199, 199, 199, 0.8)", // 灰色
              "rgba(83, 102, 255, 0.8)", // 靛藍色
              "rgba(255, 99, 255, 0.8)", // 粉紅色
              "rgba(99, 255, 132, 0.8)", // 淺綠色
            ],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 500, // 減少動畫時間
        },
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              generateLabels: function (chart) {
                // 優化標籤生成
                const data = chart.data;
                if (data.labels.length && data.datasets.length) {
                  return data.labels.map((label, i) => ({
                    text: label,
                    fillStyle: data.datasets[0].backgroundColor[i],
                    hidden: false,
                    index: i,
                  }));
                }
                return [];
              },
            },
          },
          tooltip: {
            enabled: true,
            callbacks: {
              label: function (context) {
                const value = context.raw;
                const total = context.dataset.data.reduce((acc, curr) => acc + curr, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${context.label}: ${value} 件 (${percentage}%)`;
              },
            },
          },
        },
      },
    });
  });
}
