export const analyzePrompt = (content: string, context: string) => {
  return `
<DailyFraudCaseAnalysis_Protocol>
  <Description>
    我將提供已經過初步整理的詐騙案例分析結果，請你幫我統整並撰寫成一份正式的《當日詐騙案例分析書》。
    這些分析結果會存放在 <Batch_Results> 標籤中。
    除了整理案例本身，我希望這份分析書能具有專業深度和實用價值，並包含以下幾個主要部分。
  </Description>

  <Response_Format>
  <Sections>
    <Section>
      <Title>比例分析</Title>
      <Tasks>
        <Task>針對分類比例進行一段具體的分析，例如討論哪些分類占比最高、可能的原因，以及這些趨勢對社會或政策層面的意義。</Task>
      </Tasks>
    </Section>

    <Section>
      <Title>主要詐騙分類總結分析</Title>
      <Tasks>
        <Task>鎖定今日最多的詐騙案例分類，針對該分類的所有案例進行總結分析。</Task>
        <Task>提供該分類詐騙手法的詳細描述，包括核心特徵、操作流程以及對應的受害者心理狀態。</Task>
      </Tasks>
    </Section>

    <Section>
      <Title>詐騙特性全方位分析</Title>
      <Tasks>
        <Task>探討今日所有案例中，詐騙手法的共通或頻繁特性，例如誘使受害者相信高回報、創造急迫感、偽裝權威身份等。</Task>
        <Task>結合實際案例舉例，說明這些特性如何影響受害者，並分析該手法的有效性來源。</Task>
      </Tasks>
    </Section>

    <Section>
      <Title>案例趨勢與風險評估</Title>
      <Tasks>
        <Task>根據今日的案例數據，分析近期詐騙趨勢，討論是否出現新型手法或變異模式。</Task>
        <Task>評估詐騙對特定族群（如特定年齡層、地區、職業）的潛在風險，並提供預警建議。</Task>
      </Tasks>
    </Section>

    <Section>
      <Title>建議與防範措施</Title>
      <Tasks>
        <Task>根據上述分析，提出具體的應對策略與防範建議，針對個人、社會、企業及政府層面提供建議，例如宣導重點、技術防護或法規建議。</Task>
      </Tasks>
    </Section>
  </Sections>
  </Response_Format>

  <LanguageRequirements>
    <Language>繁體中文</Language>
    <Style>正式且專業的書面語體</Style>
    <Avoid>口語化或網路用語</Avoid>
    <RegionSpecificTerms>臺灣地區常用的專業詞彙</RegionSpecificTerms>
    <CulturalContext>符合繁體中文的語言習慣和文化脈絡</CulturalContext>
    <AdditionalEnhancements>適當使用成語或諺語以增加文章的文采</AdditionalEnhancements>
  </LanguageRequirements>

  <OptimizationGoals>
    <Clarity>條理清晰，深入淺出</Clarity>
    <Practicality>結合數據與案例，幫助讀者快速了解當前詐騙形勢及防範重點</Practicality>
    <Flexibility>若有其他能提升分析書品質的建議或內容，請一併補充</Flexibility>
  </OptimizationGoals>
</DailyFraudCaseAnalysis_Protocol>


`;
};
