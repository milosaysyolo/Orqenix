// SPDX-License-Identifier: Apache-2.0

'use client';

export interface ApiResult<T> { ok: boolean; status: number; data?: T; error?: string; }

async function call<T>(method: string, url: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    const text = await res.text();
    let data: T | undefined;
    try {
      data = text ? (JSON.parse(text) as T) : undefined;
    } catch {
      return { ok: false, status: res.status, error: 'Invalid JSON in response body' };
    }
    return { ok: res.ok, status: res.status, data, error: res.ok ? undefined : (data as { error?: string } | undefined)?.error ?? res.statusText };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : 'network error' };
  }
}

export const api = {
  get: <T,>(url: string) => call<T>('GET', url),
  post: <T,>(url: string, body?: unknown) => call<T>('POST', url, body),
  put: <T,>(url: string, body?: unknown) => call<T>('PUT', url, body),
  del: <T,>(url: string, body?: unknown) => call<T>('DELETE', url, body),
};
