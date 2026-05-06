# AIA Internship project

Financial Agent Dashboard - static HTML/CSS (no build step).

## Run locally

Open `financial-dashboard/index.html` in a browser, or from PowerShell:

```powershell
Start-Process .\financial-dashboard\index.html
```

## Pages

- **Overview** - lead KPIs, sales / closure summary, CPF tracker, and resources
- **Leads** - client profiles, urgency tracking, filtering, and closure estimates
- **Calendar** - appointments, meet-ups, reminders, and linked tasks
- **Recruitment** - leader gate; default demo code is `changeme` (see `recruitment-login.html`)
- **Training** and **Resources**

## GitHub

Repository: [AIA_Internship_project](https://github.com/tanvi041005/AIA_Internship_project)

### Push from your PC

Your **`Documents`** folder may already be a different Git repo (another remote). This internship site should use its **own** repo rooted here (`AIA Internship`), not the whole Documents tree.

In PowerShell:

```powershell
cd "c:\Users\user\Documents\AIA Internship"
.\push-to-github.ps1
```

If execution policy blocks scripts:

```powershell
Set-ExecutionPolicy -Scope Process -Bypass
.\push-to-github.ps1
```

Or run the commands manually:

```powershell
cd "c:\Users\user\Documents\AIA Internship"
git init
git add financial-dashboard README.md .gitignore
git commit -m "Initial commit: Financial Agent Dashboard (HTML/CSS)"
git branch -M main
git remote add origin https://github.com/tanvi041005/AIA_Internship_project.git
git push -u origin main
```

If `remote origin already exists`, use:

```powershell
git remote set-url origin https://github.com/tanvi041005/AIA_Internship_project.git
git push -u origin main
```

Sign in to GitHub when prompted, or use a [personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token) as the password for HTTPS.
