@echo off
title Deploy Edge Function - generate-embedding
echo.
echo Desplegando Edge Function a Supabase...
echo.
cd /d "%~dp0.."
npx supabase functions deploy generate-embedding --use-api --project-ref ctmpsokjdguygjqmxyob
echo.
echo Presiona cualquier tecla para salir...
pause >nul