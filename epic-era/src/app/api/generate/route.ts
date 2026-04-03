import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

import { saveStoryChapter } from '@/lib/db';

// We explicitly check so if there is an error, we show it clearly
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

export async function POST(req: Request) {
  let historyCount = 0;
  let lastChapters: any[] = [];
  let storyId = 'default';
  try {
    const body = await req.json();
    historyCount = body.historyCount || 0;
    lastChapters = body.lastChapters || [];
    storyId = body.storyId || 'default';

    if (!ai) {
      if (!process.env.GEMINI_API_KEY) {
        // Return a mock if API key isn't set yet during development verification
        const mockChapter = {
          chapter_title: `第 ${historyCount + 1} 章：戰火重燃`,
          image_prompt: "A dark gothic spaceship breaking through the warp, grimdark.",
          image_url: `https://picsum.photos/seed/${Date.now()}/1200/600`,
          content: "<p>這是一段測試內容。請在您的項目根目錄建立 <code>.env.local</code> 檔案，並填入 <code>GEMINI_API_KEY=您的金鑰</code>，然後重啟伺服器以取得真正的 Gemini API 回應。</p><p>這是第二段測試文字，模擬排版效果。黑暗的科幻宇宙中，只有延綿不絕的戰爭。</p>",
          glossary: [
            { term: "亞空間", english: "The Warp", definition: "一個由靈能構成的平行宇宙，也是星際航行與惡魔的領域。" }
          ]
        };
        await saveStoryChapter(storyId, mockChapter);
        return NextResponse.json(mockChapter);
      }
      ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }

    const systemInstruction = `
請扮演一位資深的《戰鎚40K》（Warhammer 40,000）歷史學者。使用者正在閱讀一本圖文電子書，想從頭開始了解戰鎚40K的所有故事。
請遵守以下規則：
1. 時間線起點：從宇宙的最早期（天堂之戰、古聖與懼亡者）開始講述，並隨著每次請求推進時間線。
2. 分段輸出：每次只推進「一個章節」的故事（約 800-1000 字）。
3. 敘事風格：保持史詩、黑暗且嚴肅的「暗黑哥德式」科幻風格。
最重要的是，你必須只以 JSON 格式輸出回覆，不要包含任何其他 Markdown 標記，格式如下：
{
"chapter_title": "本章標題",
"image_prompt": "用於生成圖片的英文提示詞，請詳細描述本章節最核心的場景、人物或戰役的視覺細節，風格為暗黑史詩科幻插畫。",
"content": "本章節的具體故事內容（請使用 HTML 的 <p> 進行段落換行）。",
"glossary": [
{"term": "中文專有名詞", "english": "英文原文", "definition": "簡短的繁體中文解釋"}
]
}
`;

    let historyContext = "";
    if (lastChapters && lastChapters.length > 0) {
      historyContext = "先前的章節歷史摘要（請延續此進度接續創造下一章）：\n" + 
        lastChapters.map((ch: any, idx: number) => `第 ${historyCount - lastChapters.length + idx + 1} 章 - ${ch.title}:\n${ch.contentSummary}`).join("\n\n");
    } else {
      historyContext = "這是故事的第一章，請從時間線最早期（天堂之戰）開始。";
    }

    const prompt = `${historyContext}\n\n請依照上述歷史進度與 System Rules 產生下一章的內容。`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      }
    });

    const responseText = response.text || "{}";
    
    // Parse the JSON
    const parsed = JSON.parse(responseText);

    // Apply placeholder image URL with random seed based on image_prompt length or similar
    const seed = encodeURIComponent(parsed.chapter_title || Date.now().toString());
    parsed.image_url = `https://picsum.photos/seed/${seed}/1200/600`;

    // Save to database
    await saveStoryChapter(storyId, parsed);

    return NextResponse.json(parsed);

  } catch (error: any) {
    console.error("Error in generate API:", error);
    // Fallback to mock data if API fails (e.g., limits exceeded, invalid key)
    
    return NextResponse.json({
      chapter_title: `系統警告：沉思者陣列發生錯誤`,
      image_prompt: "A broken cogitator machine, error screens, gothic architecture, grimdark",
      image_url: `https://picsum.photos/seed/${Date.now()}/1200/600`,
      content: `<p>無法與異端神明連線，錯誤代碼：${error?.message || String(error)}</p><p>可能的解決方案：</p><ul><li>您電腦中或許有設定過一組失效或耗盡額度的 GEMINI_API_KEY。</li><li>請確定您有去 Google AI Studio 申請新的金鑰。</li><li>這段是本地緊急救援協議載入的測試內容，以防系統崩潰。這是系統第 ${historyCount + 1} 次嘗試運算。</li></ul>`,
      glossary: [
        { term: "沉思者陣列", english: "Cogitator Array", definition: "帝國運算設備，取代了被視為禁忌的人工智慧。" },
        { term: "機僕", english: "Servitor", definition: "半機械的無意識奴工，有時會發生運作不良。" }
      ]
    });
  }
}
