/**
 * API client for cloud sharing endpoints.
 *
 * All functions return Result<T, ApiError> for consistent error handling
 * that integrates with the centralized error system.
 */

import type { Layout, SharePermission } from '@/core/types';
import type { LinkedDesignExport } from '@/core/storage';
import type { Result, ApiError, StorageMeshMissingError, ValidationError } from '@/core/result';
import {
  ok,
  err,
  isErr,
  apiServerError,
  apiNetworkError,
  validationImportFailed,
} from '@/core/result';
import { isApiErrorResponse, mapApiErrorResponse } from './mapApiError';
import { MISSING_DEPENDENCY_STATUS } from '@/core/sync/payloadKey';
import { useSessionStore } from '@/core/sync/session/useSession';
import { isMeshAssetRef, type MeshAssetEntry } from '@/shared/generation/meshAsset';
import { forgetHeldMeshes, meshCloudSession, uploadMeshFiles } from '@/shared/generation/meshCloud';
import { validateImport } from '@/shared/utils/validation';
import { generateLayoutId } from '@/shared/utils/uuid';

// API Response types
export interface ShareResponse {
  id: string;
  url: string;
  deleteToken: string;
  permission: SharePermission;
}

export interface ShareMetadata {
  createdAt: string;
  lastUpdatedAt?: string;
  permission: SharePermission;
  authorName?: string;
}

export interface SharedLinkedDesign {
  id: string;
  name: string;
  /** Bin params; absent on an assembly entry. */
  params?: unknown;
  /** Workshop assembly entries carry envelope + structure instead of params. */
  kind?: 'assembly';
  envelope?: unknown;
  structure?: unknown;
}

export interface FetchShareResponse {
  layout: Layout;
  /** Bin designs the layout's bins reference. Absent on older shares. */
  linkedDesigns?: SharedLinkedDesign[];
  /** CDN URL of each mesh file the linked designs name by ref, by hash. */
  meshFiles?: Record<string, string>;
  metadata: ShareMetadata;
}

/**
 * The header `apiFetch` sends: the share endpoints run the CSRF check on a
 * share naming mesh files, since that one speaks for the signed-in account.
 */
const SHARE_HEADERS = { 'X-Requested-With': 'gflt' };

/**
 * Mirrors MAX_LINKED_DESIGNS_BYTES in api/lib/sharedDesignsValidation.ts.
 * Trimming here keeps an oversized design set (realistically: imported-mesh
 * designs carrying base64 geometry) from turning the whole share into a 400.
 */
const LINKED_DESIGNS_BUDGET_BYTES = 512 * 1024;

/**
 * Mirror the server's per-design caps: MAX_ASSEMBLY_DESIGN_BYTES in
 * api/lib/sharedDesignsValidation.ts, and CONSTRAINTS.MAX_PAYLOAD_BYTES in
 * api/lib/designerValidationConstants.ts for a bin without inline mesh assets
 * (a bin carrying them is bounded by the total). One entry over either fails
 * the whole share, so it is skipped instead.
 */
const ASSEMBLY_DESIGN_BUDGET_BYTES = 100 * 1024;
const BIN_DESIGN_BUDGET_BYTES = 100_000;

function exceedsSingleDesignBudget(design: LinkedDesignExport): boolean {
  if (design.kind === 'assembly') {
    const size = JSON.stringify({ envelope: design.envelope, structure: design.structure }).length;
    return size > ASSEMBLY_DESIGN_BUDGET_BYTES;
  }
  if (meshAssetsOf(design).some((asset) => !isMeshAssetRef(asset))) return false;
  return JSON.stringify(design.params ?? null).length > BIN_DESIGN_BUDGET_BYTES;
}

function meshAssetsOf(design: { readonly params?: unknown }): MeshAssetEntry[] {
  const params = design.params as { meshAssets?: Record<string, MeshAssetEntry> } | undefined;
  return params?.meshAssets ? Object.values(params.meshAssets) : [];
}

