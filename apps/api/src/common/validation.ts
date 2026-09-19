import { ValidationPipe } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { ApiError } from './api-error';

function firstMessage(errors: ValidationError[]): string {
  for (const error of errors) {
    if (error.constraints) return Object.values(error.constraints)[0];
    if (error.children?.length) {
      const nested = firstMessage(error.children);
      if (nested) return nested;
    }
  }
  return 'The request is not valid.';
}

function unknownProperty(errors: ValidationError[]): string | undefined {
  return errors.find((error) => error.constraints?.whitelistValidation)?.property;
}

/**
 * The pipes are attached per handler rather than globally, because a global whitelisting
 * pipe strips an unknown property before a stricter pipe below it can object, and
 * PATCH /routes/:id has to answer 400 unknown_field rather than quietly ignore the field.
 */
export const VALIDATE = new ValidationPipe({
  transform: true,
  whitelist: true,
  exceptionFactory: (errors) =>
    new ApiError(400, 'invalid_request', firstMessage(errors as ValidationError[])),
});

/** Anything outside the editable fields is refused by name, never dropped in silence. */
export const VALIDATE_EDITS = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  exceptionFactory: (raw) => {
    const errors = raw as ValidationError[];
    const unknown = unknownProperty(errors);
    return unknown
      ? new ApiError(400, 'unknown_field', `${unknown} is not an editable field.`)
      : new ApiError(400, 'invalid_request', firstMessage(errors));
  },
});
