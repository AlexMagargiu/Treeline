/**
 * The parts of the Express request and response this API touches.
 *
 * express ships no types of its own and @types/express is not a dependency this work
 * authorised, so the shapes are named here rather than pulled in. They are also the
 * honest list: an interface of what the code reads and writes says more than the whole
 * Express surface, and the compiler still checks every use against it.
 */
export interface HttpRequest {
  headers: {
    cookie?: string;
    authorization?: string;
    'x-forwarded-for'?: string | string[];
  };
  socket: { remoteAddress?: string };
}

export interface CookieOptions {
  httpOnly: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  secure: boolean;
  path: string;
  maxAge: number;
}

export interface HttpResponse {
  cookie(name: string, value: string, options: CookieOptions): unknown;
  clearCookie(name: string, options: CookieOptions): unknown;
  status(code: number): HttpResponse;
  json(body: unknown): unknown;
  setHeader(name: string, value: string): unknown;
}
