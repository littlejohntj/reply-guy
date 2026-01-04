import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createServiceClient();

    const { data: profiles, error } = await supabase
      .from('style_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ profiles });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Configuration error';
    return NextResponse.json({ error: message, profiles: [] }, { status: 500 });
  }
}
