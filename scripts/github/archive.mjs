import pLimit from "p-limit";
import { octokit, checkRateLimit } from "./utils.mjs";

const CONCURRENCY = 5;
const limit = pLimit(CONCURRENCY);

async function markThreadAsDone(threadId) {
  await octokit.request("PATCH /notifications/threads/{thread_id}", {
    thread_id: threadId,
    reason: "done",
  });
}

async function processNotification(notif) {
  const { subject, repository, id: threadId, reason } = notif;
  const { type, title, url: subjectUrl } = subject;

  if (!["Issue", "PullRequest"].includes(type)) return;

  if (reason === "mention") {
    console.log(`🔔 Skipping mention: ${title}`);
    return false;
  }

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
      await markThreadAsDone(threadId);
      console.log(`📪 Marked as done: ${type}: ${title} (${owner}/${repo})`);
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

async function fetchAllNotificationsWithRetry() {
  while (true) {
    try {
      await checkRateLimit();
      return await octokit.paginate(
        octokit.activity.listNotificationsForAuthenticatedUser,
        { per_page: 50, all: true, participating: false }
      );
    } catch (err) {
      if (
        err.status === 403 &&
        err.message.includes("API rate limit exceeded")
      ) {
        const { data } = await octokit.rateLimit.get();
        const waitTime = Math.max(data.rate.reset * 1000 - Date.now(), 0);
        console.warn(
          `⏳ Rate limit exceeded. Waiting ${Math.ceil(
            waitTime / 1000
          )}s to retry...`
        );
        await new Promise((res) => setTimeout(res, waitTime));
      } else {
        throw err;
      }
    }
  }
}

async function autoArchive() {
  console.log("📬 Fetching all inbox notifications...");

  const allNotifications = await fetchAllNotificationsWithRetry();

  console.log(`🔍 Found ${allNotifications.length} notifications`);

  let archived = 0;

  const tasks = allNotifications.map((notif) =>
    limit(() =>
      processNotification(notif).then((success) => {
        if (success) archived++;
      })
    )
  );

  await Promise.all(tasks);

  console.log(
    `\n🚀 Done. Marked ${archived} closed/merged threads as done (excluding mentions).`
  );
}

autoArchive();
