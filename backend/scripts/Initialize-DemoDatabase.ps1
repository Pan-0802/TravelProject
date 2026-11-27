param([switch]$RebuildDemo,[string]$EnvironmentFile=(Join-Path $PSScriptRoot '../.env.local'))
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'Read-LocalEnvironment.ps1') -EnvironmentFile $EnvironmentFile
$backendPath=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$projectPath=(Resolve-Path (Join-Path $backendPath '..')).Path
foreach($name in @('DB_URL','DB_USERNAME','DB_PASSWORD')) {
    if($null -eq [Environment]::GetEnvironmentVariable($name,'Process')) { throw "请先在当前终端设置 $name，值无需写入源码。" }
}
Push-Location $backendPath
try {
    & mvn '-DskipTests' package
    if($LASTEXITCODE -ne 0){throw '后端编译失败'}
    $jar=Join-Path $backendPath 'target/travel-backend-0.1.0-SNAPSHOT.jar'
    $arguments=@('-Dloader.main=com.travel.tools.DatabaseInitializer','-cp',$jar,'org.springframework.boot.loader.launch.PropertiesLauncher',(Join-Path $projectPath 'schema.sql'))
    if($RebuildDemo){$arguments+='--rebuild-demo'}
    & java @arguments
    if($LASTEXITCODE -ne 0){throw '演示库初始化未完成，请按上一条提示处理。'}
} finally {Pop-Location}
