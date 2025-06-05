import { Octokit } from "@octokit/rest";
import dotenv from "dotenv";
import pLimit from "p-limit";

dotenv.config();

const token = process.env.GITHUB_TOKEN;

if (!token) {
  console.error("❌ Missing GITHUB_TOKEN in environment variables or .env");
  process.exit(1);
}

const octokit = new Octokit({ auth: token });
const CONCURRENCY = 5;
const limit = pLimit(CONCURRENCY);

async function checkRateLimit() {
  const { data } = await octokit.rateLimit.get();
  const remaining = data.rate.remaining;
  const reset = data.rate.reset;

  if (remaining < 10) {
    const waitTime = Math.max(reset * 1000 - Date.now(), 0);
    console.log(
      `⏳ Rate limit low, sleeping for ${Math.ceil(waitTime / 1000)}s`
    );
    await new Promise((res) => setTimeout(res, waitTime));
  }
}

async function processNotification(notif) {
  const { subject, repository, id: threadId } = notif;
  const { type, title, url: subjectUrl } = subject;

  if (!["Issue", "PullRequest"].includes(type)) return;

  try {
    const match = subjectUrl.match(
      /repos\/([^/]+)\/([^/]+)\/(issues|pulls)\/(\d+)/
    );
    if (!match) return;

    const [, owner, repo, resource, number] = match;

    await checkRateLimit();

    let state = "";
    let merged = false;

    if (resource === "issues") {
      const { data: issue } = await octokit.issues.get({
        owner,
        repo,
        issue_number: number,
      });
      state = issue.state;
    } else {
      const { data: pr } = await octokit.pulls.get({
        owner,
        repo,
        pull_number: number,
      });
      state = pr.state;
      merged = pr.merged;
    }

    if (state === "closed" || merged) {
      await octokit.activity.deleteThreadSubscription({ thread_id: threadId });
      console.log(`🔕 Unsubscribed from ${type}: ${title} (${owner}/${repo})`);
      return true;
    } else {
      console.log(
        `✅ Kept ${type}: ${title} (state=${state}, merged=${merged})`
      );
    }
  } catch (err) {
    console.warn(`⚠️ Error processing ${title}: ${err.message}`);
  }

  return false;
}

async function autoUnsubscribe() {
  console.log("📬 Fetching all notifications...");

  const allNotifications = await octokit.paginate(
    octokit.activity.listNotificationsForAuthenticatedUser,
    { per_page: 50, all: false, participating: false }
  );

  console.log(`🔍 Found ${allNotifications.length} notifications`);

  let unsubscribed = 0;

  const tasks = allNotifications.map((notif) =>
    limit(() =>
      processNotification(notif).then((success) => {
        if (success) unsubscribed++;
      })
    )
  );

  await Promise.all(tasks);

  console.log(`\n🚀 Done. Unsubscribed from ${unsubscribed} threads.`);
}

autoUnsubscribe();
