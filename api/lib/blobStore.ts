import { put, head, del, BlobNotFoundError } from '@vercel/blob';
import type { PutBlobResult, HeadBlobResult } from '@vercel/blob';

/**
 * Thin, typed wrapper around `@vercel/blob` for JSON payloads.
 *
 * Centralizes content-type, access mode, and "404 returns null" semantics so
 * every endpoint doesn't reimplement them.
 *
 * Access mode: every blob is created with `access: 'public'`. Vercel Blob has
 * no per-blob ACL — security is enforced by path obscurity (unguessable
 * user-id / token segments) plus server-mediated access (clients hit
 * `/api/...` endpoints, never the raw blob URL).
 */

export interface PutJsonOptions {
  /** Whether overwriting an existing blob is permitted. Default: false. */
  allowOverwrite?: boolean;
  /** Append a random suffix to the blob path. Default: false (we use deterministic paths). */
  addRandomSuffix?: boolean;
}

/**
 * Write a JSON-serializable value to a blob path.
 * Always uses content-type `application/json` and access `public`.
 */
export async function putJson(
  path: string,
  value: unknown,
  options: PutJsonOptions = {}
): Promise<PutBlobResult> {
  return put(path, JSON.stringify(value), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: options.addRandomSuffix ?? false,
    allowOverwrite: options.allowOverwrite ?? false,
  });
}

/**
 * Fetch and parse a JSON blob.
 * Returns `null` only when the blob is genuinely absent (404). Operational
 * failures — auth misconfiguration, transient outage, parse errors — propagate
 * so callers can distinguish "not there" from "couldn't reach storage."
 *
 * Path is intentionally omitted from thrown error messages because sync paths
 * embed user-identifying segments that should not appear in logs / 5xx bodies.
 */
export async function getJson<T>(path: string): Promise<T | null> {
  let info: HeadBlobResult;
  try {
    info = await head(path);
  } catch (error) {
    if (error instanceof BlobNotFoundError) return null;
    throw error;
  }

  const response = await fetch(info.url);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`blobStore.getJson failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

/**
 * Check whether a blob exists at `path` without fetching its body.
 * Returns the head metadata if found, `null` if absent (404). Other errors
 * propagate — see `getJson` for the rationale.
 */
export async function headBlob(path: string): Promise<HeadBlobResult | null> {
  try {
    return await head(path);
  } catch (error) {
    if (error instanceof BlobNotFoundError) return null;
    throw error;
  }
}

/**
 * Delete a blob at `path`.
 * Mirrors the existing share-feature behavior: errors propagate to the caller
 * (Vercel Blob does not throw on a missing blob, so this is effectively idempotent).
 */
export async function deleteBlob(path: string): Promise<void> {
  await del(path);
}
