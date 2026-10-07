import * as core from '@actions/core';
import {createActionAuth} from '@octokit/auth-action';
import {Octokit} from '@octokit/rest';
import {getOptionalInput, getOwnerAndRepo, getRepository} from './utils.js';
import {
  blocksRunner,
  parseLabels,
  type JobInfo,
  type RunStatus
} from './match.js';

async function checkWorkflow(
  octokit: Octokit,
  owner: string,
  repo: string,
  statusToCheck: RunStatus,
  currentRunId: number,
  runnerLabel: string,
  runnerLabels: string[]
): Promise<boolean> {
  core.info(`Start checking for status ${statusToCheck}.`);

  const workflowRuns = await octokit.paginate(
    octokit.rest.actions.listWorkflowRunsForRepo,
    {owner, repo, status: statusToCheck, per_page: 100}
  );
  const otherRuns = workflowRuns.filter(run => run.id !== currentRunId);
  core.info(
    `Found ${workflowRuns.length} run(s) with status ${statusToCheck}, ${otherRuns.length} other than the current run.`
  );

  if (statusToCheck === 'pending' && otherRuns.length > 0) {
    // Pending runs have no jobs yet, so it is unknown which runner they will use.
    for (const run of otherRuns) {
      core.info(`Pending run ${run.id} '${run.name}' blocks the runner.`);
    }
    return true;
  }

  for (const run of otherRuns) {
    const jobs: JobInfo[] = await octokit.paginate(
      octokit.rest.actions.listJobsForWorkflowRun,
      {owner, repo, run_id: run.id, filter: 'latest', per_page: 100}
    );
    core.info(`Run ${run.id} '${run.name}' has ${jobs.length} job(s).`);

    for (const job of jobs) {
      const reason = blocksRunner(job, runnerLabel, runnerLabels);
      core.info(
        `  job '${job.name}' status=${job.status} runner=${job.runner_name ?? '-'} labels=[${job.labels.join(',')}] -> ${reason ?? 'not blocking'}`
      );
      if (reason) {
        core.info(
          `End checking for status ${statusToCheck}. foundRunningJob: true`
        );
        return true;
      }
    }
  }

  core.info(`End checking for status ${statusToCheck}. foundRunningJob: false`);
  return false;
}

async function run(): Promise<void> {
  try {
    const currentRunId = Number(
      core.getInput('currentRunId', {required: true})
    );
    const runnerLabel = core.getInput('runnerLabel', {required: true});
    const runnerLabels = parseLabels(core.getInput('runnerLabels'));
    const [owner, repo] = getOwnerAndRepo(
      getOptionalInput('repo') ?? getRepository()
    );

    core.info(
      `Checking if there are any running jobs on runner ${runnerLabel} which are not part of run id ${currentRunId}`
    );
    if (runnerLabels.length > 0)
      core.info(`Machine labels: ${runnerLabels.join(', ')}`);

    const authentication = await createActionAuth()();
    core.info(
      `Auth token type ${authentication.tokenType}, owner ${owner}, repo ${repo}`
    );
    const octokit = new Octokit({auth: authentication.token});

    const statusesToCheck: RunStatus[] = [
      'pending',
      'requested',
      'waiting',
      'queued',
      'in_progress'
    ];
    let foundRunningJob = false;
    for (const statusToCheck of statusesToCheck) {
      foundRunningJob = await checkWorkflow(
        octokit,
        owner,
        repo,
        statusToCheck,
        currentRunId,
        runnerLabel,
        runnerLabels
      );
      if (foundRunningJob) break;
    }

    core.info(`foundRunningJob: ${foundRunningJob}`);
    core.setOutput('foundRunningJob', foundRunningJob);
  } catch (ex) {
    core.setFailed(`Failed with error: ${ensureError(ex).message}.`);
  }
}

function ensureError(value: unknown): Error {
  if (value instanceof Error) return value;

  let stringified = '[Unable to stringify the thrown value]';
  try {
    stringified = JSON.stringify(value);
  } catch {}

  return new Error(
    `This value was thrown as is, not through an Error: ${stringified}`
  );
}

run();
