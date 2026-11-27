param([string]$EnvironmentFile=(Join-Path $PSScriptRoot '../.env.local'))
$ErrorActionPreference='Stop'
if(Test-Path -LiteralPath $EnvironmentFile){
    foreach($line in Get-Content -LiteralPath $EnvironmentFile -Encoding UTF8){
        $entry=$line.Trim()
        if(-not $entry -or $entry.StartsWith('#')){continue}
        $parts=$entry.Split('=',2)
        if($parts.Count -ne 2 -or $parts[0] -notmatch '^(DB_URL|DB_USERNAME|DB_PASSWORD|JWT_SECRET|CORS_ORIGINS|SERVER_PORT|AMAP_KEY|AI_API_KEY|AI_BASE_URL|AI_MODEL|AI_MAX_OUTPUT_TOKENS|EXTERNAL_TIMEOUT_SECONDS|AMAP_INTERVAL_MILLIS)$'){
            throw '本地配置有不支持的变量名，请对照 .env.example；不要在此文件放脚本命令。'
        }
        $value=$parts[1].Trim()
        if($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))){$value=$value.Substring(1,$value.Length-2)}
        [Environment]::SetEnvironmentVariable($parts[0],$value,'Process')
    }
}
