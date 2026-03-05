# API Review Guidelines

## Endpoint Structure

All API endpoints follow a consistent security pipeline. Deviations from this pattern are high-severity findings.

```
1. Method validation + OPTIONS/CORS support
2. Rate limiting (checkRateLimit with correct action tier)
3. Input/ID validation (isValidShareId, size checks)
4. Structure validation (validateShareLayout / validateDesignerData)
5. Content filtering (filterLayoutContent)
6. Auth verification (token comparison for mutations)
7. Storage operation (Vercel Blob / Redis)
8. Error handling (try-catch with standardized error codes)
```

## Security Checklist

- Rate limit action tiers match endpoint sensitivity
- IP extraction uses hashed SHA-256 for privacy
- Token comparison is constant-time (timingSafeEqual)
- Delete tokens stored as hashes in Redis, never in blob
- Origin validation on LLM endpoints (whitelist: gridfinity.xyz, preview deploys, localhost)
- No user data in error logs or 500 responses
- Null bytes stripped from all string inputs
- Content-Type validated on POST/PUT

## Redis Patterns

- Key naming: `ratelimit:{action}:{hash}`, `share:hash:{id}`, `share:reports:{id}`
- Pipelines for multi-step atomic writes
- Fire-and-forget for non-critical updates (`.catch()` pattern)
- TTL on all keys to prevent unbounded growth
