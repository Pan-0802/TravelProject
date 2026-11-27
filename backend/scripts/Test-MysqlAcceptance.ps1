param(
    [switch]$UseIdeaConfiguration,
    [string]$ServerUrl,
    [string]$Username,
    [Security.SecureString]$Password
)

$ErrorActionPreference = 'Stop'
$backendRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

if ($UseIdeaConfiguration) {
    $workspaceFile = Join-Path $backendRoot '.idea/workspace.xml'
    [xml]$workspaceXml = Get-Content -LiteralPath $workspaceFile -Encoding UTF8 -Raw
    $runConfiguration = $workspaceXml.SelectSingleNode("//configuration[@name='TravelApplication']")
    if ($null -eq $runConfiguration) { throw 'TravelApplication run configuration was not found.' }
    $runVariables = @{}
    foreach ($entry in $runConfiguration.SelectNodes('.//env')) {
        $runVariables[$entry.GetAttribute('name')] = $entry.GetAttribute('value')
    }
    $jdbcUrl = $runVariables['DB_URL']
    if ($jdbcUrl -notmatch '^jdbc:mysql://([^/]+)/[^?]*(\?.*)?$') { throw 'Invalid DB_URL in the IDEA run configuration.' }
    $ServerUrl = 'jdbc:mysql://' + $Matches[1] + '/' + $Matches[2]
    $Username = $runVariables['DB_USERNAME']
    if ([string]::IsNullOrWhiteSpace($Username)) { $Username = 'root' }
    if ([string]::IsNullOrEmpty($runVariables['DB_PASSWORD'])) {
        $Password = [Security.SecureString]::new()
    } else {
        $Password = ConvertTo-SecureString -String $runVariables['DB_PASSWORD'] -AsPlainText -Force
    }
}

if ($ServerUrl -notmatch '^jdbc:mysql://(127\.0\.0\.1|localhost)(:\d+)?/(\?.*)?$') {
    throw 'Only local MySQL server URLs with an empty database path are accepted.'
}
if ([string]::IsNullOrWhiteSpace($Username)) { $Username = Read-Host 'MySQL username' }
if ($null -eq $Password) { $Password = Read-Host 'MySQL password' -AsSecureString }

$names = @('MYSQL_SERVER_URL', 'MYSQL_TEST_USERNAME', 'MYSQL_TEST_PASSWORD', 'RUN_MYSQL_ACCEPTANCE')
$savedVariables = @{}
foreach ($name in $names) { $savedVariables[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }

Push-Location $backendRoot
try {
    $env:MYSQL_SERVER_URL = $ServerUrl
    $env:MYSQL_TEST_USERNAME = $Username
    $env:MYSQL_TEST_PASSWORD = [Net.NetworkCredential]::new('', $Password).Password
    $env:RUN_MYSQL_ACCEPTANCE = 'true'
    # The Java test creates a fixed travel_acceptance_course catalog. It refuses to start if that catalog exists and drops only its own newly created catalog.
    & mvn '-Dtest=MysqlAcceptanceTest' test
    if ($LASTEXITCODE -ne 0) { throw 'MySQL acceptance tests failed. See target/surefire-reports.' }
} finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $savedVariables[$name], 'Process') }
    Pop-Location
}
