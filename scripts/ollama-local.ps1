$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$env:OLLAMA_HOST = '127.0.0.1:11435'
$env:OLLAMA_MODELS = Join-Path $project '.local/ollama-models'
$env:OLLAMA_NO_CLOUD = '1'
$env:OLLAMA_NUM_PARALLEL = '1'
$env:OLLAMA_MAX_LOADED_MODELS = '1'
& ollama serve
exit $LASTEXITCODE
