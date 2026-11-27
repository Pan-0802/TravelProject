param(
    [switch]$UseExistingBackend,
    [switch]$BoundariesOnly,
    [switch]$RunLiveAi,
    [ValidateSet('course-compliance.spec.ts','poi-prefill.spec.ts','boundaries.spec.ts','crud.spec.ts','integration.spec.ts','planning-ux.spec.ts','conversation.spec.ts','chat-live.spec.ts','four-day-live.spec.ts','schedule.spec.ts')]
    [string[]]$TestFile,
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
        $localFile=Join-Path $backendRoot '.env.local'
        $ideaFile=Join-Path $backendRoot '.idea/workspace.xml'
        if(Test-Path -LiteralPath $localFile){
            foreach($name in @('DB_URL','DB_USERNAME','DB_PASSWORD','JWT_SECRET','CORS_ORIGINS','SERVER_PORT','AMAP_KEY','AI_API_KEY','AI_BASE_URL','AI_MODEL','AI_MAX_OUTPUT_TOKENS','EXTERNAL_TIMEOUT_SECONDS','AMAP_INTERVAL_MILLIS')){
                if(-not $savedEnvironment.ContainsKey($name)){$savedEnvironment[$name]=[Environment]::GetEnvironmentVariable($name,'Process')}
            }
            . (Join-Path $backendRoot 'scripts/Read-LocalEnvironment.ps1') -EnvironmentFile $localFile
        }elseif(Test-Path -LiteralPath $ideaFile){
            [xml]$workspace=Get-Content -LiteralPath $ideaFile -Encoding UTF8 -Raw
            $config=$workspace.SelectSingleNode("//configuration[@name='TravelApplication']")
            if($null -ne $config){foreach($entry in $config.SelectNodes('.//env')){Set-TaskEnvironment $entry.GetAttribute('name') $entry.GetAttribute('value')}}
        }
        if(-not $env:DB_URL -or -not $env:JWT_SECRET){throw 'Configure backend/.env.local or DB_URL and JWT_SECRET environment variables first.'}
        $browserPort = if ($env:E2E_PORT) { [int]$env:E2E_PORT } else { 5175 }
        if ($browserPort -lt 1 -or $browserPort -gt 65535) { throw 'E2E_PORT must be a valid local port.' }
        $testOrigins = @($env:CORS_ORIGINS, "http://localhost:$browserPort", "http://127.0.0.1:$browserPort") | Where-Object { $_ }
        Set-TaskEnvironment 'CORS_ORIGINS' ($testOrigins -join ',')
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
    if($RunLiveAi -or ($TestFile | Where-Object {$_ -in @('chat-live.spec.ts','four-day-live.spec.ts')})){
        Set-TaskEnvironment 'RUN_LIVE_AI' 'true'
    }
    if ($TestFile) { & npm.cmd run test:e2e -- @TestFile }
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
