
$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $PSScriptRoot

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Starting Metodo Chronos System...      " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Stop any existing processes on ports 3005 (backend) and 8081 (frontend)
$ports = @(3005, 8081)
foreach ($port in $ports) {
    try {
        $process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
        if ($process) {
            Write-Host "Cleaning port $port (Killing process $process)..." -ForegroundColor Yellow
            Stop-Process -Id $process -Force -ErrorAction SilentlyContinue
        }
    }
    catch {
        Write-Warning "Failed to clear port $port. It might be in use by another user or system service."
    }
}

# Start Backend
if (Test-Path "backend\node_modules") {
    Write-Host "`n[1/2] Starting Backend on port 3005..." -ForegroundColor Green
    Start-Process -FilePath "npm.cmd" -ArgumentList "run dev" -WorkingDirectory "$PSScriptRoot\backend" -WindowStyle Normal
}
else {
    Write-Error "node_modules not found in backend folder. Please run 'npm install' first."
}

# Start Frontend
if (Test-Path "frontend\node_modules") {
    Write-Host "[2/2] Starting Frontend on port 8081..." -ForegroundColor Green
    Start-Process -FilePath "npm.cmd" -ArgumentList "run dev" -WorkingDirectory "$PSScriptRoot\frontend" -WindowStyle Normal
}
else {
    Write-Error "node_modules not found in frontend folder. Please run 'npm install' first."
}

Write-Host "`nSystem start command issued. Please check the new windows." -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
