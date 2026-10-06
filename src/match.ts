export type RunStatus =
  'pending' | 'requested' | 'waiting' | 'queued' | 'in_progress';

export interface JobInfo {
  name: string;
  status: string;
  labels: string[];
  runner_name: string | null;
}

/**
 * Returns why the job keeps the runner busy, or null if it does not.
 *
 * `labels` are the labels the job requested in `runs-on`, not the labels of the
 * runner it landed on, so a job requesting a shared label such as
 * `[self-hosted, dotNet10]` is only tied to a machine through `runner_name`.
 * Runner names are expected to be the runner label itself or the label followed
 * by `-<n>` when several runner services run on one machine (`GitHubRunner05-02`).
 */
export function blocksRunner(job: JobInfo, runnerLabel: string): string | null {
  if (job.status === 'completed') return null;

  const runnerName = job.runner_name ?? '';
  if (runnerName === runnerLabel || runnerName.startsWith(`${runnerLabel}-`))
    return `running on ${runnerName}`;

  if (job.labels.includes(runnerLabel)) return `requests ${runnerLabel}`;

  // Not yet assigned to a runner: any self-hosted runner matching its labels may still pick it up.
  if (!runnerName && job.labels.includes('self-hosted'))
    return 'unassigned self-hosted job';

  return null;
}
