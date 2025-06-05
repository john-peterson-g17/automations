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

async function processUnsubscribe(notif) {
  const { subject, id: threadId, reason } = notif;
  const { type, title } = subject;

  if (reason === "mention") {
    console.log(`🔔 Skipping mention: ${title}`);
    return false;
  }

  try {
    await checkRateLimit();
    await octokit.activity.deleteThreadSubscription({ thread_id: threadId });
    console.log(`🔕 Unsubscribed from ${type}: ${title}`);
    return true;
  } catch (err) {
    if (err.status === 404) {
      console.log(`⏩ Already unsubscribed (404): ${title}`);
      return false;
    }

    console.warn(`⚠️ Failed to unsubscribe from ${title}: ${err.message}`);
    return false;
  }
}

async function autoUnsubscribe() {
  console.log("📬 Fetching all inbox notifications...");

  const allNotifications = await octokit.paginate(
    octokit.activity.listNotificationsForAuthenticatedUser,
    { per_page: 50, all: false, participating: false }
  );

  console.log(`🔍 Found ${allNotifications.length} notifications`);

  let unsubscribed = 0;

  const tasks = allNotifications.map((notif) =>
    limit(() =>
      processUnsubscribe(notif).then((success) => {
        if (success) unsubscribed++;
      })
    )
  );

  await Promise.all(tasks);

  console.log(
    `\n🚀 Done. Unsubscribed from ${unsubscribed} threads (excluding mentions).`
  );
}

autoUnsubscribe();
