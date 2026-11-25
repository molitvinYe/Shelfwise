'use client';

import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api/client';
import { useAuthRedirect } from '@/lib/auth/use-auth-redirect';

export function LogoutButton() {
  const redirectAfterAuth = useAuthRedirect();
  const logout = useMutation({
    mutationFn: () => apiFetch('/auth/logout', undefined, { method: 'POST' }),
    // Go home either way: after a refresh the header shows the real session state.
    onSettled: () => redirectAfterAuth('/'),
  });

  return (
    <Button
      variant="ghost"
      onClick={() => logout.mutate()}
      pending={logout.isPending}
      pendingLabel="Logging out…"
      className="px-3 py-1.5"
    >
      Log out
    </Button>
  );
}
