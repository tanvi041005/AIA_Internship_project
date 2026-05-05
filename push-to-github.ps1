# Push this folder to https://github.com/tanvi041005/AIA_Internship_project
# Run:  cd "...\AIA Internship" ; .\push-to-github.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path .git)) {
  git init
}

git add financial-dashboard README.md .gitignore push-to-github.ps1
git status

git commit -m "Financial Agent Dashboard (HTML/CSS)" 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "(No new commit — working tree clean or same as last commit.)"
}

git branch -M main

git remote remove origin 2>$null
git remote add origin "https://github.com/tanvi041005/AIA_Internship_project.git"

Write-Host "Pushing to origin (main) ..."
git push -u origin main
