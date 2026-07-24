@echo off
echo ========================================
echo   Metodikish - Deploy to GitHub
echo ========================================
echo.

echo [1/3] Adding files...
git add server/ client/ admin/ bot/ backend/ Dockerfile fly.toml .github/ package.json

echo [2/3] Committing...
set /p msg="Commit message: "
git commit -m "%msg%"

echo [3/3] Pushing to GitHub...
git push

echo.
echo ========================================
echo   Deploy complete!
echo ========================================
pause