/**
 * Resolve a layout's linked designs, dropping any that would push the payload
 * past the server's budget. Order is preserved so the result is deterministic;
 * a single oversized design is skipped rather than starving the rest.
 *
 * Each entry is measured whole, which slightly overcounts against the server
 * (it counts only params, or envelope + structure), so a set within this
 * budget is always within the server's total.
 */
async function collectDesignsForShare(
  layout: Layout,
  options: { readonly meshRefs?: boolean } = {}
): Promise<Result<SharedLinkedDesign[], StorageMeshMissingError>> {
  const { collectLinkedDesigns } = await import('@/core/storage/ShareService');
  const designs = await collectLinkedDesigns(layout, options);
  if (isErr(designs)) return designs;

  const withinBudget: SharedLinkedDesign[] = [];
  let bytes = 0;
  for (const design of designs.value) {
    if (exceedsSingleDesignBudget(design)) continue;
    const size = JSON.stringify(design).length;
    if (bytes + size > LINKED_DESIGNS_BUDGET_BYTES) continue;
    bytes += size;
    withinBudget.push(design);
  }
  return ok(withinBudget);
}

/**
 * The linked designs naming their meshes by ref, once the signed-in account
 * holds every file they name, or null when the meshes must travel inline: a
 * signed-out sharer, a server without a mesh store, a file it would not take,
 * or one this device lacks.
 */
async function designsWithMeshRefs(layout: Layout): Promise<SharedLinkedDesign[] | null> {
  if (useSessionStore.getState().status !== 'authenticated') return null;
  // Taken before the designs are read, so files read for this account are
  // never uploaded under one that signs in meanwhile.
  const session = meshCloudSession();
  const collected = await collectDesignsForShare(layout, { meshRefs: true });
  if (isErr(collected)) return null;
  const hashes = collected.value.flatMap((design) =>
    meshAssetsOf(design).flatMap((asset) => (isMeshAssetRef(asset) ? [asset.hash] : []))
  );
  // With no file to name, refs gain nothing, and a design the ref budget
  // skipped may still fit inline, where its mesh lifts the per-design cap.
  if (hashes.length === 0) return null;
  try {
    return (await uploadMeshFiles(hashes, session)).status === 'held' ? collected.value : null;
  } catch {
    return null;
  }
}

/**
 * Send the linked designs with their meshes by ref when the account holds the
 * files, else inline. A 424 lists files the server found unheld after all (an
 * upload this page remembered from another account), so the share goes again
 * inline and the next upload of those files starts over.
 */
async function sendLinkedDesigns(
  layout: Layout,
  send: (linkedDesigns: SharedLinkedDesign[]) => Promise<Response>
): Promise<Result<Response, StorageMeshMissingError>> {
  const withRefs = await designsWithMeshRefs(layout);
  if (withRefs) {
    const response = await send(withRefs);
    if (response.status !== MISSING_DEPENDENCY_STATUS) return ok(response);
    forgetHeldMeshes(await readMissing(response));
  }
  const inline = await collectDesignsForShare(layout);
  return isErr(inline) ? inline : ok(await send(inline.value));
}

async function readMissing(response: Response): Promise<string[]> {
  try {
    const { missing } = (await response.json()) as { missing?: unknown };
    return Array.isArray(missing) ? missing.filter((m): m is string => typeof m === 'string') : [];
  } catch {
    return [];
  }
}

export interface UpdateShareResponse {
  id: string;
  url: string;
  permission: SharePermission;
}

// Type guards for runtime validation of API responses

function isShareResponse(data: unknown): data is ShareResponse {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    'id' in data &&
    'url' in data &&
    'deleteToken' in data &&
    'permission' in data &&
    typeof obj.id === 'string' &&
    typeof obj.url === 'string' &&
    typeof obj.deleteToken === 'string' &&
    (obj.permission === 'view' || obj.permission === 'edit')
  );
}

function isUpdateShareResponse(data: unknown): data is UpdateShareResponse {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    'id' in data &&
    'url' in data &&
    'permission' in data &&
    typeof obj.id === 'string' &&
    typeof obj.url === 'string' &&
    (obj.permission === 'view' || obj.permission === 'edit')
  );
}

