@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 goto :node_ausente
where npm.cmd >nul 2>&1
if errorlevel 1 goto :node_ausente
node -e "if (Number(process.versions.node.split('.')[0]) < 24) { console.error('Instale o Node.js 24 ou superior pelo site nodejs.org.'); process.exit(1); }"
if errorlevel 1 goto :erro
if exist "node_modules\tsx\package.json" goto :dependencias_prontas
echo Preparando o Pipsfit. Na primeira vez, e necessario acesso a internet.
call npm ci --no-audit --no-fund
if errorlevel 1 goto :erro
:dependencias_prontas
if exist "dist\index.html" goto :build_pronto
call npm run build
if errorlevel 1 goto :erro
:build_pronto
set "NODE_ENV=development"
set "HOST=127.0.0.1"
if not defined PORT set "PORT=3001"
set "APP_ORIGIN=http://localhost:%PORT%"
echo Iniciando o Pipsfit. Mantenha esta janela aberta enquanto usar o aplicativo.
start "" /b node scripts\abrir-navegador.mjs
call npm start
if errorlevel 1 goto :erro
exit /b 0
:node_ausente
echo Instale o Node.js 24 pelo site nodejs.org e abra este arquivo novamente.
:erro
echo Nao foi possivel iniciar. Confira a mensagem acima.
pause
exit /b 1
