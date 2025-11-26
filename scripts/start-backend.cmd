@echo off
setlocal enabledelayedexpansion

set SCRIPT_DIR=%~dp0
set BACKEND_DIR=%SCRIPT_DIR%backend

if not exist "%BACKEND_DIR%" (
  echo Backend nao encontrado em "%BACKEND_DIR%".
  exit /b 1
)

pushd "%BACKEND_DIR%"

if not exist node_modules (
  echo Instalando dependencias do backend...
  npm install --production
  if errorlevel 1 (
    echo Falha ao instalar dependencias.
    popd
    exit /b 1
  )
)

echo Iniciando scale-server...
node scale-server.cjs

popd

