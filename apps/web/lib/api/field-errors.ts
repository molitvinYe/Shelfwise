import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from './client';

const Details = z.array(z.object({ path: z.string(), message: z.string() }));

/**
 * Maps the API's `VALIDATION_FAILED` details onto form fields.
 * Returns true when at least one field error was applied.
 */
export function applyFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): boolean {
  if (!(error instanceof ApiError) || error.code !== 'VALIDATION_FAILED')
    return false;
  const parsed = Details.safeParse(error.details);
  if (!parsed.success) return false;

  let applied = false;
  for (const { path, message } of parsed.data) {
    const field = fields.find((f) => f === path);
    if (field) {
      setError(field, { message });
      applied = true;
    }
  }
  return applied;
}
