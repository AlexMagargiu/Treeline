import { NextRequest, NextResponse } from 'next/server';

import { SESSION_COOKIE } from '@/lib/session';

/**
 * The route guard. It checks that a session cookie is present and nothing more.
 *
 * It cannot do better. The cookie is an opaque 256-bit id with no signature, decided on
 * 2026-09-19 and recorded in docs/spec.md, so only Redis knows whether a session is still
 * live. Calling the API from here on every request to prove liveness would be a network
 * round trip on every navigation for a fact the next data call establishes anyway, and
 * the API is the authority: a 401 from any data call sends the user back to /login.
 */
export function middleware(request: NextRequest): NextResponse {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const login = new URL('/login', request.url);
  login.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  /*
   * Everything except the pages a stranger is allowed to reach and the files the browser
   * needs before there is a session: the login page itself, the health check the
   * container probe calls, the offline page the service worker precaches at install
   * time, the build output, the manifest, the worker and the icons.
   */
  matcher: [
    '/((?!login|health|offline|_next/|manifest.webmanifest|sw.js|icons/|favicon.ico).*)',
  ],
};
