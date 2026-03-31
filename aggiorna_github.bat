@echo off
setlocal
cd /d "%~dp0"

echo.
echo ===== AGGIORNAMENTO SITO GITHUB =====
echo Cartella: %CD%
echo.

git rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 (
  echo ERRORE: questa cartella non e' una repository Git valida.
  exit /b 1
)

git add .

git diff --cached --quiet
if %ERRORLEVEL%==0 (
  echo Nessuna modifica da pubblicare.
  exit /b 0
)

git commit -m "Update sito"
if errorlevel 1 (
  echo ERRORE durante il commit.
  exit /b 1
)

git push origin main
if errorlevel 1 (
  echo ERRORE durante il push.
  exit /b 1
)

echo.
echo ===== AGGIORNAMENTO COMPLETATO =====
exit /b 0
