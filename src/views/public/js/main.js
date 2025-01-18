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
    const content = document.getElementById("chatContent").value;
    if (!content.trim()) {
      alert("請輸入對話內容");
      return;
    }

    try {
      const result = await analyzer.analyzeContent(content);
      analyzer.displayResult(result);
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

  textarea.addEventListener("input", function () {
    // 重置高度以獲取正確的 scrollHeight
    this.style.height = "auto";

    // 計算新高度，但不超過最大高度
    const newHeight = Math.min(this.scrollHeight, 500);
    this.style.height = newHeight + "px";

    // 如果內容高度超過最大高度，啟用滾動
    if (this.scrollHeight > 500) {
      this.style.overflowY = "auto";
    } else {
      this.style.overflowY = "hidden";
    }
  });

  // 初始化高度
  textarea.dispatchEvent(new Event("input"));
}

// 初始化事件監聽器
document.addEventListener("DOMContentLoaded", () => {
  // 自動調整文本框高度
  autoResizeTextarea();

  // 分析按鈕
  const analyzeBtn = document.getElementById("analyzeBtn");
  if (analyzeBtn) {
    analyzeBtn.addEventListener("click", eventHandlers.handleAnalyzeClick);
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
document.getElementById("mobile-menu-button").addEventListener("click", function () {
  const mobileMenu = document.getElementById("mobile-menu");
  if (mobileMenu.classList.contains("hidden")) {
    mobileMenu.classList.remove("hidden");
    // 添加滑入動畫
    mobileMenu.classList.add("animate-slide-in");
  } else {
    // 添加滑出動畫
    mobileMenu.classList.add("animate-slide-out");
    setTimeout(() => {
      mobileMenu.classList.add("hidden");
      mobileMenu.classList.remove("animate-slide-out");
    }, 300);
  }
});
