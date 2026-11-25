'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AuthResponse, PASSWORD_MIN, RegisterInput } from '@shelfwise/shared';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { TextField } from '@/components/ui/text-field';
import { ApiError, apiFetch, errorMessage } from '@/lib/api/client';
import { applyFieldErrors } from '@/lib/api/field-errors';
import { safeNext } from '@/lib/auth/safe-next';
import { useAuthRedirect } from '@/lib/auth/use-auth-redirect';

type FormValues = z.input<typeof RegisterInput>;

export function RegisterForm() {
  const next = safeNext(useSearchParams().get('next'), '/me');
  const redirectAfterAuth = useAuthRedirect();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues, unknown, RegisterInput>({
    resolver: zodResolver(RegisterInput),
  });

  const signup = useMutation({
    mutationFn: (input: RegisterInput) =>
      apiFetch('/auth/register', AuthResponse, { method: 'POST', json: input }),
    onSuccess: () => redirectAfterAuth(next),
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'EMAIL_TAKEN') {
        setError('email', {
          message: 'An account with this email already exists.',
        });
        return;
      }
      applyFieldErrors(error, setError, ['email', 'password', 'displayName']);
    },
  });

  const handled =
    signup.error instanceof ApiError &&
    (signup.error.code === 'EMAIL_TAKEN' ||
      signup.error.code === 'VALIDATION_FAILED');
  const formError =
    signup.error && !handled ? errorMessage(signup.error) : null;

  return (
    <div className="flex flex-col gap-6">
      <form
        noValidate
        onSubmit={handleSubmit((values) => signup.mutate(values))}
        className="flex flex-col gap-4"
      >
        <FormAlert message={formError} />
        <TextField
          label="Name"
          autoComplete="name"
          hint="Shown on your public profile and reviews."
          error={errors.displayName?.message}
          {...register('displayName')}
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          hint={`At least ${PASSWORD_MIN} characters.`}
          error={errors.password?.message}
          {...register('password')}
        />
        <Button
          type="submit"
          pending={signup.isPending}
          pendingLabel="Creating account…"
        >
          Create account
        </Button>
      </form>

      <p className="text-center text-sm text-muted">
        Already have an account?{' '}
        <Link
          href={
            next === '/me'
              ? '/login'
              : `/login?next=${encodeURIComponent(next)}`
          }
          className="font-medium text-accent underline-offset-4 hover:underline"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
