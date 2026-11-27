param([string]$EnvironmentFile=(Join-Path $PSScriptRoot '../.env.local'))
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'Read-LocalEnvironment.ps1') -EnvironmentFile $EnvironmentFile
if(-not $env:JWT_SECRET -or $env:JWT_SECRET -eq 'replace-with-at-least-32-random-bytes'){
    throw '请在本机 .env.local 设置固定的随机 JWT_SECRET；生成方法见根目录 README。'
}
if(-not $env:DB_URL -or -not $env:DB_USERNAME -or $env:DB_PASSWORD -eq 'replace-me'){
    throw '请在本机 .env.local 填写 DB_URL、DB_USERNAME、DB_PASSWORD；文件已被Git忽略。'
}
Push-Location (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
try{& mvn 'spring-boot:run';if($LASTEXITCODE -ne 0){throw '后端启动失败，请检查最后的错误提示。'}}finally{Pop-Location}
