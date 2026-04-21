import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import fs from 'node:fs/promises'
import path from 'node:path'

const SOURCE_DIR = process.env.SOURCE_DIR ?? './recipe-cards'
const BUCKET = 'recipe-photos'
const LOG_FILE = path.join(process.cwd(), 'scripts', 'batch-import.log.json')

// HelloFresh card: food photo occupies left-center area
const CROP = { left: 0.04, top: 0.12, right: 0.64, bottom: 0.92 }

const limit = (() => {
  const i = process.argv.indexOf('--limit')
  return i >= 0 ? parseInt(process.argv[i + 1], 10) : Infinity
})()

const anthropic = new Anthropic()
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PARSE_PROMPT = `你是食譜解析助手。我會給你一份 HelloFresh 食譜卡的兩張照片：
- 第一張：食譜正面（標題、食材清單帶圖示、成品照片）
- 第二張：食譜背面（逐步烹調說明，通常分為 6 個編號步驟）

請整合兩張照片的資訊，以繁體中文 JSON 回傳結構化資料（原文為英文，請翻譯；料理名稱保留原意但翻成中文，例如 "Creamy Caramelized Onion Meatloaves" → "焦糖洋蔥奶香肉餅"）。

首先判斷食譜類型：
- "split"（分開組合）：有獨立的澱粉/主食、肉、蔬菜、醬料等可跨食譜替換的組件（HelloFresh 大部分是此類）
- "all_in_one"（一鍋到底）：所有食材一起烹調，例如湯、咖哩、炒飯

回傳格式（只回傳 JSON，不要說明文字、不要 markdown 圍欄）：

若為 split：
{
  "title": "中文食譜名稱",
  "description": "一句話描述（含主要特色）",
  "type": "split",
  "servings": 2,
  "instructions": "整合步驟或擺盤說明（編號步驟，繁體中文）",
  "components": [
    {
      "type": "starch" | "meat" | "vegetable" | "sauce",
      "name": "組件中文名稱，例如：馬鈴薯泥、香煎豬菲力、烤紅蘿蔔、橙汁第戎醬",
      "instructions": "此組件獨立烹調步驟（編號，繁體中文）",
      "ingredients": [
        { "name": "食材中文名稱", "amount": "數量", "unit": "單位" }
      ]
    }
  ],
  "ingredients": []
}

若為 all_in_one：
{
  "title": "中文食譜名稱",
  "description": "一句話描述",
  "type": "all_in_one",
  "servings": 2,
  "instructions": "完整烹調步驟（編號，繁體中文）",
  "components": [],
  "ingredients": [
    { "name": "食材中文名稱", "amount": "數量", "unit": "單位" }
  ]
}

規則：
- components 只包含實際出現的類型（不強制四種都有）
- 每個 component 的 instructions 是組件獨立做法；頂層 instructions 是組合 / 擺盤步驟
- HelloFresh 正面食材表的份量通常寫 "2 Person | 4 Person"，取 2 人份資料
- 保留原始單位（tsp, tbsp, oz, cup 等），不換算
- servings 預設 2（HelloFresh 通常 2 人份）
- 若找不到烹調步驟可留空字串`

interface Pair {
  front: string
  back: string
}

interface Result {
  status: 'ok' | 'fail' | 'skip'
  front: string
  back: string
  title?: string
  recipe_id?: string
  error?: string
}

async function cropFoodPhoto(filePath: string): Promise<Buffer> {
  const img = sharp(filePath).rotate() // auto-rotate per EXIF
  const meta = await img.metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  if (!width || !height) throw new Error('Cannot read image dimensions')
  return await img
    .extract({
      left: Math.round(width * CROP.left),
      top: Math.round(height * CROP.top),
      width: Math.round(width * (CROP.right - CROP.left)),
      height: Math.round(height * (CROP.bottom - CROP.top)),
    })
    .jpeg({ quality: 85 })
    .toBuffer()
}

async function uploadPhoto(buffer: Buffer, namePrefix: string): Promise<string> {
  const fileName = `batch-${Date.now()}-${namePrefix}.jpg`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, buffer, { contentType: 'image/jpeg', upsert: false })
  if (error) throw new Error(`Storage upload: ${error.message}`)
  return supabase.storage.from(BUCKET).getPublicUrl(fileName).data.publicUrl
}

async function compressForClaude(filePath: string): Promise<string> {
  const buf = await sharp(filePath)
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer()
  return buf.toString('base64')
}

async function parseWithClaude(frontPath: string, backPath: string): Promise<any> {
  const [frontB64, backB64] = await Promise.all([
    compressForClaude(frontPath),
    compressForClaude(backPath),
  ])

  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: PARSE_PROMPT,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: frontB64 } },
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: backB64 } },
        { type: 'text', text: '第一張是食譜正面、第二張是背面。請整合兩張的資訊後輸出 JSON。' },
      ],
    }],
  })

  const content = res.content[0]
  if (content.type !== 'text') throw new Error('Claude returned non-text content')
  const raw = content.text.replace(/```json?\s*/gi, '').replace(/```/g, '').trim()
  return JSON.parse(raw)
}

