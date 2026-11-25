import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';
import { AuthFormSkeleton } from '@/components/auth/auth-form-skeleton';

export const metadata: Metadata = { title: 'Log in' };

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">
        Welcome back
      </h1>
      <p className="mb-6 text-sm text-muted">
        Log in to your shelves and the AI advisor.
      </p>
      {/* The form reads ?next= (useSearchParams), so it renders behind a boundary. */}
      <Suspense fallback={<AuthFormSkeleton fields={2} />}>
        <LoginForm />
      </Suspense>
    </>
  );
}
