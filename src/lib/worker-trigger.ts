// Réveille le worker GitHub Actions quand un job est créé (repository_dispatch).
// Fail-soft : si non configuré ou si l'appel échoue, le job reste simplement en
// file d'attente — le cron de secours du workflow le ramassera.

export async function triggerWorker(): Promise<void> {
  const token = process.env.GITHUB_WORKER_TOKEN;
  const repo = process.env.GITHUB_WORKER_REPO; // ex: "Oxidoo/Video2Skill"
  if (!token || !repo) return;

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "video2skill",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ event_type: "process-jobs" }),
    });
    if (res.status !== 204) {
      console.warn(`[worker-trigger] GitHub dispatch failed: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.warn("[worker-trigger] GitHub dispatch error:", err);
  }
}
