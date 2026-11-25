'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AuthResponse, LoginInput } from '@shelfwise/shared';
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
import { DemoLoginButton } from './demo-login-button';

type FormValues = z.input<typeof LoginInput>;

export function LoginForm() {
  const next = safeNext(useSearchParams().get('next'));
  const redirectAfterAuth = useAuthRedirect();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues, unknown, LoginInput>({
    resolver: zodResolver(LoginInput),
  });

  const login = useMutation({
    mutationFn: (input: LoginInput) =>
      apiFetch('/auth/login', AuthResponse, { method: 'POST', json: input }),
    onSuccess: () => redirectAfterAuth(next),
    onError: (error) => {
      applyFieldErrors(error, setError, ['email', 'password']);
    },
  });

  const formError =
    login.error instanceof ApiError &&
    login.error.code === 'INVALID_CREDENTIALS'
      ? 'Wrong email or password.'
      : login.error &&
          !(
            login.error instanceof ApiError &&
            login.error.code === 'VALIDATION_FAILED'
          )
        ? errorMessage(login.error)
        : null;

  return (
    <div className="flex flex-col gap-6">
      <form
        noValidate
        onSubmit={handleSubmit((values) => login.mutate(values))}
        className="flex flex-col gap-4"
      >
        <FormAlert message={formError} />
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
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Button
          type="submit"
          pending={login.isPending}
          pendingLabel="Logging in…"
        >
          Log in
        </Button>
      </form>

      <Divider />
      <DemoLoginButton next={next} />

      <p className="text-center text-sm text-muted">
        New here?{' '}
        <Link
          href={
            next === '/'
              ? '/register'
              : `/register?next=${encodeURIComponent(next)}`
          }
          className="font-medium text-accent underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted" aria-hidden>
      <span className="h-px flex-1 bg-border" />
      or
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
