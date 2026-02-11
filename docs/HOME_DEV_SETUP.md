# Home Development Environment Setup

This documents the setup for developing on the Nexus app from home (Windows), separate from the Linux production/work environment.

## Overview

The home environment runs independently with:
- HTTPS backend (Let's Encrypt certificate)
- QB credentials stored in `.env` (not encrypted database)
- DuckDNS domain pointing to home IP

This allows restoring database backups from work without losing QuickBooks connectivity.

---

## Architecture Differences: Work vs Home

| Component | Work (Linux) | Home (Windows) |
|-----------|--------------|----------------|
| Backend URL | `http://localhost:3001` (behind nginx) | `https://nexuswebapphome.duckdns.org:3001` |
| SSL | Handled by nginx | Node.js serves HTTPS directly |
| QB Credentials | Encrypted in database | Plain text in `.env` |
| Domain | `nexuswebapp.duckdns.org` | `nexuswebapphome.duckdns.org` |

---

## Required Configuration Files

### Backend (`backend/web/.env`)

```env
# Database (same as work, pointing to your local MySQL)
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=sign_manufacturing

# Server
PORT=3001
NODE_ENV=development

# JWT (can be different from work - only affects local sessions)
JWT_SECRET=<64-char-random-string>
JWT_REFRESH_SECRET=<64-char-random-string>
ENCRYPTION_SALT=<64-char-hex-string>

# QuickBooks - HOME ENVIRONMENT OVERRIDE
# This bypasses encrypted database credentials
USE_ENV_QB_CREDENTIALS=true
QB_CLIENT_ID=<your-qb-client-id>
QB_CLIENT_SECRET=<your-qb-client-secret>
QB_REDIRECT_URI=https://nexuswebapphome.duckdns.org:3001/api/quickbooks/callback
QB_ENVIRONMENT=production
```

### Gmail (optional — for sending PO/order emails)

Add these to `backend/web/.env` to enable email sending from home. You also need to copy `gmail-service-account.json` from the work server (`/home/jon/Nexus/backend/web/config/`) to `C:\Users\13433\Nexus\backend\web\config\`.

```env
# Gmail Configuration
GMAIL_ENABLED=true
GMAIL_SENDER_EMAIL=info@signhouse.ca
GMAIL_SENDER_NAME=Sign House
GMAIL_BCC_EMAIL=info@signhouse.ca
GMAIL_SERVICE_ACCOUNT_PATH=config/gmail-service-account.json
```

Without these, PO emails will log to console but not actually send. The frontend will show a warning that the email was not sent.

### Frontend (`frontend/web/.env.development`)

```env
VITE_API_URL=https://nexuswebapphome.duckdns.org:3001/api
```

---

## SSL Certificate Setup

Certificates are managed by **win-acme** (Let's Encrypt).

### Certificate Files Location
```
backend/web/nexuswebapphome.duckdns.org-key.pem   # Private key
backend/web/nexuswebapphome.duckdns.org-chain.pem # Certificate chain
```

### Auto-Renewal
- Handled by Windows Scheduled Task: `win-acme renew`
- Runs daily, renews ~30 days before expiry
- **Port 80 must be accessible** for HTTP validation

### Check Task Status
```powershell
Get-ScheduledTask | Where-Object {$_.TaskName -like "*acme*"}
```

### Manual Renewal (if needed)
```powershell
cd C:\win-acme
.\wacs.exe
# Select: R (Run renewals)
```

---

## Network Configuration

### Router Port Forwarding
| External Port | Internal Port | Internal IP | Protocol |
|---------------|---------------|-------------|----------|
| 3001 | 3001 | 192.168.1.55 | TCP |
| 80 | 80 | 192.168.1.55 | TCP (for cert renewal) |

### Windows Firewall Rules
```powershell
# Allow port 3001 (backend HTTPS)
netsh advfirewall firewall add rule name="Backend 3001" dir=in action=allow protocol=tcp localport=3001

# Allow port 80 (cert renewal)
netsh advfirewall firewall add rule name="HTTP 80" dir=in action=allow protocol=tcp localport=80
```

### DuckDNS
- Domain: `nexuswebapphome.duckdns.org`
- Must point to your current public IP
- Update at: https://www.duckdns.org

#### Auto-Update DuckDNS (if IP changes frequently)
Create a scheduled task that runs:
```powershell
Invoke-WebRequest "https://www.duckdns.org/update?domains=nexuswebapphome&token=YOUR_TOKEN&ip=" -UseBasicParsing
```

---

## Daily Workflow

### Starting Development
```powershell
# Terminal 1: Backend
cd C:\Users\13433\Nexus\backend\web
node dist/server.js
# Should show: "SIGNHOUSE BACKEND ... STARTED (HTTPS)"

# Terminal 2: Frontend
cd C:\Users\13433\Nexus\frontend\web
npm run dev
```

### After Restoring Database Backup from Work
No action needed for QB - credentials come from `.env`, not database.

Just restart the backend if it was running during restore.

---

## Troubleshooting

### "Connection Timed Out" to Backend
1. Check backend is running: `netstat -ano | findstr :3001`
2. Check port forwarding in router
3. Check Windows Firewall: `netsh advfirewall firewall show rule name="Backend 3001"`
4. Verify DuckDNS IP matches your current IP

### SSL Certificate Errors
1. Check cert files exist in `backend/web/*.pem`
2. Check cert expiry: `openssl x509 -in backend/web/nexuswebapphome.duckdns.org-chain.pem -noout -dates`
3. Run manual renewal if expired

### QB Authorization Fails
1. Verify `.env` has `USE_ENV_QB_CREDENTIALS=true`
2. Check QB_REDIRECT_URI matches QuickBooks Developer Portal
3. Verify backend shows "(HTTPS)" in startup message

### IP Changed
1. Find new IP: `(Invoke-WebRequest "https://api.ipify.org" -UseBasicParsing).Content`
2. Update at https://www.duckdns.org
3. Wait a few minutes for DNS propagation

---

## Files NOT to Commit (gitignored)

These are home-specific and already in `.gitignore`:
- `backend/web/*.pem` - SSL certificates
- `backend/web/.env` - Contains QB secrets
- `frontend/web/.env.development` - Points to home URL

---

## Code Changes for Home Support

The following files have conditional logic for home environment:

### `backend/web/src/server.ts`
- Auto-detects SSL cert files and serves HTTPS if found
- Falls back to HTTP if no certs (work environment)

### `backend/web/src/services/credentialService.ts`
- Checks `USE_ENV_QB_CREDENTIALS` flag
- Uses `.env` QB credentials if true, database if false

### `frontend/web/vite.config.ts`
- Disables proxy when `VITE_API_URL` is set
- Allows direct HTTPS connections to home backend

### `backend/web/src/services/gmailAuthService.ts` & `driveService.ts`
- Check `GMAIL_SERVICE_ACCOUNT_PATH` env var before DB lookup
- Uses `.env` path if set, encrypted database path otherwise
