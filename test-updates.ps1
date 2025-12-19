# Test Script for Keep-Alive and Auto-Reply Features
# Run this after deployment to verify everything works

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Testing Keep-Alive & Auto-Reply Features" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$apiUrl = Read-Host "Enter API URL (e.g., http://localhost:3000/api/v1)"
$token = Read-Host "Enter your auth token" -MaskInput

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# Test 1: Get Sessions
Write-Host "[Test 1] Fetching sessions..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$apiUrl/sessions" -Method Get -Headers $headers
    $sessions = $response.data.sessions
    
    if ($sessions.Count -eq 0) {
        Write-Host "✗ No sessions found. Please create a session first." -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✓ Found $($sessions.Count) session(s)" -ForegroundColor Green
    
    foreach ($session in $sessions) {
        Write-Host "  - $($session.name) [$($session.status)]" -ForegroundColor Gray
        Write-Host "    Session ID: $($session.sessionId)" -ForegroundColor Gray
        Write-Host "    Auto-Reply: $($session.autoReplyEnabled)" -ForegroundColor Gray
    }
    
    Write-Host ""
} catch {
    Write-Host "✗ Failed to fetch sessions: $_" -ForegroundColor Red
    exit 1
}

# Test 2: Check for connected session
$connectedSession = $sessions | Where-Object { $_.status -eq 'connected' } | Select-Object -First 1

if (-not $connectedSession) {
    Write-Host "⚠ No connected sessions found. Please connect a session to test auto-reply." -ForegroundColor Yellow
    exit 0
}

Write-Host "[Test 2] Testing auto-reply configuration..." -ForegroundColor Yellow
Write-Host "Using session: $($connectedSession.name)" -ForegroundColor Gray

$testMessage = "This is an automated test message - Thank you for contacting us!"

try {
    $autoReplyBody = @{
        enabled = $true
        message = $testMessage
    } | ConvertTo-Json

    $response = Invoke-RestMethod `
        -Uri "$apiUrl/sessions/$($connectedSession.sessionId)/auto-reply" `
        -Method Put `
        -Headers $headers `
        -Body $autoReplyBody
    
    Write-Host "✓ Auto-reply enabled successfully" -ForegroundColor Green
    Write-Host "  Message: $testMessage" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "✗ Failed to configure auto-reply: $_" -ForegroundColor Red
    Write-Host ""
}

# Test 3: Verify auto-reply was saved
Write-Host "[Test 3] Verifying auto-reply settings..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$apiUrl/sessions" -Method Get -Headers $headers
    $updatedSession = $response.data.sessions | Where-Object { $_.sessionId -eq $connectedSession.sessionId }
    
    if ($updatedSession.autoReplyEnabled -eq $true) {
        Write-Host "✓ Auto-reply is enabled" -ForegroundColor Green
        Write-Host "  Message: $($updatedSession.autoReplyMessage)" -ForegroundColor Gray
    } else {
        Write-Host "✗ Auto-reply is not enabled" -ForegroundColor Red
    }
    Write-Host ""
} catch {
    Write-Host "✗ Failed to verify settings: $_" -ForegroundColor Red
    Write-Host ""
}

# Test 4: Check service logs for keep-alive
Write-Host "[Test 4] Checking for keep-alive pings in logs..." -ForegroundColor Yellow
Write-Host "Looking for 'Keep-alive' messages in last 100 log lines..." -ForegroundColor Gray

$pm2Available = Get-Command pm2 -ErrorAction SilentlyContinue

if ($pm2Available) {
    try {
        $logs = pm2 logs --nostream --lines 100 2>&1 | Out-String
        $keepAliveMessages = $logs -split "`n" | Where-Object { $_ -match "keep.*alive|Keep.*alive" }
        
        if ($keepAliveMessages.Count -gt 0) {
            Write-Host "✓ Found $($keepAliveMessages.Count) keep-alive related message(s)" -ForegroundColor Green
            Write-Host "Recent messages:" -ForegroundColor Gray
            $keepAliveMessages | Select-Object -First 3 | ForEach-Object {
                Write-Host "  $_" -ForegroundColor DarkGray
            }
        } else {
            Write-Host "⚠ No keep-alive messages found yet (may need more time)" -ForegroundColor Yellow
            Write-Host "  Keep-alive pings occur every 30 seconds" -ForegroundColor Gray
        }
    } catch {
        Write-Host "⚠ Could not check PM2 logs: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠ PM2 not available. Check Docker logs manually:" -ForegroundColor Yellow
    Write-Host "  docker-compose logs api | grep -i 'keep-alive'" -ForegroundColor Gray
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Manual Testing Steps:" -ForegroundColor Yellow
Write-Host "  1. Send a message from another WhatsApp to: $($connectedSession.phoneNumber)" -ForegroundColor White
Write-Host "  2. You should receive the auto-reply message" -ForegroundColor White
Write-Host "  3. Check webhook logs to confirm delivery" -ForegroundColor White
Write-Host "  4. Wait 10+ minutes and send another message" -ForegroundColor White
Write-Host "  5. Message should arrive without manual reconnection" -ForegroundColor White
Write-Host ""
Write-Host "Monitor Logs:" -ForegroundColor Yellow
Write-Host "  pm2 logs" -ForegroundColor White
Write-Host "  # OR" -ForegroundColor Gray
Write-Host "  docker-compose logs -f api" -ForegroundColor White
Write-Host ""
