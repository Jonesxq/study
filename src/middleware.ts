import { NextResponse, type NextRequest } from 'next/server';

const PREFILTER_SESSION_COOKIE = 'notes_admin_session';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (!path.startsWith('/admin') || path === '/admin/login') {
    return NextResponse.next();
  }

  // This is only a UX prefilter. It does not validate the session; server
  // pages and API routes must call requireAdmin() for real authorization.
  if (request.cookies.get(PREFILTER_SESSION_COOKIE)?.value) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL('/admin/login', request.url));
}

export const config = {
  matcher: ['/admin/:path*'],
};
