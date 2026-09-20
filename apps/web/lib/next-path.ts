/**
 * Where the login page is allowed to send the browser after a successful login.
 *
 * The value arrives in the query string, so anybody can put anything in it. An absolute
 * URL or a protocol-relative one would make the login page an open redirect: a link to
 * our own login that lands on somebody else's site, with our hostname in the address bar
 * for the whole of the journey. Only a path on this origin is accepted, and everything
 * else falls back to home.
 */
const HOME = '/';

export function safeNextPath(value: string | null | undefined): string {
  if (!value) return HOME;

  // Must be a path on this origin. A second slash is protocol-relative ("//evil.test"),
  // and a backslash is the same thing to browsers that normalise it.
  if (value[0] !== '/') return HOME;
  if (value[1] === '/' || value[1] === '\\') return HOME;

  // A control character can break out of the Location header on a lenient client.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return HOME;

  return value;
}
