param(
    [string]$EnvironmentFile=(Join-Path $PSScriptRoot '../.env.local'),
    [string]$OutputFile,
    [string]$MysqlDumpPath,
    [switch]$UseIdeaConfiguration
)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'Read-LocalEnvironment.ps1') -EnvironmentFile $EnvironmentFile
if($UseIdeaConfiguration){
    $ideaFile=Join-Path $PSScriptRoot '../.idea/workspace.xml'
    [xml]$settings=Get-Content -LiteralPath $ideaFile -Raw -Encoding UTF8
    $run=$settings.SelectSingleNode("//configuration[@name='TravelApplication']")
    if($null -eq $run){throw '找不到 TravelApplication 运行配置。'}
    foreach($entry in $run.SelectNodes('.//env')){
        if($entry.GetAttribute('name') -in @('DB_URL','DB_USERNAME','DB_PASSWORD')){
            [Environment]::SetEnvironmentVariable($entry.GetAttribute('name'),$entry.GetAttribute('value'),'Process')
        }
    }
}
if(-not $env:DB_URL -or -not $env:DB_USERNAME -or $env:DB_PASSWORD -eq 'replace-me'){
    throw '请先填写 backend/.env.local 的数据库配置，或显式使用 -UseIdeaConfiguration。'
}
$databaseUri=[Uri]($env:DB_URL -replace '^jdbc:','')
$databaseName=$databaseUri.AbsolutePath.TrimStart('/')
if($databaseUri.Scheme -ne 'mysql' -or $databaseName -notmatch '^[A-Za-z0-9_]+$' -or $databaseName -in @('mysql','information_schema','performance_schema','sys')){
    throw '只允许导出 DB_URL 指定的应用数据库，不能导出 MySQL 系统库。'
}
$databasePort=if($databaseUri.Port -gt 0){$databaseUri.Port}else{3306}
$candidates=@()
if($MysqlDumpPath){$candidates+=$MysqlDumpPath}else{
    foreach($version in @('8.0','8.4')){
        if($env:ProgramFiles){$candidates+=(Join-Path $env:ProgramFiles "MySQL/MySQL Server $version/bin/mysqldump.exe")}
    }
    $command=Get-Command mysqldump -ErrorAction SilentlyContinue
    if($command){$candidates+=$command.Source}
}
$dumpExecutable=$null
foreach($candidate in $candidates){
    if(Test-Path -LiteralPath $candidate){
        $versionText=(& $candidate --version | Out-String)
        if($LASTEXITCODE -eq 0 -and $versionText -match '\bVer 8\.'){$dumpExecutable=$candidate;break}
    }
}
if(-not $dumpExecutable){throw '请安装 MySQL 8.x 客户端，或用 -MysqlDumpPath 指定其 mysqldump.exe 完整路径。'}
if(-not $OutputFile){$OutputFile=Join-Path $PSScriptRoot ('../backups/'+$databaseName+'-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.sql')}
$OutputFile=[IO.Path]::GetFullPath($OutputFile)
if(Test-Path -LiteralPath $OutputFile){throw '目标文件已经存在，请使用新的备份文件名。'}
$outputDirectory=Split-Path -Parent $OutputFile
if(-not (Test-Path -LiteralPath $outputDirectory)){$null=New-Item -ItemType Directory -Path $outputDirectory}
$partialFile=$OutputFile+'.'+[Guid]::NewGuid().ToString('N')+'.partial'
$savedPassword=$env:MYSQL_PWD
try{
    # 仅通过临时进程环境传递密码，不写入命令行、SQL 或日志。
    $env:MYSQL_PWD=$env:DB_PASSWORD
    $dumpArguments=@('--no-defaults',('--host='+$databaseUri.DnsSafeHost),('--port='+$databasePort),('--user='+$env:DB_USERNAME),
        '--single-transaction','--skip-lock-tables','--skip-add-locks','--skip-add-drop-table',
        '--no-tablespaces','--set-gtid-purged=OFF','--column-statistics=0','--default-character-set=utf8mb4',
        '--complete-insert','--hex-blob','--routines','--events','--triggers',('--result-file='+$partialFile),$databaseName)
    & $dumpExecutable @dumpArguments
    if($LASTEXITCODE -ne 0){throw '数据库导出失败，未生成可交付备份，请查看客户端错误。'}
    [IO.File]::Move($partialFile,$OutputFile)
    [pscustomobject]@{Database=$databaseName;File=$OutputFile;Bytes=(Get-Item -LiteralPath $OutputFile).Length}
}finally{
    [Environment]::SetEnvironmentVariable('MYSQL_PWD',$savedPassword,'Process')
    if(Test-Path -LiteralPath $partialFile){Remove-Item -LiteralPath $partialFile}
}
