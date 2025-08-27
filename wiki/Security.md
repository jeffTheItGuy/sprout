# Sprout Security Guide

## API Key Authentication
- All API requests require `X-API-Key` header
- Used for backend service authentication

## CAPTCHA Protection
- Interactive slider-based CAPTCHA for human verification
- Token-based system with 5-minute expiry

## Rate Limiting

### Client Rate Limits
- **100 requests per 15 minutes** per client IP
- Applied to all `/api/*` endpoints except `/health`
- Uses Redis for distributed rate limiting
- Returns `429` status when exceeded

### Container Limits
- **Maximum 3 containers** per deployment
- Prevents resource exhaustion
- Enforced at API level before Kubernetes deployment

## Network Security

### CORS Configuration
```javascript
allowed_origins: [
  "https://your-domain.com"
]
```

### SSL/TLS
- Let's Encrypt certificates via cert-manager
- Automatic HTTPS redirects via Traefik middleware
- Modern TLS configuration

## Data Security

### Redis Security
- Password authentication enabled
- Connection timeouts and retry logic
- Stream-based event processing with consumer groups

### Container Isolation
- Kubernetes namespace isolation (`sprout`)
- Resource limits: 128Mi memory, 200m CPU
- Network policies via service mesh



## Monitoring & Auditing

### Request Logging
- All API requests logged with timestamps
- Failed authentication attempts tracked
- Rate limit violations recorded

### Container Events
- Create/delete operations logged to Redis streams
- Kubernetes pod lifecycle events tracked
- Failed deployments logged with error details

