param(
    [switch]$UseExistingBackend,
    [switch]$BoundariesOnly,
    [ValidateSet('poi-prefill.spec.ts','boundaries.spec.ts','crud.spec.ts','integration.spec.ts')]
    [string]$TestFile,
    [string]$BackendUrl = 'http://127.0.0.1:18080',
    [string]$JavaHome = $env:JAVA_HOME
)
$ErrorActionPreference = 'Stop'
$frontendRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$projectRoot = (Resolve-Path (Join-Path $frontendRoot '..')).Path
$savedEnvironment = @{}
$backendProcess = $null
function Set-TaskEnvironment([string]$Name, [string]$Value) {
    if (-not $savedEnvironment.ContainsKey($Name)) { $savedEnvironment[$Name] = [Environment]::GetEnvironmentVariable($Name, 'Process') }
    [Environment]::SetEnvironmentVariable($Name, $Value, 'Process')
}
Push-Location $frontendRoot
try {
    if (-not $UseExistingBackend) {
        if ($BackendUrl -ne 'http://127.0.0.1:18080') { throw 'Managed backend uses port 18080; use -UseExistingBackend for another URL.' }
        if ([string]::IsNullOrWhiteSpace($JavaHome)) { throw 'Set JAVA_HOME or pass -JavaHome with a JDK17/21 directory.' }
        Set-TaskEnvironment 'JAVA_HOME' $JavaHome
        $backendRoot = Join-Path $projectRoot 'backend'
        [xml]$workspace = Get-Content -LiteralPath (Join-Path $backendRoot '.idea/workspace.xml') -Encoding UTF8 -Raw
        $config = $workspace.SelectSingleNode("//configuration[@name='TravelApplication']")
        if ($null -eq $config) { throw 'TravelApplication IDEA configuration was not found.' }
        foreach ($entry in $config.SelectNodes('.//env')) { Set-TaskEnvironment $entry.GetAttribute('name') $entry.GetAttribute('value') }
        & mvn -f (Join-Path $backendRoot 'pom.xml') -DskipTests package
        if ($LASTEXITCODE -ne 0) { throw 'Backend build failed.' }
        $jar = Join-Path $backendRoot 'target/travel-backend-0.1.0-SNAPSHOT.jar'
        $backendProcess = Start-Process -FilePath (Join-Path $JavaHome 'bin/java.exe') -WindowStyle Hidden -PassThru `
            -ArgumentList @('-jar', ('"' + $jar + '"'), '--server.port=18080') `
            -RedirectStandardOutput (Join-Path $backendRoot 'target/browser-acceptance-backend.log') `
            -RedirectStandardError (Join-Path $backendRoot 'target/browser-acceptance-backend-error.log')
    }
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try {
            $response = Invoke-RestMethod -Uri ($BackendUrl + '/health/ready') -TimeoutSec 3
            if ($response.code -eq 0 -and $response.data.database -eq 'UP') { $ready = $true; break }
        } catch { }
        Start-Sleep -Seconds 1
    }
    if (-not $ready) { throw 'Backend/database readiness check did not pass.' }
    Set-TaskEnvironment 'E2E_BACKEND' $BackendUrl
    if ($TestFile) { & npm.cmd run test:e2e -- $TestFile }
    elseif ($BoundariesOnly) { & npm.cmd run test:boundaries }
    else { & npm.cmd run test:e2e }
    if ($LASTEXITCODE -ne 0) { throw 'Browser acceptance failed; see test-results and playwright-report.' }
} finally {
    if ($null -ne $backendProcess -and -not $backendProcess.HasExited) {
        $running = Get-CimInstance Win32_Process -Filter "ProcessId=$($backendProcess.Id)"
        if ($running.CommandLine -like '*travel-backend-0.1.0-SNAPSHOT.jar*--server.port=18080*') { Stop-Process -Id $backendProcess.Id }
    }
    foreach ($name in $savedEnvironment.Keys) { [Environment]::SetEnvironmentVariable($name, $savedEnvironment[$name], 'Process') }
    Pop-Location
}
