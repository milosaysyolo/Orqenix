// SPDX-License-Identifier: Apache-2.0
// Workbench API , Cross-project learning (Pro feature — returns 501 if Pro absent)

import { NextResponse } from 'next/server';

async function tryImportPro() {
  try {
    await import(/* webpackIgnore: true */ '@orqenix-pro/cross-project-federation');
    return true;
  } catch { return false; }
}

export async function GET() {
  const available = await tryImportPro();
    if (available) {
    return NextResponse.json({ available: true, candidates: [] });
  }
  return NextResponse.json(
    {
      available: false,
      error: 'Cross-project federation is an Orqenix Pro feature.',
      code: 'PRO_FEATURE_UNAVAILABLE',
    },
    { status: 501 }
  );
}

export async function POST() {
  const available = await tryImportPro();
    if (available) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json(
    {
      available: false,
      error: 'Cross-project federation is an Orqenix Pro feature.',
      code: 'PRO_FEATURE_UNAVAILABLE',
    },
    { status: 501 }
  );
}
