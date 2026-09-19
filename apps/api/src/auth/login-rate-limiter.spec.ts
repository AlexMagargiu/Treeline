import { HttpRequest } from '../common/http';
import { clientAddress, Counter, countAttempt } from './login-rate-limiter';

/** Redis reduced to the three commands the limiter uses, with the clock under control. */
class FakeCounter implements Counter {
  private readonly counts = new Map<string, number>();
  private readonly expiries = new Map<string, number>();
  readonly expireCalls: [string, number][] = [];
  now = 0;

  incr(key: string): Promise<number> {
    this.sweep();
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);
    return Promise.resolve(next);
  }

  expire(key: string, seconds: number): Promise<number> {
    this.expireCalls.push([key, seconds]);
    this.expiries.set(key, this.now + seconds);
    return Promise.resolve(1);
  }

  ttl(key: string): Promise<number> {
    this.sweep();
    const expiry = this.expiries.get(key);
    return Promise.resolve(expiry === undefined ? -1 : expiry - this.now);
  }

  private sweep(): void {
    for (const [key, expiry] of this.expiries) {
      if (expiry <= this.now) {
        this.expiries.delete(key);
        this.counts.delete(key);
      }
    }
  }
}

const MAX = 5;
const WINDOW = 15 * 60;

describe('countAttempt', () => {
  let counter: FakeCounter;

  beforeEach(() => {
    counter = new FakeCounter();
  });

  const attempt = (address = '203.0.113.7') =>
    countAttempt(counter, address, MAX, WINDOW);

  it('allows the first five attempts and refuses the sixth', async () => {
    const verdicts = [];
    for (let i = 0; i < 6; i += 1) verdicts.push(await attempt());
    expect(verdicts.map((verdict) => verdict.allowed)).toEqual([
      true,
      true,
      true,
      true,
      true,
      false,
    ]);
  });

  it('answers the sixth attempt with the seconds left in the window', async () => {
    for (let i = 0; i < 5; i += 1) await attempt();
    counter.now = 100;
    const refused = await attempt();
    expect(refused).toEqual({ allowed: false, retryAfterSeconds: WINDOW - 100 });
  });

  // The window is fixed. Setting EXPIRE on every attempt would push the reset further
  // away each time somebody tried, which locks out the one person who knows the password.
  it('sets the expiry once, on the attempt that opens the window', async () => {
    for (let i = 0; i < 6; i += 1) await attempt();
    expect(counter.expireCalls).toEqual([['login:203.0.113.7', WINDOW]]);
  });

  it('starts counting again once the window has passed', async () => {
    for (let i = 0; i < 6; i += 1) await attempt();
    counter.now = WINDOW;
    await expect(attempt()).resolves.toEqual({ allowed: true, retryAfterSeconds: 0 });
  });

  it('counts each address separately', async () => {
    for (let i = 0; i < 6; i += 1) await attempt('203.0.113.7');
    await expect(attempt('198.51.100.4')).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  // Redis answers -1 for a key with no expiry, which should never happen here but would
  // otherwise reach the client as Retry-After: -1.
  it('falls back to the whole window when the key has no expiry', async () => {
    for (let i = 0; i < 5; i += 1) await attempt();
    counter.ttl = () => Promise.resolve(-1);
    await expect(attempt()).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: WINDOW,
    });
  });
});

describe('clientAddress', () => {
  const request = (headers: Record<string, string>, socket = '10.0.0.1'): HttpRequest => ({ headers, socket: { remoteAddress: socket } });

  it('takes the leftmost entry of X-Forwarded-For', () => {
    expect(
      clientAddress(request({ 'x-forwarded-for': '203.0.113.7, 10.0.0.2, 10.0.0.3' })),
    ).toBe('203.0.113.7');
  });

  it('handles a single entry without a comma', () => {
    expect(clientAddress(request({ 'x-forwarded-for': '203.0.113.7' }))).toBe('203.0.113.7');
  });

  it('falls back to the socket address when the header is absent', () => {
    expect(clientAddress(request({}))).toBe('10.0.0.1');
  });

  it('falls back to the socket address when the header is empty', () => {
    expect(clientAddress(request({ 'x-forwarded-for': '' }))).toBe('10.0.0.1');
  });
});
