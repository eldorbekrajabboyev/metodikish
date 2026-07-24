Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Metodikish - Deploy to GitHub" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] Adding files..." -ForegroundColor Yellow
git add server/ client/ admin/ bot/ backend/ Dockerfile fly.toml .github/ package.json

$msg = Read-Host "Commit message"

Write-Host "[2/3] Committing..." -ForegroundColor Yellow
git commit -m $msg

Write-Host "[3/3] Pushing to GitHub..." -ForegroundColor Yellow
git push

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Deploy complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
