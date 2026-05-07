@echo off
setlocal

REM Exact user consent string required by Prisma safety gate
set "PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=Yes — wipe the TiDB `sispaa_router` database completely."

cd /d "%~dp0\.."
echo Running: npx prisma migrate reset --force
npx prisma migrate reset --force
set EXITCODE=%ERRORLEVEL%
echo Exit code: %EXITCODE%
exit /b %EXITCODE%

