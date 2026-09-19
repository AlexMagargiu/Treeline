import { HttpRequest } from '../common/http';

/**
 * One cookie out of the header. cookie-parser exists to do this and would be a
 * dependency for six lines; the cookie carries a session id and nothing else, so there is
 * no signature to check and nothing to decode beyond percent encoding.
 */
export function readCookie(request: HttpRequest, name: string): string | undefined {
  for (const pair of request.headers.cookie?.split(';') ?? []) {
    const separator = pair.indexOf('=');
    if (separator < 0) continue;
    if (pair.slice(0, separator).trim() !== name) continue;
    return decodeURIComponent(pair.slice(separator + 1).trim());
  }
  return undefined;
}

/** The session id a request presents, by cookie or by bearer token. */
export function sessionIdOf(request: HttpRequest, cookieName: string): string | undefined {
  const authorization = request.headers.authorization;
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim() || undefined;
  }
  return readCookie(request, cookieName);
}
