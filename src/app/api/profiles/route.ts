import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createServiceClient();

    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get tweet counts per profile
    const { data: tweets } = await supabase
      .from('tweets')
      .select('author_handle, replied, filter_status');

    const tweetCounts: Record<string, { total: number; pending: number }> = {};
    for (const t of tweets || []) {
      const handle = t.author_handle?.toLowerCase();
      if (!handle) continue;
      if (!tweetCounts[handle]) {
        tweetCounts[handle] = { total: 0, pending: 0 };
      }
      tweetCounts[handle].total++;
      if (!t.replied && t.filter_status !== 'skip') {
        tweetCounts[handle].pending++;
      }
    }

    // Attach counts to profiles
    const profilesWithCounts = (profiles || []).map(p => ({
      ...p,
      tweet_count: tweetCounts[p.twitter_handle?.toLowerCase()]?.total || 0,
      pending_count: tweetCounts[p.twitter_handle?.toLowerCase()]?.pending || 0,
    }));

    return NextResponse.json({ profiles: profilesWithCounts });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Configuration error';
    return NextResponse.json({ error: message, profiles: [] }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();

    const { username, displayName } = body;

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    // Check if profile already exists
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('twitter_handle', username.toLowerCase())
      .single();

    if (existing) {
      return NextResponse.json({ message: 'Profile already exists', profile: existing });
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .insert({
        twitter_handle: username.toLowerCase(),
        display_name: displayName || username,
        priority: 'medium',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ profile });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Configuration error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Profile ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Configuration error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
