import { Octokit } from "@octokit/rest";
export const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const MAX_RETRIES = 10;

export async function checkRateLimit(retry = 0) {
  const { data } = await octokit.rateLimit.get();
  const { remaining, reset } = data.rate;

  const now = Date.now();
  const resetTimeMs = reset * 1000;
  const msUntilReset = Math.max(resetTimeMs - now, 0);
  const min = Math.floor(msUntilReset / 60000);
  const sec = Math.floor((msUntilReset % 60000) / 1000);

  console.log(
    `🔎 GitHub rate limit: ${remaining} remaining, resets in ${min}m ${sec}s`
  );

  if (remaining < 10) {
    if (retry >= MAX_RETRIES) {
      throw new Error("❌ Max rate limit retries exceeded");
    }

    console.log(
      `⏳ Rate limit low — waiting ${Math.ceil(msUntilReset / 1000)}s (retry ${
        retry + 1
      }/${MAX_RETRIES})`
    );
    await new Promise((res) => setTimeout(res, msUntilReset));

    return checkRateLimit(retry + 1);
  }
}
