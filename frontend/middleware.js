import { NextResponse } from 'next/server';

const PUBLIC_ROUTES = ['/login', '/register'];

export function middleware(req) {
  const { pathname } = req.nextUrl;

  // Allow Next.js internals and static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/public') ||
    pathname.startsWith('/uploads')
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get('av_token')?.value;
  const isPublic = PUBLIC_ROUTES.some((p) => pathname.startsWith(p));
  const isAuth = Boolean(token);

  if (!isAuth && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (isAuth && isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = '/feed';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api).*)'],
};
