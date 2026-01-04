import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const supabase = createServiceClient();

    // Reset all tweets to show (remove old Claude filtering)
    const { error } = await supabase
      .from('tweets')
      .update({ filter_status: 'show', filter_category: 'engage' })
      .neq('replied', true); // Only reset unreplied tweets

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'All filters reset' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
