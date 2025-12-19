# Deploy Keep-Alive and Auto-Reply Updates
# Run this script from the project root directory

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Deploying Keep-Alive & Auto-Reply Features" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Backup Database
Write-Host "[1/5] Creating database backup..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "backup_$timestamp.sql"

# Prompt for database credentials
$dbUser = Read-Host "Enter PostgreSQL username (default: postgres)"
if ([string]::IsNullOrWhiteSpace($dbUser)) { $dbUser = "postgres" }

$dbName = Read-Host "Enter database name"
if ([string]::IsNullOrWhiteSpace($dbName)) {
    Write-Host "Database name is required!" -ForegroundColor Red
    exit 1
}

Write-Host "Creating backup to $backupFile..." -ForegroundColor Gray
try {
    # Note: This assumes pg_dump is in PATH
    & pg_dump -U $dbUser -d $dbName -f $backupFile
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Backup created successfully" -ForegroundColor Green
    } else {
        Write-Host "⚠ Backup failed, but continuing..." -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠ Could not create backup: $_" -ForegroundColor Yellow
    $continue = Read-Host "Continue without backup? (y/N)"
    if ($continue -ne "y") {
        exit 1
    }
}

Write-Host ""

# Step 2: Install dependencies
Write-Host "[2/5] Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to install dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Dependencies installed" -ForegroundColor Green
Write-Host ""

# Step 3: Run migrations
Write-Host "[3/5] Running database migrations..." -ForegroundColor Yellow
npm run migrate
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Migration failed" -ForegroundColor Red
    Write-Host "To rollback: npx knex migrate:rollback" -ForegroundColor Yellow
    exit 1
}
Write-Host "✓ Migrations completed" -ForegroundColor Green
Write-Host ""

# Step 4: Build project
Write-Host "[4/5] Building project..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Build failed" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Build completed" -ForegroundColor Green
Write-Host ""

# Step 5: Restart service
Write-Host "[5/5] Restarting service..." -ForegroundColor Yellow

# Check if PM2 is available
$pm2Available = Get-Command pm2 -ErrorAction SilentlyContinue

if ($pm2Available) {
    Write-Host "Restarting with PM2..." -ForegroundColor Gray
    pm2 restart ecosystem.config.js
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Service restarted with PM2" -ForegroundColor Green
    } else {
        Write-Host "⚠ PM2 restart failed" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "Viewing logs (Ctrl+C to exit)..." -ForegroundColor Gray
    Start-Sleep -Seconds 2
    pm2 logs --lines 50
} else {
    # Check if Docker Compose is available
    $dockerComposeAvailable = Get-Command docker-compose -ErrorAction SilentlyContinue
    
    if ($dockerComposeAvailable) {
        Write-Host "Restarting with Docker Compose..." -ForegroundColor Gray
        docker-compose down
        docker-compose build
        docker-compose up -d
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Service restarted with Docker Compose" -ForegroundColor Green
        } else {
            Write-Host "✗ Docker Compose restart failed" -ForegroundColor Red
            exit 1
        }
        
        Write-Host ""
        Write-Host "Viewing logs (Ctrl+C to exit)..." -ForegroundColor Gray
        Start-Sleep -Seconds 2
        docker-compose logs -f api
    } else {
        Write-Host "⚠ Neither PM2 nor Docker Compose found" -ForegroundColor Yellow
        Write-Host "Please restart your service manually" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "New Features:" -ForegroundColor Cyan
Write-Host "  • Connection Keep-Alive (pings every 30s)" -ForegroundColor White
Write-Host "  • Auto-Reply Configuration per Session" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Check that existing sessions are still connected" -ForegroundColor White
Write-Host "  2. Test auto-reply via the Sessions page" -ForegroundColor White
Write-Host "  3. Monitor logs for keep-alive pings" -ForegroundColor White
Write-Host ""
Write-Host "Documentation: DEPLOYMENT_KEEP_ALIVE_AUTOREPLY.md" -ForegroundColor Gray
