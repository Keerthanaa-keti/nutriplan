import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync } from 'fs';
import { join } from 'path';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const { filename, data } = await request.json();
    const safeName = filename.replace(/[^a-zA-Z0-9_.-]/g, '');
    const filePath = join('/tmp', safeName);
    writeFileSync(filePath, JSON.stringify(data));
    return NextResponse.json({ success: true, path: filePath, count: Array.isArray(data) ? data.length : 0 }, { headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