/**
 * Basic structural check for FetchShareResponse.
 * Does not validate Layout contents - use validateFetchShareResponse for full validation.
 */
function isFetchShareResponseStructure(data: unknown): data is FetchShareResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'layout' in data &&
    'metadata' in data &&
    typeof (data as Record<string, unknown>).layout === 'object' &&
    typeof (data as Record<string, unknown>).metadata === 'object'
  );
}

/**
 * Validate a FetchShareResponse including Layout contents.
 * Returns validation errors if the layout structure is invalid.
 */
function validateFetchShareResponse(
  data: unknown
): { valid: true; data: FetchShareResponse } | { valid: false; errors: string[] } {
  if (!isFetchShareResponseStructure(data)) {
    return { valid: false, errors: ['Invalid response structure'] };
  }

  // Validate the Layout using the import validator
  const layoutValidation = validateImport(data.layout);
  if (!layoutValidation.valid) {
    return { valid: false, errors: layoutValidation.errors };
  }

  // Drop anything malformed rather than rejecting the whole share — a bad
  // design entry should cost that one design, not the layout. The structure
  // guard doesn't validate this field, so re-check it as untrusted input.
  const raw: unknown = data.linkedDesigns;
  const linkedDesigns = Array.isArray(raw)
    ? raw.filter((entry): entry is SharedLinkedDesign => {
        if (typeof entry !== 'object' || entry === null) return false;
        const e = entry as Record<string, unknown>;
        if (typeof e.id !== 'string' || typeof e.name !== 'string') return false;
        if (
          e.kind === 'assembly' &&
          typeof e.envelope === 'object' &&
          e.envelope !== null &&
          typeof e.structure === 'object' &&
          e.structure !== null
        ) {
          return true;
        }
        return typeof e.params === 'object' && e.params !== null && !Array.isArray(e.params);
      })
    : undefined;

  return {
    valid: true,
    data: { ...data, linkedDesigns, meshFiles: sharedMeshFiles(data.meshFiles) },
  };
}

const MESH_HASH = /^[0-9a-f]{64}$/;

/** The share's mesh file URLs, keeping only an https URL named by a file hash. */
function sharedMeshFiles(raw: unknown): Record<string, string> | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const files = Object.entries(raw).filter(
    (entry): entry is [string, string] =>
      MESH_HASH.test(entry[0]) && typeof entry[1] === 'string' && entry[1].startsWith('https://')
  );
  return files.length > 0 ? Object.fromEntries(files) : undefined;
}

function isSuccessMessage(data: unknown): data is { success: true; message: string } {
  return typeof data === 'object' && data !== null && 'success' in data && 'message' in data;
}

function jsonInit(
  method: string,
  body: unknown,
  headers: Record<string, string> = {}
): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  };
}

async function withNetworkErrors<T, E>(
  run: () => Promise<Result<T, E>>
): Promise<Result<T, E | ApiError>> {
  try {
    return await run();
  } catch (error) {
    return err(apiNetworkError(error));
  }
}

async function readJson(response: Response): Promise<Result<unknown, ApiError>> {
  const data: unknown = await response.json();
  if (!response.ok) {
    return err(isApiErrorResponse(data) ? mapApiErrorResponse(data) : apiServerError());
  }
  return ok(data);
}

async function requestJson(input: string, init?: RequestInit): Promise<Result<unknown, ApiError>> {
  return readJson(await fetch(input, init));
}

async function readShare<T>(
  response: Response,
  isValid: (data: unknown) => data is T
): Promise<Result<T, ApiError>> {
  const result = await readJson(response);
  if (isErr(result)) return result;
  return isValid(result.value) ? ok(result.value) : err(apiServerError());
}

async function requestShare<T>(
  input: string,
  init: RequestInit | undefined,
  isValid: (data: unknown) => data is T
): Promise<Result<T, ApiError>> {
  return readShare(await fetch(input, init), isValid);
}

