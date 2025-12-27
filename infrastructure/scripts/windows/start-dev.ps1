# Start Sign House System - Development Mode (Windows)
# Starts backend via PM2 + frontend Vite dev server

$ErrorActionPreference = "Stop"

# Get Nexus root directory
$NEXUS_ROOT = if ($env:NEXUS_ROOT) { $env:NEXUS_ROOT } else { "C:\Users\13433\Nexus" }
$BACKEND_DIR = Join-Path $NEXUS_ROOT "backend\web"
$FRONTEND_DIR = Join-Path $NEXUS_ROOT "frontend\web"

Write-Host "`n=== Starting Sign House (DEV MODE - Windows) ===" -ForegroundColor Cyan

# Start backend with PM2
Write-Host "`nStarting backend with PM2..." -ForegroundColor Yellow
Set-Location $BACKEND_DIR

# Check if PM2 processes exist and restart/start accordingly
$pm2List = npx pm2 jlist 2>$null | ConvertFrom-Json -ErrorAction SilentlyContinue
if ($pm2List -and $pm2List.Count -gt 0) {
    Write-Host "  Restarting existing PM2 instances..." -ForegroundColor Gray
    npx pm2 restart ecosystem.config.js
} else {
    Write-Host "  Starting PM2 instances from ecosystem config..." -ForegroundColor Gray
    npx pm2 start ecosystem.config.js
}
npx pm2 save

Write-Host "  Backend instances configured:" -ForegroundColor Green
Write-Host "    - signhouse-backend (production) on port 3001" -ForegroundColor White
Write-Host "    - signhouse-backend-dev (dev) on port 3002" -ForegroundColor White

# Start frontend dev server
Write-Host "`nStarting frontend dev server..." -ForegroundColor Yellow
Set-Location $FRONTEND_DIR

# Kill any existing Vite processes on port 5173
$existingProcess = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($existingProcess) {
    Write-Host "  Stopping existing process on port 5173..." -ForegroundColor Gray
    Stop-Process -Id $existingProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

# Start Vite in a new window
Start-Process -FilePath "npm" -ArgumentList "run", "dev", "--", "--host" -WindowStyle Normal
Write-Host "  Frontend dev server starting on port 5173" -ForegroundColor Green

Write-Host "`n=== Sign House Started (DEV MODE) ===" -ForegroundColor Cyan
Write-Host "`nAccess URLs:" -ForegroundColor White
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "  Backend Dev: http://localhost:3002" -ForegroundColor Cyan
Write-Host "  Backend Prod: http://localhost:3001" -ForegroundColor Cyan
Write-Host "`nLogs:" -ForegroundColor White
Write-Host "  Backend: npx pm2 logs" -ForegroundColor Gray
Write-Host "`nTo stop: .\stop-servers.ps1" -ForegroundColor Yellow
