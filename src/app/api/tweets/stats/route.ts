import { NextResponse } from 'next/server';
import { getTweetStats } from '@/lib/sqlite';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET() {
  try {
    const stats = getTweetStats();
    return NextResponse.json(stats, { headers: corsHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stats error';
    console.error('Tweet stats error:', message);
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}
