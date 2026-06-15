// SPDX-License-Identifier: Apache-2.0
// Workbench API , Cross-project learning (Pro feature — returns 501 if Pro absent)

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    await import('@orqenix-pro/cross-project-federation');
    return NextResponse.json({ available: true, candidates: [] });
  } catch {
    return NextResponse.json(
      {
        available: false,
        error: 'Cross-project federation is an Orqenix Pro feature.',
        code: 'PRO_FEATURE_UNAVAILABLE',
      },
      { status: 501 }
    );
  }
}

export async function POST() {
  try {
    await import('@orqenix-pro/cross-project-federation');
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      {
        available: false,
        error: 'Cross-project federation is an Orqenix Pro feature.',
        code: 'PRO_FEATURE_UNAVAILABLE',
      },
      { status: 501 }
    );
  }
}
