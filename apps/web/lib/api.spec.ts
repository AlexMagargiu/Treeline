import { ApiError, apiGet, loginUrl } from './api';

const realFetch = globalThis.fetch;

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('loginUrl', () => {
  it('carries the path to come back to', () => {
    expect(loginUrl('/massif/abc')).toBe('/login?next=%2Fmassif%2Fabc');
  });

  it('encodes a query string rather than losing it', () => {
    expect(loginUrl('/massif/abc?open=list')).toBe('/login?next=%2Fmassif%2Fabc%3Fopen%3Dlist');
  });
});

describe('apiGet', () => {
  it('returns the parsed body on success', async () => {
    globalThis.fetch = jest.fn(async () => reply(200, [{ id: 'a' }])) as typeof fetch;
    await expect(apiGet<{ id: string }[]>('/api/massifs')).resolves.toEqual([{ id: 'a' }]);
  });

  it('sends the cookie, because the session is the whole authorisation', async () => {
    const spy = jest.fn(async () => reply(200, {}));
    globalThis.fetch = spy as unknown as typeof fetch;
    await apiGet('/api/massifs');
    expect(spy).toHaveBeenCalledWith('/api/massifs', expect.objectContaining({
      credentials: 'same-origin',
    }));
  });

  it('calls a dead network offline rather than a server error', async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    await expect(apiGet('/api/massifs')).rejects.toMatchObject({ kind: 'offline', status: null });
  });

  it('marks an expired session so the screen can send it to the gate', async () => {
    globalThis.fetch = jest.fn(async () =>
      reply(401, { error: { code: 'no_session', message: 'Log in first.' } }),
    ) as typeof fetch;
    await expect(apiGet('/api/massifs')).rejects.toMatchObject({
      kind: 'unauthorized',
      status: 401,
    });
  });

  it('carries the API error code and message through', async () => {
    globalThis.fetch = jest.fn(async () =>
      reply(400, { error: { code: 'invalid_request', message: 'Not a uuid.' } }),
    ) as typeof fetch;
    await expect(apiGet('/api/routes?massif=nope')).rejects.toMatchObject({
      kind: 'server',
      status: 400,
      code: 'invalid_request',
      message: 'Not a uuid.',
    });
  });

  it('still fails usefully when the error body is not json', async () => {
    globalThis.fetch = jest.fn(
      async () => new Response('<html>502</html>', { status: 502 }),
    ) as typeof fetch;
    const error = await apiGet('/api/massifs').catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'server', status: 502, code: null });
  });

  it('lets an abort through untouched, so a cancelled request is not an error state', async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new DOMException('aborted', 'AbortError');
    }) as typeof fetch;
    await expect(apiGet('/api/massifs')).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('emits no em dash and no en dash in any message it writes', async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    const error = (await apiGet('/api/massifs').catch((cause: unknown) => cause)) as ApiError;
    expect(error.message).not.toMatch(/[\u2013\u2014]/);
  });
});
