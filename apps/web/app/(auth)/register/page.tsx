import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthFormSkeleton } from '@/components/auth/auth-form-skeleton';
import { RegisterForm } from '@/components/auth/register-form';

export const metadata: Metadata = { title: 'Create an account' };

export default function RegisterPage() {
  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">
        Create your account
      </h1>
      <p className="mb-6 text-sm text-muted">
        Track what you read and get recommendations from the catalog.
      </p>
      <Suspense fallback={<AuthFormSkeleton fields={3} />}>
        <RegisterForm />
      </Suspense>
    </>
  );
}
