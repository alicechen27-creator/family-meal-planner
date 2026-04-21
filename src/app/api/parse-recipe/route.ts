import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const client = new Anthropic()

const PARSE_PROMPT = `你是一個食譜解析助手。分析食譜後，以 JSON 格式回傳結構化資料。

首先判斷這是哪種食譜：
- "split"（分開組合）：食材可明確分為澱粉/主食、肉、蔬菜、醬料等獨立部分，例如：白飯配紅燒肉配炒青菜
- "all_in_one"（一鍋到底）：所有食材一起烹調，例如火鍋、咖哩、燉菜、湯品、炒飯

回傳格式（只回傳 JSON，不要說明文字）：

若為 split 類型：
{
  "title": "食譜名稱",
  "description": "一句話描述",
  "type": "split",
  "servings": 4,
  "instructions": "完整烹調步驟，每步用數字編號，例如：1. 先將豬肉醃製...\n2. 熱鍋下油...",
  "components": [
    {
      "type": "starch" | "meat" | "vegetable" | "sauce",
      "name": "這個部分的名稱，例如：白飯、紅燒豬肉、炒青江菜、蒜蓉醬",
      "instructions": "此組件的烹調步驟，例如：1. 豬肉醃製30分鐘\n2. 中火煎至兩面金黃",
      "ingredients": [
        { "name": "食材名稱", "amount": "數量", "unit": "單位" }
      ]
    }
  ],
  "ingredients": []
}

若為 all_in_one 類型：
{
  "title": "食譜名稱",
  "description": "一句話描述",
  "type": "all_in_one",
  "servings": 4,
  "instructions": "完整烹調步驟，每步用數字編號",
  "components": [],
  "ingredients": [
    { "name": "食材名稱", "amount": "數量", "unit": "單位" }
  ]
}

規則：
- components 中只包含實際出現的類型，不需強制四種都有
- 每個 component 的 instructions 是該組件獨立的烹調步驟（非整道菜）
- 整體的 instructions 是組合/擺盤步驟
- amount 和 unit 若不確定可以留空字串
- servings 若無法判斷預設為 4
- instructions 若沒有烹調步驟可留空字串
- 判斷 split vs all_in_one 要根據烹調方式，而非食材組成`

export async function POST(req: Request) {
  const formData = await req.formData()
  const type = formData.get('type') as string
  const text = formData.get('text') as string | null
  const url = formData.get('url') as string | null
  const image = formData.get('image') as File | null

  try {
    let messages: Anthropic.MessageParam[]

    if (type === 'text' && text) {
      messages = [{
        role: 'user',
        content: `請解析以下食譜：\n\n${text}`
      }]
    } else if (type === 'url' && url) {
      let validUrl: string
      try {
        validUrl = new URL(url).toString()
      } catch {
        return NextResponse.json({ error: '無效的網址，請確認 URL 格式正確（需包含 https://）' }, { status: 400 })
      }
      const pageRes = await fetch(validUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      const html = await pageRes.text()
      const cleanText = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .slice(0, 8000)

      messages = [{
        role: 'user',
        content: `請從以下網頁內容解析食譜（來源：${url}）：\n\n${cleanText}`
      }]
    } else if (type === 'image' && image) {
      const arrayBuffer = await image.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      const mediaType = image.type as 'image/jpeg' | 'image/png' | 'image/webp'

      messages = [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 }
          },
          { type: 'text', text: '請解析圖片中的食譜內容。' }
        ]
      }]
    } else {
      return NextResponse.json({ error: '無效的輸入' }, { status: 400 })
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: PARSE_PROMPT,
      messages,
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      return NextResponse.json({ error: '解析失敗' }, { status: 500 })
    }

    const jsonStr = content.text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(jsonStr)

    return NextResponse.json({ recipe: parsed })
  } catch (err) {
    console.error('parse-recipe error:', err)
    return NextResponse.json({ error: '解析失敗，請手動輸入' }, { status: 500 })
  }
}
