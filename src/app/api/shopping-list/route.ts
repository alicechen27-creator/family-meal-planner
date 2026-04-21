import { NextResponse } from 'next/server'

// Superseded by /api/generate-shopping-list
export async function POST() {
  return NextResponse.json({ error: 'Use /api/generate-shopping-list instead' }, { status: 410 })
}
