import { verify } from '@node-rs/argon2';
import { ApiError } from '../common/api-error';

/**
 * The one shared password, compared against the argon2id hash in the environment.
 *
 * argon2's verify reads the salt and the cost parameters out of the encoded hash, so the
 * comparison needs nothing else, and it is constant time for a given hash. A hash that
 * the library cannot parse is a misconfiguration, not a wrong password, so it is an error
 * rather than a refusal: answering 401 would hide a broken deploy behind a login screen.
 */
export async function passwordMatches(hash: string | undefined, password: string): Promise<boolean> {
  if (!hash) {
    throw new ApiError(500, 'auth_not_configured', 'The site password is not configured.');
  }
  try {
    return await verify(hash, password);
  } catch {
    throw new ApiError(500, 'auth_not_configured', 'The site password is not configured.');
  }
}
