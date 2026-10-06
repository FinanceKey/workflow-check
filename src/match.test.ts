import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {blocksRunner, type JobInfo} from './match.js';

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
});
