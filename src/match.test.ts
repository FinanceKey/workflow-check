import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {blocksRunner, parseLabels, type JobInfo} from './match.js';

function job(overrides: Partial<JobInfo>): JobInfo {
  return {
    name: 'job',
    status: 'in_progress',
    labels: ['self-hosted', 'dotNet10'],
    runner_name: null,
    ...overrides
  };
}

describe('blocksRunner', () => {
  it('blocks when a shared-label job runs on one of the machine runners', () => {
    const reason = blocksRunner(
      job({runner_name: 'GitHubRunner05-02'}),
      'GitHubRunner05'
    );
    assert.equal(reason, 'running on GitHubRunner05-02');
  });

  it('blocks when the runner name equals the label', () => {
    assert.notEqual(
      blocksRunner(job({runner_name: 'GitHubRunner05'}), 'GitHubRunner05'),
      null
    );
  });

  it('does not block for a runner whose name only shares a prefix', () => {
    assert.equal(
      blocksRunner(job({runner_name: 'GitHubRunner050-01'}), 'GitHubRunner05'),
      null
    );
  });

  it('does not block for a job running on another machine', () => {
    assert.equal(
      blocksRunner(job({runner_name: 'GitHubRunner02-01'}), 'GitHubRunner05'),
      null
    );
  });

  it('blocks when the job requests the runner label', () => {
    const reason = blocksRunner(
      job({labels: ['self-hosted', 'GitHubRunner05'], status: 'queued'}),
      'GitHubRunner05'
    );
    assert.notEqual(reason, null);
  });

  it('blocks for an unassigned self-hosted job', () => {
    assert.equal(
      blocksRunner(job({status: 'queued'}), 'GitHubRunner05'),
      'unassigned self-hosted job'
    );
  });

  it('does not block for an unassigned GitHub-hosted job', () => {
    assert.equal(
      blocksRunner(
        job({status: 'queued', labels: ['ubuntu-latest']}),
        'GitHubRunner05'
      ),
      null
    );
  });

  it('does not block for a completed job', () => {
    assert.equal(
      blocksRunner(
        job({status: 'completed', runner_name: 'GitHubRunner05-02'}),
        'GitHubRunner05'
      ),
      null
    );
  });

  const machines = ['GitHubRunner02', 'GitHubRunner05'];

  it('does not block for an unassigned job requesting another machine', () => {
    assert.equal(
      blocksRunner(
        job({status: 'queued', labels: ['self-hosted', 'GitHubRunner05']}),
        'GitHubRunner02',
        machines
      ),
      null
    );
  });

  it('blocks the machine an unassigned job requests', () => {
    assert.equal(
      blocksRunner(
        job({status: 'queued', labels: ['self-hosted', 'GitHubRunner05']}),
        'GitHubRunner05',
        machines
      ),
      'requests GitHubRunner05'
    );
  });

  it('blocks every machine for an unassigned shared-label job', () => {
    assert.equal(
      blocksRunner(job({status: 'queued'}), 'GitHubRunner02', machines),
      'unassigned self-hosted job'
    );
  });

  it('still blocks for a job running here that requested another machine', () => {
    assert.equal(
      blocksRunner(
        job({
          runner_name: 'GitHubRunner02-01',
          labels: ['self-hosted', 'GitHubRunner05']
        }),
        'GitHubRunner02',
        machines
      ),
      'running on GitHubRunner02-01'
    );
  });
});

describe('parseLabels', () => {
  it('parses a JSON array', () => {
    assert.deepEqual(parseLabels('["GitHubRunner02", "GitHubRunner05"]'), [
      'GitHubRunner02',
      'GitHubRunner05'
    ]);
  });

  it('parses a comma or newline separated list', () => {
    assert.deepEqual(
      parseLabels(' GitHubRunner02, GitHubRunner05\nGitHubRunner03 '),
      ['GitHubRunner02', 'GitHubRunner05', 'GitHubRunner03']
    );
  });

  it('returns no labels for an empty input', () => {
    assert.deepEqual(parseLabels('  '), []);
  });

  it('rejects a JSON value that is not an array of strings', () => {
    assert.throws(() => parseLabels('[1, 2]'));
  });
});
