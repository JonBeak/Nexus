# Status Check for Sign House System (Windows)
# Shows PM2 process status and port availability

$ErrorActionPreference = "Continue"

Write-Host "`n=== Sign House Status (Windows) ===" -ForegroundColor Cyan

# PM2 Status
Write-Host "`n--- PM2 Processes ---" -ForegroundColor Yellow
npx pm2 list

# Port Status
Write-Host "`n--- Port Status ---" -ForegroundColor Yellow

# Check port 3001 (Production Backend)
$port3001 = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
if ($port3001) {
    $pid3001 = $port3001 | Select-Object -ExpandProperty OwningProcess -First 1
    Write-Host "  Port 3001 (Prod Backend): " -NoNewline
    Write-Host "LISTENING (PID: $pid3001)" -ForegroundColor Green
} else {
    Write-Host "  Port 3001 (Prod Backend): " -NoNewline
    Write-Host "NOT LISTENING" -ForegroundColor Red
}

# Check port 3002 (Dev Backend)
$port3002 = Get-NetTCPConnection -LocalPort 3002 -ErrorAction SilentlyContinue
if ($port3002) {
    $pid3002 = $port3002 | Select-Object -ExpandProperty OwningProcess -First 1
    Write-Host "  Port 3002 (Dev Backend):  " -NoNewline
    Write-Host "LISTENING (PID: $pid3002)" -ForegroundColor Green
} else {
    Write-Host "  Port 3002 (Dev Backend):  " -NoNewline
    Write-Host "NOT LISTENING" -ForegroundColor Red
}

# Check port 5173 (Frontend)
$port5173 = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
if ($port5173) {
    $pid5173 = $port5173 | Select-Object -ExpandProperty OwningProcess -First 1
    Write-Host "  Port 5173 (Frontend):     " -NoNewline
    Write-Host "LISTENING (PID: $pid5173)" -ForegroundColor Green
} else {
    Write-Host "  Port 5173 (Frontend):     " -NoNewline
    Write-Host "NOT LISTENING" -ForegroundColor Red
}

# Health Checks
Write-Host "`n--- Health Checks ---" -ForegroundColor Yellow

try {
    $healthProd = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -TimeoutSec 3 -ErrorAction SilentlyContinue
    Write-Host "  Backend Prod (3001): " -NoNewline
    Write-Host "HEALTHY" -ForegroundColor Green
} catch {
    Write-Host "  Backend Prod (3001): " -NoNewline
    Write-Host "UNREACHABLE" -ForegroundColor Red
}

try {
    $healthDev = Invoke-WebRequest -Uri "http://localhost:3002/api/health" -TimeoutSec 3 -ErrorAction SilentlyContinue
    Write-Host "  Backend Dev (3002):  " -NoNewline
    Write-Host "HEALTHY" -ForegroundColor Green
} catch {
    Write-Host "  Backend Dev (3002):  " -NoNewline
    Write-Host "UNREACHABLE" -ForegroundColor Red
}

try {
    $healthFrontend = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 3 -ErrorAction SilentlyContinue
    Write-Host "  Frontend (5173):     " -NoNewline
    Write-Host "HEALTHY" -ForegroundColor Green
} catch {
    Write-Host "  Frontend (5173):     " -NoNewline
    Write-Host "UNREACHABLE" -ForegroundColor Red
}

Write-Host "`n--- Quick Commands ---" -ForegroundColor Yellow
Write-Host "  View logs:    npx pm2 logs" -ForegroundColor Gray
Write-Host "  Restart all:  npx pm2 restart all" -ForegroundColor Gray
Write-Host "  Stop all:     .\stop-servers.ps1" -ForegroundColor Gray
Write-Host ""
