import { NextRequest, NextResponse } from 'next/server';
import { clearServerSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await clearServerSession();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: '서버 오류', details: String(error) }, { status: 500 });
  }
}

