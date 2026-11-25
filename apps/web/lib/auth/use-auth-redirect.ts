'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

/** After a session change: go to `href` and re-render Server Components (header, pages). */
export function useAuthRedirect() {
  const router = useRouter();
  return useCallback(
    (href: string) => {
      router.replace(href);
      router.refresh();
    },
    [router],
  );
}
