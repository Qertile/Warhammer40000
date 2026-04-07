import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { readFileSync } from 'fs';
import { join } from 'path';

import { saveStoryChapter } from '@/lib/db';

// Load terminology table from external editable file
let terminologyTable = '';
try {
  terminologyTable = readFileSync(join(process.cwd(), 'terminology.md'), 'utf-8');
} catch {
  terminologyTable = '（找不到 terminology.md 術語表，請確認檔案存在於專案根目錄）';
}

const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

// Attempt to salvage usable content from a truncated/malformed JSON response
function repairTruncatedJson(text: string, historyCount: number): any {
  const titleMatch = text.match(/"chapter_title"\s*:\s*"([^"\\]*)"/);
  const promptMatch = text.match(/"image_prompt"\s*:\s*"([^"\\]*)"/);

  // Try to extract content up to the last complete [PARA] or sentence
  let content = '<p>（本章內容因生成時間過長被截斷，已顯示部分內容。請繼續點擊下一章。）</p>';
  const contentStart = text.indexOf('"content"');
  if (contentStart !== -1) {
    const rawContent = text.substring(contentStart + 11); // skip "content":"
    const lastPara = rawContent.lastIndexOf('[PARA]');
    const lastP = rawContent.lastIndexOf('</p>');
    const cutPoint = Math.max(lastPara, lastP);
    if (cutPoint > 50) {
      const salvaged = rawContent.substring(0, cutPoint + (lastPara > lastP ? 6 : 4));
      const parts = salvaged.split('[PARA]').filter(p => p.trim());
      if (parts.length > 0) {
        content = parts.map(p => `<p>${p.replace(/<[^>]*>/g, '').trim()}</p>`).join('');
      }
    }
  }

  return {
    chapter_title: titleMatch?.[1] || `第 ${historyCount + 1} 章`,
    image_prompt: promptMatch?.[1] || 'warhammer 40000 dark gothic battle grimdark cinematic masterpiece',
    content,
    glossary: [],
  };
}