async function titleExists(title: string): Promise<boolean> {
  const { data } = await supabase
    .from('recipes')
    .select('id')
    .eq('title', title)
    .maybeSingle()
  return !!data
}

async function insertRecipe(parsed: any, photoUrl: string): Promise<string> {
  const { data: recipe, error: recErr } = await supabase
    .from('recipes')
    .insert({
      title: parsed.title,
      description: parsed.description ?? null,
      type: parsed.type,
      servings: parsed.servings ?? 2,
      instructions: parsed.instructions ?? '',
      photo_url: photoUrl,
    })
    .select('id')
    .single()
  if (recErr) throw new Error(`insert recipes: ${recErr.message}`)

  if (parsed.type === 'split' && Array.isArray(parsed.components)) {
    for (let idx = 0; idx < parsed.components.length; idx++) {
      const comp = parsed.components[idx]
      const { data: component, error: compErr } = await supabase
        .from('recipe_components')
        .insert({
          recipe_id: recipe.id,
          type: comp.type,
          name: comp.name,
          instructions: comp.instructions ?? '',
          display_order: idx,
        })
        .select('id')
        .single()
      if (compErr) throw new Error(`insert recipe_components (${comp.name}): ${compErr.message}`)

      const ings = Array.isArray(comp.ingredients) ? comp.ingredients : []
      if (ings.length > 0) {
        const { error: ingErr } = await supabase
          .from('recipe_component_ingredients')
          .insert(ings.map((ing: any) => ({
            component_id: component.id,
            name: ing.name,
            amount: ing.amount ?? '',
            unit: ing.unit ?? '',
          })))
        if (ingErr) throw new Error(`insert recipe_component_ingredients: ${ingErr.message}`)
      }
    }
  } else if (parsed.type === 'all_in_one' && Array.isArray(parsed.ingredients)) {
    if (parsed.ingredients.length > 0) {
      const { error: ingErr } = await supabase
        .from('recipe_ingredients')
        .insert(parsed.ingredients.map((ing: any) => ({
          recipe_id: recipe.id,
          name: ing.name,
          amount: ing.amount ?? '',
          unit: ing.unit ?? '',
        })))
      if (ingErr) throw new Error(`insert recipe_ingredients: ${ingErr.message}`)
    }
  }

  return recipe.id
}

async function processPair(pair: Pair): Promise<Result> {
  const frontPath = path.join(SOURCE_DIR, pair.front)
  const backPath = path.join(SOURCE_DIR, pair.back)
  try {
    const parsed = await parseWithClaude(frontPath, backPath)
    if (!parsed.title || !parsed.type) throw new Error('Parsed JSON missing title or type')

    if (await titleExists(parsed.title)) {
      return { status: 'skip', front: pair.front, back: pair.back, title: parsed.title, error: 'title already exists' }
    }

    const cropped = await cropFoodPhoto(frontPath)
    const prefix = pair.front.replace(/\.jpe?g$/i, '')
    const photoUrl = await uploadPhoto(cropped, prefix)

    const recipeId = await insertRecipe(parsed, photoUrl)
    return { status: 'ok', front: pair.front, back: pair.back, title: parsed.title, recipe_id: recipeId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { status: 'fail', front: pair.front, back: pair.back, error: msg }
  }
}

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE env vars. Run with: node --env-file=.env.local ...')
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Missing ANTHROPIC_API_KEY')
  }

  const files = (await fs.readdir(SOURCE_DIR))
    .filter(f => /\.jpe?g$/i.test(f))
    .sort()

  const pairs: Pair[] = []
  for (let i = 0; i + 1 < files.length; i += 2) {
    pairs.push({ front: files[i], back: files[i + 1] })
  }

  const toProcess = pairs.slice(0, Math.min(limit, pairs.length))
  console.log(`Found ${pairs.length} pairs; processing ${toProcess.length}`)

  const results: Result[] = []
  for (let i = 0; i < toProcess.length; i++) {
    const pair = toProcess[i]
    process.stdout.write(`[${i + 1}/${toProcess.length}] ${pair.front} + ${pair.back} ... `)
    const result = await processPair(pair)
    results.push(result)

    if (result.status === 'ok') {
      console.log(`✓ ${result.title} (${result.recipe_id})`)
    } else if (result.status === 'skip') {
      console.log(`⤼ SKIP: ${result.title} (${result.error})`)
    } else {
      console.log(`✗ FAIL: ${result.error}`)
    }

    if (i < toProcess.length - 1) await new Promise(r => setTimeout(r, 1500))
  }

  await fs.writeFile(LOG_FILE, JSON.stringify(results, null, 2))
  const ok = results.filter(r => r.status === 'ok').length
  const skip = results.filter(r => r.status === 'skip').length
  const fail = results.filter(r => r.status === 'fail').length
  console.log(`\nDone. ok=${ok} skip=${skip} fail=${fail}`)
  console.log(`Log: ${LOG_FILE}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
