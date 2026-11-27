param([switch]$UseIdeaConfiguration,[string]$JavaHome=$env:JAVA_HOME)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'Read-LocalEnvironment.ps1') -EnvironmentFile (Join-Path $PSScriptRoot '../.env.local')
$backendRoot=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$saved=@{}
try {
    if($UseIdeaConfiguration) {
        [xml]$workspace=Get-Content -LiteralPath (Join-Path $backendRoot '.idea/workspace.xml') -Raw -Encoding UTF8
        $configuration=$workspace.SelectSingleNode("//configuration[@name='TravelApplication']")
        if($null -eq $configuration) {throw 'TravelApplication run configuration was not found.'}
        foreach($entry in $configuration.SelectNodes('.//env')) {
            $name=$entry.GetAttribute('name')
            if($name -in @('DB_URL','DB_USERNAME','DB_PASSWORD')) {
                $saved[$name]=[Environment]::GetEnvironmentVariable($name,'Process')
                [Environment]::SetEnvironmentVariable($name,$entry.GetAttribute('value'),'Process')
            }
        }
    }
    if([string]::IsNullOrWhiteSpace($JavaHome)) {throw 'Set JAVA_HOME or pass -JavaHome (JDK17/21).'}
    if([string]::IsNullOrWhiteSpace($env:DB_URL)) {throw 'Set DB_URL, DB_USERNAME and DB_PASSWORD, or use -UseIdeaConfiguration.'}
    $connectorRoot=Join-Path $env:USERPROFILE '.m2/repository/com/mysql/mysql-connector-j'
    $jar=Get-ChildItem -LiteralPath $connectorRoot -Recurse -Filter 'mysql-connector-j-*.jar' | Where-Object {$_.Name -notmatch 'sources|javadoc'} | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if($null -eq $jar) {throw 'MySQL driver not found; import the backend Maven project first.'}
    $sql=Join-Path $backendRoot 'src/main/resources/db/mysql/upgrade-chat.sql'
    & (Join-Path $JavaHome 'bin/java.exe') --class-path $jar.FullName (Join-Path $PSScriptRoot 'InstallChatSchema.java') $sql
    if($LASTEXITCODE -ne 0) {throw 'Chat schema upgrade failed; original application tables were not modified.'}
} finally {
    foreach($name in $saved.Keys) {[Environment]::SetEnvironmentVariable($name,$saved[$name],'Process')}
}
