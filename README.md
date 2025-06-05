# Automations

Just some personal automations to make life easier

## Scripts

All automations are held in the `scripts` directory

Prior to running any script ensure you have:

1. Node.js 18+ installed
2. Installed npm dependencies

```bash
npm install
```

---

### Unsubscribe (`unsubscribe.mjs`)

This script automatically unsubscribes you from GitHub notifications where you are **not directly mentioned**.

#### 📌 What It Does

- Fetches **all inbox notifications**
- Skips any notification where the reason is `mention`
- For all others, calls `DELETE /notifications/threads/:id/subscription` to unsubscribe
- Uses GitHub's REST API with pagination and rate-limit awareness
- Executes requests in parallel with safe concurrency (default: 5)

#### ⚙️ Requirements

- A **classic GitHub personal access token (PAT)** with at least:
  - `notifications` scope
  - `repo` scope (if working with private repositories)

#### 🔐 .env Setup

Create a `.env` file in the root directory:

```
GITHUB_TOKEN=ghp_your_personal_token_here
```

✅ Make sure the token is a **classic token** — fine-grained tokens do not support notification APIs.

#### 🚀 Run the Script

```bash
node scripts/github/unsubscribe.mjs
```

#### 🧠 Notes

- This script does **not** archive any notifications — it only unsubscribes
- You will still see unsubscribed notifications in your inbox unless separately archived
- Default concurrency is 5 and can be modified in the script

---

### Archive (`archive.mjs`)

This script archives (marks as read) notifications related to closed issues or merged pull requests, **except** those where you are directly mentioned.

#### 📌 What It Does

- Fetches **all inbox notifications**
- Skips notifications with `reason: mention`
- For issues:
  - Archives if `state === closed`
- For pull requests:
  - Archives if `state === closed` or `merged === true`
- Uses GitHub's REST API with pagination and rate-limit awareness
- Runs in parallel (default: 5 at a time)

#### ⚙️ Requirements

- A **classic GitHub personal access token (PAT)** with at least:
  - `notifications` scope
  - `repo` scope (if working with private repositories)

#### 🔐 .env Setup

Create a `.env` file in the root directory:

```
GITHUB_TOKEN=ghp_your_personal_token_here
```

✅ Make sure the token is a **classic token** — fine-grained tokens do not support notification APIs.

#### 🚀 Run the Script

```bash
node scripts/github/archive.mjs
```

#### 🧠 Notes

- This script does **not** unsubscribe you from threads — it only archives them to clean your inbox
- Mentioned threads are always left unarchived
- Use in combination with `unsubscribe.mjs` for full inbox cleanup
