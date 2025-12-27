# Rebuild Backend Dev Build (Windows)
# Compiles TypeScript, moves to dist-dev, restarts PM2

$ErrorActionPreference = "Stop"

# Get Nexus root directory
$NEXUS_ROOT = if ($env:NEXUS_ROOT) { $env:NEXUS_ROOT } else { "C:\Users\13433\Nexus" }
$BACKEND_DIR = Join-Path $NEXUS_ROOT "backend\web"

Write-Host "`n=== Rebuilding Backend (Dev) ===" -ForegroundColor Cyan

Set-Location $BACKEND_DIR

# Step 1: Build TypeScript
Write-Host "`nStep 1: Compiling TypeScript..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  Build completed" -ForegroundColor Green

# Step 2: Backup old dist-dev if exists
$distDevPath = Join-Path $BACKEND_DIR "dist-dev"
$distPath = Join-Path $BACKEND_DIR "dist"

if (Test-Path $distDevPath) {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $backupPath = Join-Path $BACKEND_DIR "dist-dev-backup-$timestamp"
    Write-Host "`nStep 2: Backing up old dist-dev..." -ForegroundColor Yellow
    Move-Item $distDevPath $backupPath
    Write-Host "  Backed up to: $backupPath" -ForegroundColor Gray

    # Keep only last 3 backups
    $backups = Get-ChildItem $BACKEND_DIR -Directory -Filter "dist-dev-backup-*" | Sort-Object Name -Descending | Select-Object -Skip 3
    foreach ($backup in $backups) {
        Remove-Item $backup.FullName -Recurse -Force
        Write-Host "  Removed old backup: $($backup.Name)" -ForegroundColor Gray
    }
} else {
    Write-Host "`nStep 2: No existing dist-dev to backup" -ForegroundColor Gray
}

# Step 3: Move new build to dist-dev
Write-Host "`nStep 3: Moving build to dist-dev..." -ForegroundColor Yellow
Move-Item $distPath $distDevPath
Write-Host "  dist -> dist-dev" -ForegroundColor Green

# Step 4: Restart PM2 dev instance
Write-Host "`nStep 4: Restarting PM2 dev instance..." -ForegroundColor Yellow
npx pm2 restart signhouse-backend-dev
Write-Host "  signhouse-backend-dev restarted" -ForegroundColor Green

Write-Host "`n=== Backend Dev Rebuild Complete ===" -ForegroundColor Cyan
Write-Host "Dev backend running on port 3002" -ForegroundColor White
