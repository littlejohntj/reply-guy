import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();

    const { tweetId, replied = true } = body;

    if (!tweetId) {
      return NextResponse.json({ error: 'Tweet ID is required' }, { status: 400 });
    }

    const updateData = replied
      ? { replied: true, replied_at: new Date().toISOString() }
      : { replied: false, replied_at: null };

    const { error } = await supabase
      .from('tweets')
      .update(updateData)
      .eq('id', tweetId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
