import { HttpStatus, StandardSchemaValidationPipe } from '@nestjs/common';
import { AppException } from '../errors/app.exception.js';

export interface ValidationIssue {
  path: string;
  message: string;
}

type IssuePathSegment = PropertyKey | { key: PropertyKey };

function formatPath(path: readonly IssuePathSegment[] | undefined): string {
  return (path ?? [])
    .map((segment) =>
      String(typeof segment === 'object' ? segment.key : segment),
    )
    .join('.');
}

/**
 * Global validation pipe: routes declare schemas with `@Body({ schema })`, `@Query({ schema })`, `@Param(..., { schema })`
 * using Zod schemas from `@shelfwise/shared`. Failures become `400 VALIDATION_FAILED` with per-field details.
 */
export function createValidationPipe(): StandardSchemaValidationPipe {
  return new StandardSchemaValidationPipe({
    exceptionFactory: (issues) =>
      new AppException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'Request validation failed',
        issues.map((issue): ValidationIssue => ({
          path: formatPath(issue.path),
          message: issue.message,
        })),
      ),
  });
}