/**
 * Create a new cloud share.
 *
 * @param layoutId - The layout's unique ID, used as the share ID unless a share already holds it
 * @param layout - The layout data to share
 * @param permission - 'view' or 'edit'
 * @param authorName - Optional author name to display
 *
 * @example
 * ```ts
 * const result = await createShare(layoutId, layout, 'view');
 * if (isOk(result)) {
 *   console.log('Share URL:', result.value.url);
 * } else {
 *   console.error(getUserMessage(result.error));
 * }
 * ```
 */
export async function createShare(
  layoutId: string,
  layout: Layout,
  permission: SharePermission = 'view',
  authorName?: string
): Promise<Result<ShareResponse, ApiError | StorageMeshMissingError>> {
  return withNetworkErrors<ShareResponse, ApiError | StorageMeshMissingError>(async () => {
    const post = async (linkedDesigns: SharedLinkedDesign[]): Promise<Response> => {
      const init = (shareId: string): RequestInit =>
        jsonInit(
          'POST',
          { layoutId: shareId, layout, permission, authorName, linkedDesigns },
          SHARE_HEADERS
        );
      const response = await fetch('/api/share', init(layoutId));
      // Only a layout with no local share record POSTs. A 409 therefore means
      // the layout's id is already taken by a share whose delete token this
      // device does not have, so that share can never be updated from here.
      // Retrying under a fresh id gives the layout a share it can manage.
      return response.status === 409 ? fetch('/api/share', init(generateLayoutId())) : response;
    };
    const sent = await sendLinkedDesigns(layout, post);
    return isErr(sent) ? sent : readShare(sent.value, isShareResponse);
  });
}

/**
 * Update an existing cloud share with new layout data.
 */
export async function updateShare(
  id: string,
  deleteToken: string,
  layout: Layout,
  permission?: SharePermission
): Promise<Result<UpdateShareResponse, ApiError | StorageMeshMissingError>> {
  return withNetworkErrors<UpdateShareResponse, ApiError | StorageMeshMissingError>(async () => {
    const sent = await sendLinkedDesigns(layout, (linkedDesigns) =>
      fetch(
        `/api/share/${id}`,
        jsonInit('PUT', { layout, permission, deleteToken, linkedDesigns }, SHARE_HEADERS)
      )
    );
    return isErr(sent) ? sent : readShare(sent.value, isUpdateShareResponse);
  });
}

/**
 * Update only the permission of an existing cloud share.
 */
export async function updatePermission(
  id: string,
  deleteToken: string,
  permission: SharePermission
): Promise<Result<UpdateShareResponse, ApiError>> {
  return withNetworkErrors(() =>
    requestShare(
      `/api/share/${id}`,
      jsonInit('PUT', { permission, deleteToken }),
      isUpdateShareResponse
    )
  );
}

/**
 * Fetch a shared layout by ID.
 * Validates the layout structure after deserialization to ensure data integrity.
 */
export async function fetchShare(
  id: string
): Promise<Result<FetchShareResponse, ApiError | ValidationError>> {
  return withNetworkErrors<FetchShareResponse, ApiError | ValidationError>(async () => {
    const result = await requestJson(`/api/share/${id}`);
    if (isErr(result)) return result;
    const validation = validateFetchShareResponse(result.value);
    return validation.valid ? ok(validation.data) : err(validationImportFailed(validation.errors));
  });
}

/**
 * Delete a cloud share.
 */
export async function deleteShare(
  id: string,
  deleteToken: string
): Promise<Result<{ success: true; message: string }, ApiError>> {
  return withNetworkErrors(() =>
    requestShare(
      `/api/share/${id}`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'X-Delete-Token': deleteToken },
      },
      isSuccessMessage
    )
  );
}

/**
 * Report a share for inappropriate content.
 */
export async function reportShare(
  id: string,
  reason?: string
): Promise<Result<{ success: true; message: string }, ApiError>> {
  return withNetworkErrors(() =>
    requestShare(`/api/report/${id}`, jsonInit('POST', { reason }), isSuccessMessage)
  );
}
