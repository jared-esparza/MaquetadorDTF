@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instala Node.js LTS desde https://nodejs.org y vuelve a abrir este archivo.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm ci
  if errorlevel 1 goto error
)
if not exist dist\index.html (
  call npm run build
  if errorlevel 1 goto error
)
node scripts\serve.mjs
if errorlevel 1 goto error
exit /b 0
:error
echo No se ha podido iniciar el maquetador. Revisa el mensaje anterior.
pause
exit /b 1