export async function POST(req: Request) {
  let historyCount = 0;
  let lastChapters: any[] = [];
  let allChapterTitles: string[] = [];
  let storyId = 'default';
  try {
    const body = await req.json();
    historyCount = body.historyCount || 0;
    lastChapters = body.lastChapters || [];
    allChapterTitles = body.allChapterTitles || [];
    storyId = body.storyId || 'default';

    if (!ai) {
      if (!process.env.GEMINI_API_KEY) {
        const mockChapter = {
          chapter_title: `第 ${historyCount + 1} 章：戰火重燃`,
          image_prompt: "A dark gothic spaceship breaking through the warp, grimdark.",
          image_url: `/api/image?prompt=${encodeURIComponent('dark gothic spaceship warp grimdark')}&seed=1`,
          content: "<p>請在 <code>.env.local</code> 填入 <code>GEMINI_API_KEY=您的金鑰</code> 並重啟伺服器。</p>",
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

════════════════════════════════════════
【專有名詞翻譯標準】── 必須嚴格遵守，以下為繁體中文圈主流慣用譯名
════════════════════════════════════════
${terminologyTable}

════════════════════════════════════════
【撰寫規則】
════════════════════════════════════════
1. 時間線起點：從宇宙的最早期（天堂之戰、古聖與涅克戎的衝突）開始講述，並隨著每次請求推進時間線。
2. 長度要求：每章節必須撰寫至少 1500 字的繁體中文內容，包含詳細的戰役描寫、角色情感刻畫、武器裝備說明與深度背景故事（Lore）。請務必長篇撰寫，讓讀者能完全沉浸其中。
3. 敘事風格：保持史詩、黑暗且嚴肅的「暗黑哥德式」科幻風格。寫作手法需如同撰寫精緻的歐美奇幻文學小說。
4. 嚴禁重複：你必須確保本章節的內容與事件，與以下已撰寫的任何章節都不重複。每章必須推進時間線到一個新的、尚未涵蓋的事件或時期。
5. 英文原文標注：在 content 內文中，每個重要專有名詞於本章節首次出現時，必須在中文後面緊接括號標注英文原文。格式：中文名稱(English Name)。例如：古聖(Old Ones)、亞空間(The Warp)、涅克戎(Necrons)、荷魯斯叛亂(Horus Heresy)。重複出現時不需再標注。
極度重要：你必須只以標準的 JSON 格式輸出回覆，絕對不能包含任何 Markdown 標記符號 (例如 \`\`\`json)。格式如下：
{
"chapter_title": "本章標題",
"image_prompt": "用於生成圖片的英文提示詞，詳細描述本章節最核心的場景視覺細節，風格必須包含：warhammer 40k style, dark gothic, cinematic, grimdark, masterpiece。",
"content": "本章節的完整故事內容，段落之間請使用 [PARA] 作為分隔符號，不要使用 HTML 標籤或換行符號。重要專有名詞首次出現須加英文標注，例如：古聖(Old Ones)。",
"glossary": [
{"term": "中文專有名詞", "english": "英文原文", "definition": "簡短的繁體中文解釋"}
]
}
`;



    let historyContext = "";
    if (allChapterTitles.length > 0) {
      const titlesListStr = allChapterTitles.map((t: string, i: number) => `  第 ${i + 1} 章：${t}`).join("\n");
      const lastChapterDetail = lastChapters.length > 0
        ? `\n\n最後一章的詳細內容摘要（請確保接續此處繼續講述，不得重複其中任何事件）：\n第 ${historyCount} 章 - ${lastChapters[lastChapters.length - 1].title}：\n${lastChapters[lastChapters.length - 1].contentSummary}`
        : "";
      historyContext = `以下是已完成的所有章節標題清單，這些事件都【已經講述過】，絕對不能重複：\n${titlesListStr}${lastChapterDetail}\n\n請推進時間線，撰寫第 ${historyCount + 1} 章，內容必須是尚未涵蓋的全新事件。`;
    } else {
      historyContext = "這是故事的第一章，請從時間線最早期（天堂之戰）開始。";
    }

    const prompt = `${historyContext}\n\n請依照上述歷史進度與 System Rules 產生下一章的內容。確保輸出的 JSON 結構絕對完整。`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 }, // Disable thinking for faster response
      }
    });

    let responseText = response.text || "{}";

    // Clean markdown code blocks if present
    responseText = responseText.replace(/^```json\n?/im, '').replace(/\n?```$/im, '').trim();
    // Extract JSON object if there's extra text before/after
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) responseText = jsonMatch[0];

    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch (parseError) {
      console.error("===== JSON PARSE ERROR =====");
      console.error("Raw AI Output (last 500 chars):", responseText.slice(-500));
      console.error("==========================");
      // Attempt to salvage partial content from truncated JSON
      parsed = repairTruncatedJson(responseText, historyCount);
    }

    // Convert [PARA] delimiters to proper HTML paragraph tags
    if (parsed.content && typeof parsed.content === 'string') {
      parsed.content = parsed.content
        .split('[PARA]')
        .map((p: string) => `<p>${p.trim()}</p>`)
        .filter((p: string) => p !== '<p></p>')
        .join('');
    }

    // Generate image URL via proxy
    const imagePrompt = (parsed.image_prompt && !parsed.image_prompt.includes('中文') && !parsed.image_prompt.includes('一個'))
      ? parsed.image_prompt
      : "warhammer 40000 dark gothic battle grimdark cinematic masterpiece";
    const imageSeed = Math.floor(Math.random() * 1000000);
    parsed.image_url = `/api/image?prompt=${encodeURIComponent(imagePrompt)}&seed=${imageSeed}`;

    // Save to database
    await saveStoryChapter(storyId, parsed);

    return NextResponse.json(parsed);


  } catch (error: any) {
    console.error("Error in generate API:", error);
    // Fallback to mock data if API fails (e.g., limits exceeded, invalid key)

    return NextResponse.json({
      chapter_title: `系統警告：沉思者陣列發生錯誤`,
      image_prompt: "A broken cogitator machine, error screens, gothic architecture, grimdark",
      image_url: `/api/image?prompt=${encodeURIComponent('broken cogitator machine error screens gothic architecture grimdark')}&seed=999`,
      content: `<div style="font-family:monospace;background:#0a0a0a;border:1px solid #4a0000;border-radius:4px;padding:16px;margin:8px 0">
  <p style="color:#ff4444;font-weight:bold;margin:0 0 8px 0">⚠ 沉思者陣列連線失敗</p>
  <p style="color:#888;margin:0 0 12px 0">錯誤代碼（點擊複製）：</p>
  <div style="position:relative">
    <pre id="err-msg" style="background:#111;color:#ff9944;padding:12px;border-radius:4px;overflow-x:auto;white-space:pre-wrap;word-break:break-all;margin:0;font-size:13px">${error?.message || String(error)}</pre>
    <button onclick="navigator.clipboard.writeText(document.getElementById('err-msg').textContent).then(()=>{this.textContent='✓ 已複製';setTimeout(()=>{this.textContent='複製'},2000)})" style="position:absolute;top:8px;right:8px;background:#333;color:#ccc;border:1px solid #555;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:12px">複製</button>
  </div>
</div>`,
      glossary: [
        { term: "沉思者陣列", english: "Cogitator Array", definition: "帝國運算設備，取代了被視為禁忌的人工智慧。" },
        { term: "機僕", english: "Servitor", definition: "半機械的無意識奴工，有時會發生運作不良。" }
      ]
    });
  }
}
