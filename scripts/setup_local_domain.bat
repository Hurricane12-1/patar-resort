@echo off
:: ============================================================================
:: J & D Beach House - Local Domain Setup Script
:: Location: Brgy. Patar, Bolinao, Pangasinan
:: Configures Windows Hosts file for local domain resolution:
::   - janddbeachhouse.local
::   - api.janddbeachhouse.local
::   - admin.janddbeachhouse.local
:: ============================================================================

echo.
echo ============================================================
echo   J ^& D BEACH HOUSE - LOCAL DOMAIN PROVISIONER
echo   Brgy. Patar, Bolinao, Pangasinan
echo ============================================================
echo.

:: Check for administrative rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] Administrative permissions required.
    echo Requesting elevation...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

set "HOSTS_FILE=%SystemRoot%\System32\drivers\etc\hosts"

echo [+] Checking Windows hosts file: %HOSTS_FILE%

:: Check if entry already exists
findstr /i "janddbeachhouse.local" "%HOSTS_FILE%" >nul 2>&1
if %errorLevel% equ 0 (
    echo [OK] Domain entries for janddbeachhouse.local already exist in hosts file!
) else (
    echo [+] Adding local domain entries to hosts file...
    echo. >> "%HOSTS_FILE%"
    echo # J ^& D Beach House - Patar, Bolinao Local Domain Mapping >> "%HOSTS_FILE%"
    echo 127.0.0.1  janddbeachhouse.local >> "%HOSTS_FILE%"
    echo 127.0.0.1  api.janddbeachhouse.local >> "%HOSTS_FILE%"
    echo 127.0.0.1  admin.janddbeachhouse.local >> "%HOSTS_FILE%"
    echo [OK] Successfully appended entries to hosts file.
)

echo [+] Flushing DNS cache...
ipconfig /flushdns >nul 2>&1
echo [OK] DNS Cache flushed.

echo.
echo ============================================================
echo   SUCCESS! Local domain configured.
echo.
echo   You can now access:
echo   - https://janddbeachhouse.local:4000
echo   - https://janddbeachhouse.localhost:4000 (RFC 6761 native)
echo   - https://localhost:4000
echo ============================================================
echo.
pause
