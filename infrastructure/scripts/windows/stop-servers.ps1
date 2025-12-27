# Stop Sign House System (Windows)
# Stops PM2 backend processes and Vite frontend

$ErrorActionPreference = "Continue"

Write-Host "`n=== Stopping Sign House ===" -ForegroundColor Cyan

# Stop frontend (Vite on port 5173)
Write-Host "`nStopping frontend..." -ForegroundColor Yellow
$frontendProcess = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($frontendProcess) {
    Stop-Process -Id $frontendProcess -Force -ErrorAction SilentlyContinue
    Write-Host "  Frontend stopped (PID: $frontendProcess)" -ForegroundColor Green
} else {
    Write-Host "  Frontend not running" -ForegroundColor Gray
}

# Stop PM2 processes
Write-Host "`nStopping PM2 processes..." -ForegroundColor Yellow
npx pm2 stop all 2>$null
Write-Host "  PM2 processes stopped" -ForegroundColor Green

Write-Host "`n=== Sign House Stopped ===" -ForegroundColor Cyan
Write-Host "`nTo start again: .\start-dev.ps1" -ForegroundColor Yellow
