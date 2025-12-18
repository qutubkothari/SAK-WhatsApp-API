# SAK WhatsApp API - EC2 Deployment Script (Docker Compose)

[CmdletBinding()]
param(
    [string]$PemKey = ".\SAK-Whatsapp-API.pem",
    [string]$EC2IP = "13.201.102.10",
    [string]$User = "ubuntu",
    [string]$Domain = "",
    [string]$HealthPath = "/health",
    [switch]$Watch,
    [int]$DebounceSeconds = 2
)

function Get-ARecordIPv4 {
    param([string]$Hostname)
    try {
        $records = Resolve-DnsName -Name $Hostname -Type A -ErrorAction Stop
        $ip = ($records | Where-Object { $_.IPAddress } | Select-Object -First 1 -ExpandProperty IPAddress)
        return $ip
    } catch {
        return $null
    }
}

function Write-PreflightInfo {
    Write-Host "" 
    Write-Host "Preflight checks" -ForegroundColor Cyan

    if ($Domain) {
        $resolved = Get-ARecordIPv4 -Hostname $Domain
        if ($resolved) {
            if ($resolved -ne $EC2IP) {
                Write-Host "DNS mismatch: $Domain -> $resolved (expected $EC2IP)" -ForegroundColor Yellow
                Write-Host "Update your DNS A-record to avoid downtime." -ForegroundColor Yellow
            } else {
                Write-Host "DNS OK: $Domain -> $resolved" -ForegroundColor Green
            }
        } else {
            Write-Host "Could not resolve DNS for $Domain (skipping DNS check)" -ForegroundColor Yellow
        }
    }

    Write-Host "Remote disk usage (/)" -ForegroundColor Blue
    $diskOut = ssh -i $PemKey -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$User@$EC2IP" "df -h /; echo; lsblk" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host $diskOut
    } else {
        Write-Host "Could not fetch remote disk info (skipping)" -ForegroundColor Yellow
    }
}

function Invoke-Deploy {
    Write-Host "" 
    Write-Host "SAK WhatsApp API - EC2 Deployment" -ForegroundColor Cyan
    Write-Host "" 

    if (!(Test-Path $PemKey)) {
        Write-Host "PEM key not found: $PemKey" -ForegroundColor Red
        throw "Missing pem key"
    }

    icacls $PemKey /inheritance:r | Out-Null
    icacls $PemKey /grant:r "$($env:USERNAME):(R)" | Out-Null
    Write-Host "PEM key configured" -ForegroundColor Green

    Write-Host "Testing connection..." -ForegroundColor Blue
    $null = ssh -i $PemKey -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$User@$EC2IP" "echo OK" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Cannot connect to EC2" -ForegroundColor Red
        throw "SSH failed"
    }
    Write-Host "Connection successful" -ForegroundColor Green

    Write-PreflightInfo

    Write-Host "Creating deployment package..." -ForegroundColor Blue
    $pkg = "deploy_$(Get-Date -Format 'yyyyMMddHHmmss').zip"
    $temp = ".\temp_deploy"
    if (Test-Path $temp) { Remove-Item -Recurse -Force $temp }
    New-Item -ItemType Directory $temp | Out-Null

    $exclude = @(
        "node_modules",
        "dist",
        "logs",
        "whatsapp_sessions",
        ".git",
        "temp_deploy",
        "frontend\node_modules",
        "frontend\dist",
        "*.log",
        "*.pem",
        ".env",
        "deploy_*"
    )

    Get-ChildItem -Recurse | Where-Object {
        $skip = $false
        foreach ($ex in $exclude) {
            if ($_.FullName -like "*\$ex\*" -or $_.FullName -like "*\$ex" -or $_.Name -like $ex) {
                $skip = $true
                break
            }
        }
        !$skip
    } | ForEach-Object {
        $rel = $_.FullName.Substring($PWD.Path.Length + 1)
        $dst = Join-Path $temp $rel
        if ($_.PSIsContainer) {
            New-Item -ItemType Directory $dst -Force | Out-Null
        } else {
            $dir = Split-Path $dst
            if (!(Test-Path $dir)) { New-Item -ItemType Directory $dir -Force | Out-Null }
            Copy-Item $_.FullName $dst -Force
        }
    }

    Compress-Archive -Path "$temp\*" -DestinationPath $pkg -Force
    Remove-Item -Recurse -Force $temp
    Write-Host "Package created: $pkg" -ForegroundColor Green

    Write-Host "Uploading..." -ForegroundColor Blue
    scp -i $PemKey -o StrictHostKeyChecking=no $pkg "$User@${EC2IP}:/tmp/" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Upload failed" -ForegroundColor Red
        throw "SCP failed"
    }
    Write-Host "Upload complete" -ForegroundColor Green

    Write-Host "Deploying (Docker rebuild/restart)..." -ForegroundColor Blue
    $script = Get-Content -Path "deploy-remote.sh" -Raw
    $script = $script -replace '\$EC2IP', $EC2IP
    $script = $script -replace '\$PACKAGE', $pkg
    # Normalize line endings for bash (avoid CRLF -> $'\r' errors)
    $script = $script -replace "`r`n", "`n"
    $script | ssh -i $PemKey "$User@$EC2IP" "cat > /tmp/deploy.sh; sed -i 's/\r$//' /tmp/deploy.sh; chmod +x /tmp/deploy.sh; /tmp/deploy.sh"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Remote deploy failed" -ForegroundColor Red
        throw "Remote deploy failed"
    }

    Remove-Item $pkg -Force -ErrorAction SilentlyContinue

    Write-Host "" 
    Write-Host "Deployment Complete!" -ForegroundColor Green
    Write-Host "" 

    Write-Host "Health check:" -ForegroundColor Cyan
    $healthUrl = "http://$EC2IP$HealthPath"
    $maxAttempts = 6
    $delaySeconds = 10
    $ok = $false

    for ($i = 1; $i -le $maxAttempts; $i++) {
        try {
            $resp = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 10
            Write-Host "  $healthUrl -> $($resp.StatusCode)" -ForegroundColor Green
            $ok = $true
            break
        } catch {
            if ($i -lt $maxAttempts) {
                Write-Host "  $healthUrl -> not ready (retry $i/$maxAttempts)" -ForegroundColor DarkYellow
                Start-Sleep -Seconds $delaySeconds
            }
        }
    }

    if (-not $ok) {
        Write-Host "  Health check failed (verify nginx/backend are up)" -ForegroundColor Yellow
    } elseif ($Domain) {
        try {
            $domainHealthUrl = "http://$Domain$HealthPath"
            $resp2 = Invoke-WebRequest -Uri $domainHealthUrl -UseBasicParsing -TimeoutSec 10
            Write-Host "  $domainHealthUrl -> $($resp2.StatusCode)" -ForegroundColor Green
        } catch {
            Write-Host "  $domainHealthUrl -> failed (check DNS/nginx)" -ForegroundColor DarkYellow
        }
    }

    Write-Host "URLs:" -ForegroundColor Cyan
    Write-Host "  Frontend: http://$EC2IP" -ForegroundColor White
    Write-Host "  Backend:  http://$EC2IP/api/v1" -ForegroundColor White
    Write-Host "" 
    Write-Host "Monitor:" -ForegroundColor Cyan
    Write-Host "  ssh -i $PemKey $User@$EC2IP" -ForegroundColor White
    Write-Host "  docker compose ps" -ForegroundColor White
    Write-Host "  docker compose logs -f backend" -ForegroundColor White
    Write-Host "" 
}

