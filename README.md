# AIA Internship project

Financial Agent Dashboard backed by API calls to the database layer.

## Run locally

Start the local API shim, then open the `frontend/` pages in a browser.

```powershell
$env:RECRUITMENT_ACCESS_CODE = "your-local-code"
node backend\server.js
```

When using VS Code Live Server, open `frontend/login.html`. The frontend will call
`http://127.0.0.1:8080` locally. For AWS/RDS, set the API Gateway invoke URL in
`backend/api-config.js`.

## Pages

- **Overview** - lead KPIs, sales / closure summary, CPF tracker, and resources
- **Leads** - client profiles, urgency tracking, filtering, and closure estimates
- **Calendar** - appointments, meet-ups, reminders, and linked tasks
- **Recruitment** - restricted analytics unlocked through the API-backed access route
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
