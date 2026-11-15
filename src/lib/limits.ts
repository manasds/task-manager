// Per-account caps. With a handful of accounts they keep the database far inside Neon's free 1 GB.

export const MAX_TASKS_PER_USER = 2_000;

export const MAX_CANVAS_TILES_PER_USER = 1_000;

export const MAX_CANVAS_SECTIONS_PER_USER = 50;

/** Connecting one more extension than this signs out the oldest. */
export const MAX_EXTENSION_KEYS_PER_USER = 5;

/** An account is at one of the caps above. The message is shown to the user as is. */
export class LimitError extends Error {}
