import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const includeAll = searchParams.get('all') === 'true';

    // Only show tweets from last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from('tweets')
      .select('*')
      .gte('posted_at', sevenDaysAgo)
      .order('posted_at', { ascending: false })
      .limit(100);

    // By default, only show tweets that haven't been replied to or skipped
    if (!includeAll) {
      query = query
        .eq('replied', false)
        .neq('filter_status', 'skip');
    }

    const { data: tweets, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tweets });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Configuration error';
    return NextResponse.json({ error: message, tweets: [] }, { status: 500 });
  }
}
