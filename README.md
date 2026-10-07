# workflow-check

[![build-test](https://github.com/FinanceKey/workflow-check/actions/workflows/test.yml/badge.svg)](https://github.com/FinanceKey/workflow-check/actions/workflows/test.yml)

A GitHub Action that checks whether any other workflow run still has a job on a given self-hosted runner, typically before deallocating the runner VM.

Fork of [ronymeyer/workflow-check](https://github.com/ronymeyer/workflow-check).

A job of another run blocks the runner when it is not completed and

* its `runner_name` is the runner label or starts with `<runnerLabel>-` (several runner services on one machine, e.g. `GitHubRunner05-02`), or
* it requests `runnerLabel` in `runs-on`, or
* it is not yet assigned to a runner and requests `self-hosted`, since it could still be picked up by this runner, unless it requests the label of another machine listed in `runnerLabels`.

A job's `labels` are the labels it requested, not the labels of the runner it landed on, so a job using a shared label such as `[self-hosted, dotNet10]` can only be tied to a machine through `runner_name`.

Runs with status `pending` have no jobs yet, so any pending run blocks the runner. Runs with status `requested`, `waiting`, `queued` and `in_progress` are checked job by job; every job considered is logged together with the reason it blocks or not.

## Usage

### Inputs

* `token` - Your GitHub API token with `actions: read`. You can just use `${{ secrets.GITHUB_TOKEN }}`
* `currentRunId` - The run id of the current runner, required to exclude from results. Use `${{ github.run_id }}`
* `runnerLabel` - Runner to check, see above
* `runnerLabels` - Optional labels of all machines, as a JSON array (e.g. `${{ vars.RUNNER_VMS }}`) or comma separated. Without it, every queued self-hosted job blocks every machine.

### Outputs

* `foundRunningJob` - `true` if other running jobs have been found, `false` otherwise. In GitHub Actions the out put has to be compared to string. In bash booleans can be used. See [Create a check run](https://docs.github.com/rest/reference/checks#create-a-check-run)

## Example Workflow

```yaml
name: 'release-version'
on:
  pull_request:
  push:
    branches:
      - master
  workflow_dispatch:

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v7
        
      - name: Build
        run: # Build scripts
        
      - name: Check CI
        id: check-ci
        uses: FinanceKey/workflow-check@v3.0.0
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          currentRunId: ${{ github.run_id }}
          runnerLabel: "ubuntu-latest"
          
      - name: Release
        if: ${{ steps.check-ci.outputs.foundRunningJob == 'true' }}
        run: # Release scripts
```

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE)