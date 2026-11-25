'use client';

import {
  REVIEW_MAX,
  ShelfEntry,
  type ShelfStatus,
  type UpsertShelfInput,
} from '@shelfwise/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { apiFetch, errorMessage } from '@/lib/api/client';

const STATUSES: { value: ShelfStatus; label: string }[] = [
  { value: 'WANT', label: 'Want to read' },
  { value: 'READING', label: 'Reading' },
  { value: 'READ', label: 'Read' },
];

type Change = { kind: 'put'; input: UpsertShelfInput } | { kind: 'remove' };

/** What the entry will look like once the server accepts the change. */
export function applyChange(
  prev: ShelfEntry | null,
  change: Change,
  bookId: string,
): ShelfEntry | null {
  if (change.kind === 'remove') return null;
  const { input } = change;
  return {
    bookId,
    status: input.status,
    rating: input.rating !== undefined ? input.rating : (prev?.rating ?? null),
    // Mirrors the server: trimmed, empty means no review.
    review:
      input.review !== undefined
        ? input.review?.trim() || null
        : (prev?.review ?? null),
    isReviewHidden: prev?.isReviewHidden ?? false,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Optimistic shelf controls: the UI changes immediately, the request runs in the background,
 * and a failure rolls back with a message. Mutations for one book run serially (`scope`), so a
 * slow early response can't overwrite a later change.
 */
export function ShelfControls({
  bookId,
  initial,
}: {
  bookId: string;
  initial: ShelfEntry | null;
}) {
  const queryClient = useQueryClient();
  const key = ['shelf', bookId] as const;
  const [error, setError] = useState<string | null>(null);

  const { data: entry = null } = useQuery({
    queryKey: key,
    queryFn: () => initial, // seeded from the server render; changes come from mutations
    initialData: initial,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const mutation = useMutation({
    mutationKey: key,
    scope: { id: `shelf-${bookId}` },
    mutationFn: async (change: Change): Promise<ShelfEntry | null> => {
      if (change.kind === 'remove') {
        await apiFetch(`/shelves/${bookId}`, undefined, { method: 'DELETE' });
        return null;
      }
      return apiFetch(`/shelves/${bookId}`, ShelfEntry, {
        method: 'PUT',
        json: change.input,
      });
    },
    onMutate: async (change) => {
      setError(null);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ShelfEntry | null>(key) ?? null;
      queryClient.setQueryData(key, applyChange(previous, change, bookId));
      return { previous };
    },
    onError: (err, _change, context) => {
      queryClient.setQueryData(key, context?.previous ?? null);
      setError(
        `Couldn’t save your change, so it was undone. ${errorMessage(err)}`,
      );
    },
    onSuccess: (saved) => {
      // Only the last queued change may write the server state; earlier ones would flash back.
      if (queryClient.isMutating({ mutationKey: key }) <= 1)
        queryClient.setQueryData(key, saved);
    },
  });

  const put = (
    input: Omit<UpsertShelfInput, 'status'> & { status?: ShelfStatus },
  ) =>
    mutation.mutate({
      kind: 'put',
      input: { ...input, status: input.status ?? entry?.status ?? 'READ' },
    });

  return (
    <section
      aria-labelledby="shelf-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4"
    >
      <h2 id="shelf-heading" className="text-sm font-semibold">
        Your shelf
      </h2>

      <StatusPicker
        value={entry?.status ?? null}
        onChange={(status) => put({ status })}
        onRemove={entry ? () => mutation.mutate({ kind: 'remove' }) : undefined}
      />

      {entry && (
        <RatingStars
          value={entry.rating}
          onChange={(rating) => put({ rating })}
        />
      )}

      {entry && (entry.status === 'READ' || entry.review) && (
        <ReviewForm
          key={entry.review ?? ''}
          review={entry.review}
          hidden={entry.isReviewHidden}
          saving={
            mutation.isPending &&
            mutation.variables?.kind === 'put' &&
            mutation.variables.input.review !== undefined
          }
          onSave={(review) => put({ review })}
        />
      )}

      <FormAlert message={error} />
    </section>
  );
}

function StatusPicker({
  value,
  onChange,
  onRemove,
}: {
  value: ShelfStatus | null;
  onChange: (status: ShelfStatus) => void;
  onRemove?: () => void;
}) {
  const name = useId();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <fieldset className="flex flex-wrap gap-1 rounded-lg border border-border p-1">
        <legend className="sr-only">Shelf</legend>
        {STATUSES.map((s) => (
          <label key={s.value} className="relative">
            <input
              type="radio"
              name={name}
              value={s.value}
              checked={value === s.value}
              onChange={() => onChange(s.value)}
              className="peer sr-only"
            />
            <span className="block cursor-pointer rounded-md px-3 py-1.5 text-sm text-muted transition peer-checked:bg-accent peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent hover:text-foreground peer-checked:hover:text-white">
              {s.label}
            </span>
          </label>
        ))}
      </fieldset>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="text-sm text-muted underline-offset-4 hover:text-danger hover:underline"
        >
          Remove from shelves
        </button>
      )}
    </div>
  );
}

function RatingStars({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (rating: number | null) => void;
}) {
  const name = useId();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <fieldset className="flex items-center gap-0.5">
        <legend className="mb-1 text-xs font-medium text-muted">
          Your rating
        </legend>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="relative">
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="peer sr-only"
            />
            <span className="sr-only">
              {n} {n === 1 ? 'star' : 'stars'}
            </span>
            <span
              aria-hidden
              className={`block cursor-pointer rounded px-0.5 text-2xl leading-none transition peer-focus-visible:outline-2 peer-focus-visible:outline-accent hover:scale-110 ${
                value !== null && n <= value ? 'text-accent' : 'text-border'
              }`}
            >
              ★
            </span>
          </label>
        ))}
      </fieldset>
      {value !== null && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="self-end text-xs text-muted underline-offset-4 hover:underline"
        >
          Clear rating
        </button>
      )}
    </div>
  );
}

function ReviewForm({
  review,
  hidden,
  saving,
  onSave,
}: {
  review: string | null;
  hidden: boolean;
  saving: boolean;
  onSave: (review: string) => void;
}) {
  const id = useId();
  const [text, setText] = useState(review ?? '');
  const dirty = text.trim() !== (review ?? '');

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty) onSave(text);
      }}
    >
      <label htmlFor={id} className="text-xs font-medium text-muted">
        Your review
      </label>
      {hidden && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
          A moderator hid this review. Only you can see it; editing won’t make
          it public again.
        </p>
      )}
      <textarea
        id={id}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={REVIEW_MAX}
        rows={4}
        placeholder="What did you think?"
        aria-describedby={`${id}-count`}
        className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-base outline-none transition focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 sm:text-sm"
      />
      <div className="flex items-center justify-between gap-3">
        <span id={`${id}-count`} className="text-xs text-muted">
          {text.length} / {REVIEW_MAX}
        </span>
        <div className="flex gap-2">
          {review && (
            <Button
              variant="ghost"
              type="button"
              onClick={() => onSave('')}
              disabled={saving}
            >
              Delete review
            </Button>
          )}
          <Button
            type="submit"
            variant="secondary"
            disabled={!dirty}
            pending={saving}
            pendingLabel="Saving…"
          >
            {review ? 'Update review' : 'Publish review'}
          </Button>
        </div>
      </div>
    </form>
  );
}
