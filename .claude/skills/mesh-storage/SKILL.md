---
name: mesh-storage
description: 'Imported STL meshes stored once as content-addressed files (src/shared/generation/meshStore.ts, meshRefs.ts, meshFile.ts): MeshAssetRef vs inline MeshAsset, the gridfinity-mesh-files IndexedDB database, missing-file (STORAGE_MESH_MISSING) and pending-pocket behaviour, the idle conversion pass and sweep with its grace and keep-alive rules, and PUT_MESH/DROP_MESH worker delivery. Load when touching meshAssets or an importedMesh structure.asset, when a mesh pocket renders uncut or a cutout reads as pending, when a share, export or sync drops or refuses a mesh, or when the worker misses a mesh file.'
---

# Mesh storage

## When to use

- Reading or writing `BinParams.meshAssets` or an imported-mesh `structure.asset`.
- A mesh pocket renders uncut, a mesh cutout draws as a faded box, or a whole-bin STL design shows nothing.
- A sync push, share, publish or export skips or refuses a design with a mesh.
- Changing the generation bridge's request path, or a worker cache keyed on a mesh.

## Mental model

1. **One file per mesh, named by its bytes.** `meshFile.ts` defines the file: a header, the asset's deflated GMA1 geometry copied verbatim, and its outline rings as f64. The name is the lowercase hex SHA-256 of the file (`sha256Hex`, with a pure-JS digest where `crypto.subtle` is missing). Encoding is deterministic, so the same mesh always gets the same name, and copies, variants, branches and versions share one file.
2. **Two shapes, one union.** `MeshAsset` is inline (base64 `data` plus `outlines`). `MeshAssetRef` is `name`, `hash`, `triangleCount`, `sizeMm` and the file's `bytes`. `MeshAssetEntry` is either; tell them apart with `isMeshAssetRef`, never by reading `data` or `outlines` off an entry. Stored designs and versions hold refs. An entry stays inline only when its file could not be written (no IndexedDB, or an asset the format cannot hold, such as one with no outline ring).
3. **Refs on the way in.** `saveDesign`, `createDesignVersion` and the version adapter's pull convert inline assets with `storeHolderMeshes`, so everything that arrives inline (sync pulls, share opens, file imports, community saves) is stored as refs. Placing an STL cutout stores its mesh first.
4. **Inline on the way out.** The server and other devices take inline meshes only. `inlineHolderMeshes` and `inlineParamsMeshes` rebuild the exact inline asset, key order included. They run in sync `get()` (never `list()`, which runs every poll, keeps refs and must read no file), the store port's `loadDesign` (layout JSON, cloud share, archive), designer shares, publish (bin path only) and design JSON downloads.
5. **A missing file is a typed failure.** `STORAGE_MESH_MISSING` (`storageMeshMissing`) comes back as a `Result`, never a throw. Outbound work stops: sync skips the push, so the server keeps its copy, and queues it again when the file arrives; a layout share, layout JSON or archive fails as a whole with the `toast.meshFileMissing` toast rather than ship a bin naming a design it does not carry. On screen the cutout survives (`paramMigration` and the imported-mesh schema count a ref as present), the 2D footprint draws as a faded box, and the 3D preview leaves the pocket uncut.

## The database

- `gridfinity-mesh-files`, version 1, with a `files` store (hash to bytes) and a `meta` store (size and `touchedAt`, so a sweep reads no mesh). It is its own database because upgrading `gridfinity-designer-v1` would wait on every other open tab, and open tabs never close on a version change.
- `getMeshFile` keeps a 16 MB memory cache of the files read this page. `subscribeMeshFileArrivals` announces each newly stored file, from any tab (a `BroadcastChannel`); pending previews, held outlines and skipped sync pushes retry on it.

## Cleanup

- `useMeshFileMaintenance` (mounted in App) runs once per page at idle: `moveInlineMeshesToFiles`, then `sweepMeshFiles(referencedMeshHashes())`. The pass rewrites only the mesh-carrying fields of a record it re-reads inside the write, and only while they still hold what it converted, so a rename, pin or save that lands meanwhile is kept. It never touches `updatedAt` or announces a change.
- A file is swept only when no design or version names it and its last use is older than `MESH_SWEEP_GRACE_MS` (7 days). The grace is what makes a sweep safe beside an import still being saved, or another tab's undo history.
- Keep-alive: a page writes each file it has used as used again once that is `MESH_USE_REFRESH_MS` (1 day) old, on reads and hourly through `refreshMeshFileUse`. If another tab swept a file this page still has in memory, the refresh stores it again.

## Outlines

- Silhouettes come from a per-thread registry, `meshOutlines.ts`, read with `meshAssetOutlines`. The main thread fills it from the store, the worker from `PUT_MESH`.
- Editor views use `useMeshAssetOutlines` and `useLoadedMeshAssets`, which load what is missing, re-render on arrival and hold the outlines they show. Unheld outlines are capped at `MAX_UNHELD_OUTLINES`.

## Worker delivery

- Requests carry refs only. The bridge's `prepareMeshes` (`meshDelivery.ts`) swaps inline assets for refs and gathers each file's bytes. `MeshDelivery` sends each file once per worker as `PUT_MESH` (a transferred copy) and releases the least recently needed with `DROP_MESH` past 32 MB, never one the request needs. A replaced worker is sent everything again.
- The worker's `meshFiles.ts` keeps geometry and outlines by hash and holds a drop until no request is in progress. `preparedTools` and the imported-mesh decode cache key on `meshEntryKey`.
- A ref whose file is missing: a preview leaves that mesh's cutouts out and is flagged `meshesPending`, which keeps it out of the bridge result cache and out of persisted meshes. Exports, split previews and imported-mesh items reject with `MeshUnavailableError`.
- Exports claim their slot at call time (`claimExportSlot`), because gathering files takes a variable time: an older call that finishes late rejects as superseded instead of cancelling the newer one.

## Cache keys

- `binMeshCacheKey` and `paramsFingerprint` hash the ref, so there is one key per mesh file. A key built from refs never names geometry a key built from the inline asset did not, so refs alone need no `MESH_CACHE_VERSION` bump; a geometry change still does.

## Gotchas

- A test that mocks `@/shared/generation/meshAsset` wholesale breaks `meshRefs.ts`; spread `importOriginal` into the mock.
- Fixtures with fake base64 and `outlines: []` stay inline after a save, which exercises the fallback rather than the ref path.
