import Anthropic from '@anthropic-ai/sdk'
import { lookup } from 'node:dns/promises'
import { isIPv4, isIPv6 } from 'node:net'
import { NextResponse } from 'next/server'
import { requireAdminMealAccess } from '@/lib/authz'

const client = new Anthropic()
const MAX_BODY_BYTES = 5 * 1024 * 1024
const MAX_TEXT_CHARS = 12000
const MAX_IMAGE_BYTES = 4 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const BLOCKED_HOSTNAMES = new Set(['localhost', 'localhost.localdomain'])

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

function isPrivateAddress(address: string) {
  if (isIPv4(address)) {
    const parts = address.split('.').map(Number)
    const [a, b] = parts
    return (
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a === 0
    )
  }

  if (isIPv6(address)) {
    const normalized = address.toLowerCase()
    return (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80:')
    )
  }

  return true
}

async function validateFetchableUrl(rawUrl: string) {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('無效的網址，請確認 URL 格式正確（需包含 https://）')
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('只支援 http 或 https 網址')
  }

  const hostname = parsed.hostname.toLowerCase()
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.local')) {
    throw new Error('不支援內部或本機網址')
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true })
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('不支援內部或私有網路網址')
  }

  return parsed.toString()
}

export async function POST(req: Request) {
  const auth = await requireAdminMealAccess()
  if (!auth.ok) {
    return auth.response
  }

  const contentLength = Number(req.headers.get('content-length') ?? 0)
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: '輸入內容太大' }, { status: 413 })
  }

  const formData = await req.formData()
  const type = formData.get('type') as string
  const text = formData.get('text') as string | null
  const url = formData.get('url') as string | null
  const image = formData.get('image') as File | null

  try {
    let messages: Anthropic.MessageParam[]

    if (type === 'text' && text) {
      if (text.length > MAX_TEXT_CHARS) {
        return NextResponse.json({ error: '文字內容太長' }, { status: 413 })
      }
      messages = [{
        role: 'user',
        content: `請解析以下食譜：\n\n${text}`
      }]
    } else if (type === 'url' && url) {
      try {
        const validUrl = await validateFetchableUrl(url)
        const pageRes = await fetch(validUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          redirect: 'manual',
          signal: AbortSignal.timeout(8000),
        })
        if (pageRes.status >= 300 && pageRes.status < 400) {
          return NextResponse.json({ error: '不支援會重新導向的網址' }, { status: 400 })
        }
        if (!pageRes.ok) {
          return NextResponse.json({ error: '無法讀取此網址' }, { status: 400 })
        }

        const html = (await pageRes.text()).slice(0, 120000)
        const cleanText = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .slice(0, 8000)

        messages = [{
          role: 'user',
          content: `請從以下網頁內容解析食譜（來源：${validUrl}）：\n\n${cleanText}`
        }]
      } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : '無效的網址' }, { status: 400 })
      }
    } else if (type === 'image' && image) {
      if (!ALLOWED_IMAGE_TYPES.has(image.type) || image.size > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: '圖片格式或大小不支援' }, { status: 400 })
      }
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
