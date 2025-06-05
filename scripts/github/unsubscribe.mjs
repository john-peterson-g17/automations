import { Octokit } from "@octokit/rest";
import dotenv from "dotenv";
import pLimit from "p-limit";
import { octokit, checkRateLimit } from "./utils.mjs";

dotenv.config();

const token = process.env.GITHUB_TOKEN;

if (!token) {
  console.error("❌ Missing GITHUB_TOKEN in environment variables or .env");
  process.exit(1);
}

const octokit = new Octokit({ auth: token });
const CONCURRENCY = 5;
const limit = pLimit(CONCURRENCY);

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

async function fetchAllNotificationsWithRetry() {
  while (true) {
    try {
      await checkRateLimit();
      return await octokit.paginate(
        octokit.activity.listNotificationsForAuthenticatedUser,
        { per_page: 50, all: false, participating: false }
      );
    } catch (err) {
      if (err.status === 403 && err.message.includes("API rate limit exceeded")) {
        const { data } = await octokit.rateLimit.get();
        const waitTime = Math.max(data.rate.reset * 1000 - Date.now(), 0);
        console.warn(`⏳ Rate limit exceeded. Waiting ${Math.ceil(waitTime / 1000)}s to retry...`);
        await new Promise((res) => setTimeout(res, waitTime));
      } else {
        throw err;
      }
    }
  }
}

async function autoUnsubscribe() {
  console.log("📬 Fetching all inbox notifications...");

  const allNotifications = await fetchAllNotificationsWithRetry();

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

  console.log(`\n🚀 Done. Unsubscribed from ${unsubscribed} threads (excluding mentions).`);
}

autoUnsubscribe();
