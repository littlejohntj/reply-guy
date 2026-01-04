import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();

    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Profile ID is required' }, { status: 400 });
    }

    // Deactivate all profiles first
    await supabase
      .from('style_profiles')
      .update({ active: false })
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all

    // Activate the selected profile
    const { error } = await supabase
      .from('style_profiles')
      .update({ active: true })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to activate profile';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
