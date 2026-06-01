import { NextResponse } from 'next/server';

export function redirectTo(request: Request, path: string, init?: ResponseInit): NextResponse {
  return NextResponse.redirect(resolveRedirectUrl(request, path), init);
}

export function resolveRedirectUrl(request: Request, path: string): URL {
  return new URL(path, resolveRedirectBase(request));
}

function resolveRedirectBase(request: Request): string {
  const configuredSiteUrl = process.env.SITE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configuredSiteUrl && isHttpUrl(configuredSiteUrl)) {
    return configuredSiteUrl;
  }

  return request.url;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
