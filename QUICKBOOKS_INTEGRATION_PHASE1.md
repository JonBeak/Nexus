# QuickBooks Integration - Phase 1 Complete ✅

**Date:** 2025-10-27
**Status:** OAuth Authentication Setup Complete

## What Was Implemented

### 1. Database Schema ✅
Created 5 new tables for QuickBooks integration:

- **`qb_oauth_tokens`** - Stores OAuth2 access/refresh tokens
- **`qb_customer_id_mappings`** - Maps Nexus customers → QB customer IDs
- **`qb_tax_code_mappings`** - Maps tax codes → QB tax code IDs
- **`qb_item_mappings`** - Maps product names → QB item/service IDs
- **`qb_settings`** - Configuration settings for QB integration

**Migration File:** `/home/jon/Nexus/database/migrations/2025-10-27-quickbooks-integration.sql`

### 2. Backend Modules ✅

**Created 3 core QuickBooks utility modules:**

#### `src/utils/quickbooks/dbManager.ts`
- Token storage and retrieval
- Entity ID mapping (customers, tax codes, items)
- Settings management
- Automatic token expiration handling

#### `src/utils/quickbooks/oauthClient.ts`
- OAuth2 authorization URL generation
- Authorization code → token exchange
- Automatic token refresh
- Token revocation (disconnect)

#### `src/utils/quickbooks/apiClient.ts`
- Authenticated QB API calls with auto-refresh
- Entity lookup functions (customers, tax codes, items)
- Estimate creation
- Error handling with retry logic

### 3. API Routes ✅

**Created `/api/quickbooks` routes:**

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/config-status` | GET | ✅ | Check if QB credentials configured |
| `/start-auth` | GET | ✅ | Initiate OAuth flow (redirects to QB) |
| `/callback` | GET | ❌ | OAuth callback (QB redirects here) |
| `/status` | GET | ✅ | Check connection status |
| `/disconnect` | POST | ✅ | Disconnect from QuickBooks |
| `/test-query` | GET | ✅ | Test QB API (development only) |

### 4. Configuration ✅

**Added to `/home/jon/Nexus/backend/web/.env`:**

```env
# QuickBooks Integration
QB_CLIENT_ID=your_quickbooks_client_id_here
QB_CLIENT_SECRET=your_quickbooks_client_secret_here
QB_REDIRECT_URI=https://nexuswebapp.duckdns.org/api/quickbooks/callback
QB_ENVIRONMENT=sandbox
```

**Fixed CORS** to allow both production and development access:
- `https://nexuswebapp.duckdns.org` (Production)
- `http://192.168.2.14:5173` (LAN Development)
- `http://localhost:5173` (Local Development)

## How It Works

### OAuth Flow (NexusLite Pattern)

```
1. User clicks "Connect to QuickBooks" in Nexus
   ↓
2. Redirects to QuickBooks authorization page
   ↓
3. User authorizes Nexus app
   ↓
4. QB redirects to: /api/quickbooks/callback?code=XXX&realmId=YYY
   ↓
5. Backend exchanges code for access_token + refresh_token
   ↓
6. Tokens stored in qb_oauth_tokens table
   ↓
7. User sees "Connected!" message
```

### ID Mapping with Cache (NexusLite Pattern)

When creating an estimate in QuickBooks:

```typescript
// Example: Get customer QB ID
1. Check cache: qb_customer_id_mappings table
   ├─ Found? → Use cached QB ID
   └─ Not found? → Query QuickBooks API
                   └─ Store in cache for next time

// Same pattern for:
- Tax codes (qb_tax_code_mappings)
- Items/products (qb_item_mappings)
```

This **drastically reduces API calls** and improves performance.

## Next Steps

### **You Need To Do:**

1. **Get QuickBooks Developer Credentials**
   - Go to: https://developer.intuit.com/app/developer/myapps
   - Create a new app (or use existing)
   - Copy `Client ID` and `Client Secret`
   - Update `.env` file with real credentials:
     ```env
     QB_CLIENT_ID=<your_actual_client_id>
     QB_CLIENT_SECRET=<your_actual_client_secret>
     ```

2. **Configure Redirect URI in QuickBooks Developer Portal**
   - Add redirect URI: `https://nexuswebapp.duckdns.org/api/quickbooks/callback`
   - For testing: Also add `http://192.168.2.14:3001/api/quickbooks/callback`

3. **Test OAuth Connection**
   - Navigate to Job Estimation dashboard
   - Click "Connect to QuickBooks" button (will add in Phase 2)
   - Authorize the app
   - Verify connection in backend logs

### **Phase 2: Frontend UI (Next Session)**

Will implement:
- "Connect to QuickBooks" button in Job Estimation dashboard
- Connection status indicator
- "Create QB Estimate" button (appears after estimate finalized)
- Estimate creation from `EstimatePreviewData`
- Open estimate in QB after creation

### **Phase 3: Estimate Creation (Next Session)**

Will implement:
- Map `EstimatePreviewData` → QuickBooks estimate payload
- Lookup/cache customer, tax code, and item IDs
- Create estimate via QB API
- Handle errors gracefully
- Open created estimate in new tab

## Files Created

```
/home/jon/Nexus/
├── database/migrations/
│   └── 2025-10-27-quickbooks-integration.sql
├── backend/web/src/
│   ├── utils/quickbooks/
│   │   ├── dbManager.ts          (Token & mapping storage)
│   │   ├── oauthClient.ts        (OAuth2 flow)
│   │   └── apiClient.ts          (QB API calls)
│   └── routes/
│       └── quickbooks.ts          (API endpoints)
└── QUICKBOOKS_INTEGRATION_PHASE1.md (this file)
```

## Testing Checklist

- [x] Database tables created
- [x] Backend routes registered
- [x] Server restarts without errors
- [x] Health check endpoint responds
- [x] CORS allows LAN access
- [ ] QB credentials configured (waiting for your credentials)
- [ ] OAuth flow tested end-to-end
- [ ] Test QB API call successful

## Architecture Alignment

This implementation follows **NexusLite's proven architecture**:

✅ PostgreSQL → MySQL migration (table structures adapted)
✅ Token storage with expiration tracking
✅ ID mapping with database cache
✅ Automatic token refresh on 401/400 errors
✅ Entity lookup with fallback to QB API
✅ Error handling and retry logic

## Support

If you encounter issues:

1. **Check backend logs:** `pm2 logs signhouse-backend`
2. **Verify database:** `mysql -u webuser -pwebpass123 sign_manufacturing -e "SELECT * FROM qb_oauth_tokens;"`
3. **Test connection status:** `curl http://192.168.2.14:3001/api/quickbooks/status`
4. **Check QB credentials:** Ensure `.env` has real values (not placeholder)

---

**Ready for Phase 2:** Frontend integration + Estimate creation! 🚀
