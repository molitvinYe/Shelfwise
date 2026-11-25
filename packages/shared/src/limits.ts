/** Page size bounds for every cursor-paginated list (docs/adr/0005-cursor-pagination.md). */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;
/** Opaque cursors are base64url JSON; anything longer is not one of ours. */
export const CURSOR_MAX = 500;
