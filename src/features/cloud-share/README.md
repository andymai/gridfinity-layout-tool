# Cloud Share

Persistent cloud sharing via Vercel Blob with permission control.

```mermaid
graph TB
    subgraph Components
        SM[ShareModal] --> CST[CloudShareTab]
        SLI[SharedLayoutImporter]
        SLB[SharedLayoutBanner]
    end
    subgraph API
        POST[POST /api/share] --> Blob[(Vercel Blob)]
        GET[GET /api/share/id]
        PUT[PUT /api/share/id]
    end
    subgraph AutoSync
        UOSS[useOwnedShareSync] -->|5s debounce| PUT
        UCAS[useCloudShareAutoSync] -->|1s debounce| PUT
    end
    CST --> POST & PUT
    SLI -->|/l/shareId| GET
```

## Permission Model

| Permission | Access                                    |
| ---------- | ----------------------------------------- |
| `view`     | Read-only, anyone with link               |
| `edit`     | Collaborative editing (requires Labs flag)|

Delete token: random secret, hashed server-side, required for mutations.

## Gotchas

1. **Share ID = Layout UUID** - URL uses layout's own ID
2. **Shares are permanent** - no expiration, only explicit delete
3. **Staging bins never sync** - filtered from fingerprint
4. **Owner can't see own share in "Shared with me"**

## Limits

- Size: 500KB max
- Bins: 2500 max
- Rate: 10 shares/hr, 100 reads/hr
