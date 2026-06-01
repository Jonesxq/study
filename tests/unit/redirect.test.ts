import { afterEach, describe, expect, it } from 'vitest';
import { resolveRedirectUrl } from '@/lib/http/redirect';

const originalSiteUrl = process.env.SITE_URL;
const originalNextPublicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  process.env.SITE_URL = originalSiteUrl;
  process.env.NEXT_PUBLIC_SITE_URL = originalNextPublicSiteUrl;
});

describe('resolveRedirectUrl', () => {
  it('uses the request URL when no site URL is configured', () => {
    delete process.env.SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;

    const url = resolveRedirectUrl(new Request('https://example.test/api/admin/login'), '/admin');

    expect(url.toString()).toBe('https://example.test/admin');
  });

  it('uses SITE_URL for redirects behind a reverse proxy', () => {
    process.env.SITE_URL = 'https://weixianmanbu.shop';
    delete process.env.NEXT_PUBLIC_SITE_URL;

    const url = resolveRedirectUrl(new Request('https://localhost:3000/api/admin/login'), '/admin');

    expect(url.toString()).toBe('https://weixianmanbu.shop/admin');
  });

  it('falls back to NEXT_PUBLIC_SITE_URL when SITE_URL is not set', () => {
    delete process.env.SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = 'https://notes.example.com';

    const url = resolveRedirectUrl(new Request('https://localhost:3000/api/admin/login'), '/admin/login?error=1');

    expect(url.toString()).toBe('https://notes.example.com/admin/login?error=1');
  });

  it('ignores invalid configured site URLs', () => {
    process.env.SITE_URL = 'weixianmanbu.shop';
    process.env.NEXT_PUBLIC_SITE_URL = 'ftp://weixianmanbu.shop';

    const url = resolveRedirectUrl(new Request('https://example.test/api/admin/login'), '/admin');

    expect(url.toString()).toBe('https://example.test/admin');
  });
});
