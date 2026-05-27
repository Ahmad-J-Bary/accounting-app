#Requires -Version 5.1
# ─────────────────────────────────────────────────────────────
# Almowakeb – Windows development environment setup
# ─────────────────────────────────────────────────────────────
param([switch]$CI)

$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $PSScriptRoot
Set-Location $ROOT

Write-Host "==> Checking prerequisites..." -ForegroundColor Green

# ── Rust (rustup) ──────────────────────────────────────────
if (-not (Get-Command "rustc" -ErrorAction SilentlyContinue)) {
  Write-Host "==> Installing Rust (rustup)..." -ForegroundColor Green
  $url = "https://win.rustup.rs/x86_64"
  $installer = "$env:TEMP\rustup-init.exe"
  Invoke-WebRequest -Uri $url -OutFile $installer -UseBasicParsing
  & $installer -y --default-toolchain stable
  $env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
} else {
  Write-Host "  Rust already installed: $(rustc --version)" -ForegroundColor Cyan
}

# ── Node.js / pnpm ────────────────────────────────────────
if (-not (Get-Command "pnpm" -ErrorAction SilentlyContinue)) {
  Write-Host "==> Installing pnpm via corepack..." -ForegroundColor Green
  npm install -g corepack
  corepack enable
  pnpm --version
} else {
  Write-Host "  pnpm already installed: $(pnpm --version)" -ForegroundColor Cyan
}

# ── JS dependencies ───────────────────────────────────────
Write-Host "==> Installing JavaScript dependencies..." -ForegroundColor Green
$env:CI = if ($CI) { "true" } else { "false" }
pnpm install --frozen-lockfile

# ── WebView2 ──────────────────────────────────────────────
Write-Host "  WebView2 is bundled with Windows 10 (1809+) / Windows 11." -ForegroundColor Cyan
Write-Host "  Ensure you have the WebView2 Runtime installed if on older builds." -ForegroundColor Yellow

Write-Host ""
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  pnpm tauri:dev"
