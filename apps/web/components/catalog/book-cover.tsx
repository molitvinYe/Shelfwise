type CoverSize = 'M' | 'L';

const SIZES: Record<CoverSize, { width: number; height: number }> = {
  M: { width: 180, height: 270 },
  L: { width: 320, height: 480 },
};

export function coverUrl(coverId: number, size: CoverSize): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}

/**
 * Open Library cover by id, or a typographic placeholder. A plain `<img>` on purpose: covers
 * are already sized JPEGs and Vercel's image optimisation quota is small (docs/external-services.md).
 */
export function BookCover({
  coverId,
  title,
  size = 'M',
  priority = false,
  className = '',
}: {
  coverId: number | null;
  title: string;
  size?: CoverSize;
  priority?: boolean;
  className?: string;
}) {
  const base = `aspect-[2/3] w-full rounded-lg border border-border bg-border/30 object-cover ${className}`;
  if (!coverId) {
    return (
      <div
        className={`${base} flex items-center justify-center p-3 text-center`}
        aria-hidden
      >
        <span className="line-clamp-4 font-serif text-sm text-muted">
          {title}
        </span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- see the component comment
    <img
      src={coverUrl(coverId, size)}
      alt=""
      {...SIZES[size]}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      className={base}
    />
  );
}
