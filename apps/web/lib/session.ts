/**
 * The name of the session cookie the API sets.
 *
 * It is written here rather than read from the environment because the middleware that
 * needs it runs on the edge runtime, where `process.env` is replaced at build time and a
 * value set in Compose would never arrive. The other two places this name appears are
 * `SESSION_COOKIE_NAME` in `.env.example` and `sessionCookieName` in
 * `apps/api/src/common/config.ts`, whose default is the same string. Change one and
 * change all three.
 */
export const SESSION_COOKIE = 'treeline_session';
