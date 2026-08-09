# macOS-only launcher (PowerShell Core / pwsh): checks/installs prerequisites,
# starts the MyCars website dev server (if not already running), and opens it
# in Chrome. Mirrors MyWork's launch-mac.ps1 pattern.
# For a plain shell equivalent, use launch-mac.sh instead.

$Port = 3100
$Url = "http://localhost:$Port"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Set-Location $ScriptDir

if (-not $IsMacOS) {
    Write-Error "launch-mac.ps1 is macOS-only (run it with pwsh on a Mac)."
    exit 1
}

# --- Stop any existing dev server on this port -----------------------------
# Matched by port via lsof, not by process name/args, so this can't
# accidentally kill MyWork's dev server (or any other node process) if both
# are running on this machine at once.

$existingPid = (lsof -ti "tcp:$Port" 2>$null)
if ($existingPid) {
    Write-Host "Stopping existing server on port $Port..."
    $existingPid | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 1
}

# --- Dependencies ---------------------------------------------------------

if (-not (Get-Command brew -ErrorAction SilentlyContinue)) {
    Write-Error "Homebrew isn't installed. Install it from https://brew.sh, then run: brew install node"
    exit 1
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js is not installed. Installing via Homebrew..."
    brew install node
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "npm isn't available even though Node.js is installed - your Node install looks broken. Try: brew reinstall node"
    exit 1
}

$needsInstall = -not (Test-Path node_modules)
if (-not $needsInstall) {
    $nodeModulesTime = (Get-Item node_modules).LastWriteTime
    if ((Get-Item package.json).LastWriteTime -gt $nodeModulesTime) { $needsInstall = $true }
    if ((Test-Path package-lock.json) -and (Get-Item package-lock.json).LastWriteTime -gt $nodeModulesTime) { $needsInstall = $true }
}
if ($needsInstall) {
    Write-Host "Installing npm dependencies..."
    npm install
}

# --- Start the server -------------------------------------------------------

function Test-ServerUp {
    try {
        $response = Invoke-WebRequest -Uri "$Url/health" -UseBasicParsing -TimeoutSec 2
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

if (-not (Test-ServerUp)) {
    Write-Host "Starting dev server... (logs: /tmp/mycars-website-dev.log)"
    $env:PORT = "$Port"
    $devProcess = Start-Process -FilePath "npm" -ArgumentList "run", "dev" `
        -NoNewWindow `
        -RedirectStandardOutput "/tmp/mycars-website-dev.log" `
        -RedirectStandardError "/tmp/mycars-website-dev-error.log" `
        -PassThru

    Write-Host "Waiting for server to start (up to 30 seconds, press Ctrl+C to skip)..."
    $upped = $false
    try {
        for ($i = 0; $i -lt 30; $i++) {
            Start-Sleep -Seconds 1

            if ($devProcess.HasExited) {
                Write-Host ""
                Write-Error "Dev server crashed! Check logs:"
                Write-Host "STDOUT: /tmp/mycars-website-dev.log"
                Write-Host "STDERR: /tmp/mycars-website-dev-error.log"
                Get-Content /tmp/mycars-website-dev-error.log -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "  $_" }
                exit 1
            }

            if (Test-ServerUp) {
                $upped = $true
                Write-Host ""
                Write-Host "Server is ready!"
                break
            }
            Write-Host "." -NoNewline
        }
    } catch {
        Write-Host ""
        Write-Host "Interrupted. Server is running in the background."
        Write-Host "Logs: /tmp/mycars-website-dev.log"
    }

    if (-not $upped) {
        Write-Host "Server is still starting (this sometimes takes a moment). Check logs at /tmp/mycars-website-dev.log"
        Write-Host "You can continue and refresh the browser in a moment."
    }
} else {
    Write-Host "Server already running on port $Port."
}

Write-Host "Opening $Url in Chrome..."
& open -a "Google Chrome" $Url
