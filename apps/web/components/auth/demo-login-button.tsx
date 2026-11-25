'use client';

import { AuthResponse } from '@shelfwise/shared';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { apiFetch, errorMessage } from '@/lib/api/client';
import { useAuthRedirect } from '@/lib/auth/use-auth-redirect';

/** One-click login into the shared demo account (no credentials in the bundle, docs/adr/0003). */
export function DemoLoginButton({
  next = '/me',
  variant = 'secondary',
}: {
  next?: string;
  variant?: 'primary' | 'secondary';
}) {
  const redirectAfterAuth = useAuthRedirect();
  const demo = useMutation({
    mutationFn: () => apiFetch('/auth/demo', AuthResponse, { method: 'POST' }),
    onSuccess: () => redirectAfterAuth(next === '/' ? '/me' : next),
  });

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant={variant}
        onClick={() => demo.mutate()}
        pending={demo.isPending}
        pendingLabel="Opening the demo…"
      >
        Log in as demo
      </Button>
      {demo.error && (
        <p role="alert" className="text-xs text-danger">
          {errorMessage(demo.error)}
        </p>
      )}
    </div>
  );
}
