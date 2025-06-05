# Automations

Just some personal automations to make life easier

## Scripts

All automations are held in the `scripts` directory

Prior to running any script ensure you have:

1. Node.js 18+ installed
2. Installed npm dependancies

```bash
npm install
```

### Unsubscribe

This script automatically unsubscribes you from GitHub notifications for issues or pull requests that are already **closed** or **merged**.

#### 📌 What It Does

- Fetches **all notifications** in your GitHub inbox (not just participating)
- Filters for issues and pull requests
- For each:
  - If the issue is **closed**, or the PR is **merged**, it unsubscribes
  - Otherwise, leaves it alone
- Uses **GitHub's REST API** with built-in pagination and rate limit awareness
- Processes notifications in parallel (default: 5 at a time)

#### ⚙️ Requirements

- A **classic GitHub personal access token (PAT)** with at least:
  - `notifications` scope
  - `repo` scope (if working with private repositories)

#### 🔐 .env Setup

Create a `.env` file in the root directory:

GITHUB_TOKEN=ghp_your_personal_token_here

> ✅ Make sure the token is a **classic token** — fine-grained tokens do not support notification APIs.

#### 🚀 Run the Script

```bash
node scripts/unsubscribe.js
```

#### 🧠 Notes

- The script is **rate-limit aware** — it will pause if you're about to exceed your GitHub API quota
- Default concurrency is `5`, which you can adjust in the script via `const CONCURRENCY = 5`
- The script logs unsubscribed threads and skipped (open) ones
