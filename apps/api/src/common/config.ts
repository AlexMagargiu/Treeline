// Read through getters rather than frozen at import, because the e2e suite sets these
// before it builds the module and a value captured at import time would be the wrong one.
export const config = {
  get sessionCookieName(): string {
    return process.env.SESSION_COOKIE_NAME || 'treeline_session';
  },
  get sessionTtlDays(): number {
    return Number(process.env.SESSION_TTL_DAYS || 30);
  },
  get loginMaxAttempts(): number {
    return Number(process.env.LOGIN_MAX_ATTEMPTS || 5);
  },
  get loginWindowMinutes(): number {
    return Number(process.env.LOGIN_WINDOW_MINUTES || 15);
  },
  get redisUrl(): string {
    return process.env.REDIS_URL || 'redis://redis:6379';
  },
  // The one user, until there is a user table. Every row that belongs to a person carries
  // it, and edit_log.by records it, so an edit made today still names somebody once
  // accounts arrive.
  get ownerId(): string {
    return process.env.SEED_OWNER_ID || '00000000-0000-0000-0000-000000000001';
  },
};