function New-FileWatcher {
    param(
        [string]$Path,
        [string]$Filter,
        [bool]$Recurse
    )

    $fsw = New-Object System.IO.FileSystemWatcher
    $fsw.Path = (Resolve-Path $Path).Path
    $fsw.Filter = $Filter
    $fsw.IncludeSubdirectories = $Recurse
    $fsw.NotifyFilter = [System.IO.NotifyFilters]'FileName, LastWrite, DirectoryName'
    $fsw.EnableRaisingEvents = $true
    return $fsw
}

if (-not $Watch) {
    Invoke-Deploy
    exit 0
}

Write-Host "Auto-deploy watch enabled (debounce: $DebounceSeconds s)" -ForegroundColor Cyan
Write-Host "Watching for changes... (Ctrl+C to stop)" -ForegroundColor DarkGray

$script:PendingDeploy = $false
$script:LastChangeAt = Get-Date
$script:IsDeploying = $false

$watchSpecs = @(
    @{ Path = "src"; Filter = "*"; Recurse = $true },
    @{ Path = "frontend\src"; Filter = "*"; Recurse = $true },
    @{ Path = "."; Filter = "package.json"; Recurse = $false },
    @{ Path = "frontend"; Filter = "package.json"; Recurse = $false },
    @{ Path = "."; Filter = "Dockerfile"; Recurse = $false },
    @{ Path = "frontend"; Filter = "Dockerfile"; Recurse = $false },
    @{ Path = "."; Filter = "docker-compose.yml"; Recurse = $false },
    @{ Path = "."; Filter = "nginx.conf"; Recurse = $false },
    @{ Path = "frontend"; Filter = "vite.config.ts"; Recurse = $false }
)

$watchers = @()
foreach ($spec in $watchSpecs) {
    if (Test-Path $spec.Path) {
        $watchers += (New-FileWatcher -Path $spec.Path -Filter $spec.Filter -Recurse $spec.Recurse)
    }
}

foreach ($w in $watchers) {
    Register-ObjectEvent -InputObject $w -EventName Changed -Action {
        $script:PendingDeploy = $true
        $script:LastChangeAt = Get-Date
    } | Out-Null
    Register-ObjectEvent -InputObject $w -EventName Created -Action {
        $script:PendingDeploy = $true
        $script:LastChangeAt = Get-Date
    } | Out-Null
    Register-ObjectEvent -InputObject $w -EventName Deleted -Action {
        $script:PendingDeploy = $true
        $script:LastChangeAt = Get-Date
    } | Out-Null
    Register-ObjectEvent -InputObject $w -EventName Renamed -Action {
        $script:PendingDeploy = $true
        $script:LastChangeAt = Get-Date
    } | Out-Null
}

while ($true) {
    Start-Sleep -Milliseconds 250

    if (-not $script:PendingDeploy) {
        continue
    }
    if ($script:IsDeploying) {
        continue
    }

    $elapsed = (New-TimeSpan -Start $script:LastChangeAt -End (Get-Date)).TotalSeconds
    if ($elapsed -lt $DebounceSeconds) {
        continue
    }

    $script:PendingDeploy = $false
    $script:IsDeploying = $true
    try {
        Write-Host "" 
        Write-Host "Change detected -> deploying..." -ForegroundColor Yellow
        Invoke-Deploy
        Write-Host "Watching..." -ForegroundColor DarkGray
    } catch {
        Write-Host "Deploy failed: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Watching..." -ForegroundColor DarkGray
    } finally {
        $script:IsDeploying = $false
    }
}
