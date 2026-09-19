import { hash } from '@node-rs/argon2';
import { ApiError } from '../common/api-error';
import { passwordMatches } from './password';

describe('passwordMatches', () => {
  // Hashing is deliberately slow, so the suite pays for one hash and reuses it.
  let encoded: string;

  beforeAll(async () => {
    encoded = await hash('the right password');
  }, 30_000);

  it('accepts the password the hash was made from', async () => {
    await expect(passwordMatches(encoded, 'the right password')).resolves.toBe(true);
  });

  it('refuses a wrong password', async () => {
    await expect(passwordMatches(encoded, 'the wrong password')).resolves.toBe(false);
  });

  it('refuses a password that differs only in case', async () => {
    await expect(passwordMatches(encoded, 'The Right Password')).resolves.toBe(false);
  });

  it('refuses an empty password', async () => {
    await expect(passwordMatches(encoded, '')).resolves.toBe(false);
  });

  it('is an argon2id hash', () => {
    expect(encoded.startsWith('$argon2id$')).toBe(true);
  });

  // A missing or unreadable hash is a broken deploy. Answering 401 would leave somebody
  // typing the right password into a site that cannot check it.
  it('reports a missing hash as a configuration error', async () => {
    await expect(passwordMatches(undefined, 'anything')).rejects.toBeInstanceOf(ApiError);
  });

  it('reports an unparseable hash as a configuration error', async () => {
    await expect(passwordMatches('not a hash', 'anything')).rejects.toBeInstanceOf(ApiError);
  });
});
