//
// This script is designed to query the github API for a useful summary
// of recent nightly CI results (though this could be expanded later).
//
// The general flow is as follows:
//   - It queries the github API for the workflow runs for the nightly CI (e.g.
//     the last 10 nights/runs).
//   - For each of those runs, it queries the API for all the jobs data (e.g.
//     data on the tdx or snp jobs in each run).
//   - It reorganizes and summarizes those results in an array, where each
//     entry is information about a job and how it has performed over the last
//     few runs (e.g. pass or fail).
// 
// Count of API calls:
//     1 for the batch of last 10 nightly run
//    20 for 2 batches of >100 jobs for each of the 10 runs
//     1 for the main branch details (for list of 'Required' jobs)
//     1 for the last 10 closed pull requests
//    20 for all 4 batches of checks (max of a hundred each) for each of the 5 PRs
//     X Other?
// TOTAL: 53?
// LIMIT: 60 per hour  // curl https://api.github.com/rate_limit
// TODO: Further explore using the GraphQL API, which permits more narrowly targeted queries 

// Github API URL for the kata-container ci-nightly workflow's runs. This
// will only get the most recent 10 runs ('page' is empty, and 'per_page=10').
var ci_nightly_runs_url =
  "https://api.github.com/repos/" +
  "kata-containers/kata-containers/actions/workflows/" +
  "ci-nightly.yaml/runs?per_page=10";
  // NOTE: For checks run on main after push/merge, do similar call with: payload-after-push.yaml

// NOTE: pull_requests attribute often empty if commit/branch from a fork: https://github.com/orgs/community/discussions/25220
// Current approach (there may be better alternatives) is to:
//   1. retrieve the last 10 closed PRs
//   2. fetch the checks for each PR (using the head commit SHA)
var pull_requests_url =
  "https://api.github.com/repos/" +
  "kata-containers/kata-containers/pulls?state=closed&per_page=";
var pr_checks_url =  // for our purposes, 'check' refers to a job in the context of a PR
  "https://api.github.com/repos/" +
  "kata-containers/kata-containers/commits/";  // will be followed by {commit_sha}/check-runs
  // Max of 100 per page, w/ little *over* 300 checks total, so that's 40 calls total for 10 PRs

// Github API URL for the main branch of the kata-containers repo.
// Used to get the list of required jobs.
var main_branch_url = 
  "https://api.github.com/repos/" +
  "kata-containers/kata-containers/branches/main";

// Github API URL for the main branch of the kata-containers repo.
// Used to get the list of required jobs.
var main_branch_url = 
  "https://api.github.com/repos/" +
  "kata-containers/kata-containers/branches/main";

// The number of jobs to fetch from the github API on each paged request.
var jobs_per_request = 100;
// The last X closed PRs to retrieve
var pr_count = 5;  // TODO: Update to 10 after testing
// Complete list of jobs (from the CI nightly run)
var job_names = new Set();
// Count of the number of fetches
var fetch_count = 0;

// Perform a github API request for workflow runs.
async function fetch_workflow_runs() {
  fetch_count++;
  console.log(`fetch ${fetch_count}: ${ci_nightly_runs_url}`);
  return fetch(ci_nightly_runs_url, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  }).then(function (response) {
    return response.json();
  });
}

// Perform a github API request for the last pr_count closed PRs
async function fetch_pull_requests() {
  fetch_count++;
  const prs_url = `${pull_requests_url}${pr_count}`;
  console.log(`fetch ${fetch_count}: ${prs_url}`);
  return fetch(prs_url, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  }).then(function (response) {
    return response.json();
  });
}

// Perform a github API request for a list of "Required" jobs
async function fetch_main_branch() {
  return fetch(main_branch_url, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  }).then(function (response) {
    return response.json();
  });
}

// Get job data about a workflow run
// Returns a map that has information about a run, e.g.
//   ID assigned by github
//   run number assigned by github
//   'jobs' array, which has some details about each job from that run
function get_job_data(run) {
  // Perform the actual (paged) request
  async function fetch_jobs_by_page(which_page) {
    fetch_count++;
    var jobs_url =
      run["jobs_url"] + "?per_page=" + jobs_per_request + "&page=" + which_page;
    console.log(`fetch ${fetch_count}: ${jobs_url}`);
    return fetch(jobs_url, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }).then(function (response) {
      return response.json();
    });
  }

  // Fetch the jobs for a run. Extract a few details from the response,
  // including the job name and whether it concluded successfully.
  function fetch_jobs(p) {
    return fetch_jobs_by_page(p).then(function (jobs_request) {
      for (const job of jobs_request["jobs"]) {
        if (!job_names.has(job["name"])) {
          job_names.add(job["name"])
        };
        run_with_job_data["jobs"].push({
          name: job["name"],
          run_id: job["run_id"],
          html_url: job["html_url"],
          conclusion: job["conclusion"],
        });
      }
      if (p * jobs_per_request >= jobs_request["total_count"]) {
        return run_with_job_data;
      }
      return fetch_jobs(p + 1);
    });
  }

  var run_with_job_data = {
    id: run["id"],
    run_number: run["run_number"],
    created_at: run["created_at"],
    conclusion: null,
    jobs: [],
  };
  if (run["status"] == "in_progress") {
    return new Promise((resolve) => {
      resolve(run_with_job_data);
    });
  }
  run_with_job_data["conclusion"] = run["conclusion"];
  return fetch_jobs(1);
}

function get_check_data(pr) {
  // Perform a github API request for a list of commits for a PR (takes in the PR's head commit SHA)
  async function fetch_checks_by_page(which_page) {
    fetch_count++;
    var checks_url = 
      pr_checks_url + prs_with_check_data["commit_sha"] + "/check-runs" + "?per_page=" + jobs_per_request + "&page=" + which_page;
    console.log(`fetch ${fetch_count}: ${checks_url}`);
    return fetch(checks_url, {  
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }).then(function (response) {
      return response.json();
    });
  }

  // Fetch the checks for a PR.
  function fetch_checks(p) {
    if (p > 60) {
      throw new Error(`Attempting to make too many API calls: ${p}`)
    }
    return fetch_checks_by_page(p)
    .then(function (checks_request) {
      // console.log('checks_request', checks_request);
      for (const check of checks_request["check_runs"]) {
        // NOTE: For now, excluding checks that are not also run in CI Nightly
        if (job_names.has(check["name"])) {  
          prs_with_check_data["checks"].push({
            name: check["name"],
            conclusion: check["conclusion"]
          });
        }
      }
      if (p * jobs_per_request >= checks_request["total_count"]) {
        return prs_with_check_data;
      }
      return fetch_checks(p + 1);
    })
    .catch(function (error) {
      console.error("Error fetching checks:", error);
      throw error;
    });
  }

  // Extract list of objects with PR commit SHAs, PR URLs, and PR number (i.e. id)
  var prs_with_check_data = {
    html_url: pr["html_url"],  // link to PR page
    number: pr["number"],  // PR number (used as PR id); displayed on dashboard
    commit_sha: pr["head"]["sha"],  // For getting checks run on PR branch
    // commit_sha: pr["merge_commit_sha"],  // For getting checks run on main branch after merge
    // NOTE: using for now b/c we'll be linking to the PR page, where these checks are listed...
    checks: [],  // will be populated later with fetch_checks
  };

  return fetch_checks(1);
}

// Extract list of required jobs (i.e. main branch details: protection: required_status_checks: contexts)
function get_required_jobs(main_branch) {
  var required_jobs = main_branch["protection"]["required_status_checks"]["contexts"];
  // console.log('required jobs: ', required_jobs);
  return required_jobs;
}

// Calculate and return job stats across all runs
function compute_job_stats(runs_with_job_data, prs_with_check_data, required_jobs) {
  var job_stats = {};
  for (const run of runs_with_job_data) {
    for (const job of run["jobs"]) {
      if (!(job["name"] in job_stats)) {
        job_stats[job["name"]] = {
          runs: 0, // e.g. 10, if it ran 10 times
          fails: 0, // e.g. 3, if it failed 3 out of 10 times
          skips: 0, // e.g. 7, if it got skipped the other 7 times
          urls: [], // ordered list of URLs associated w/ each run
          results: [], // an array of strings, e.g. 'Pass', 'Fail', ...
          run_nums: [], // ordered list of github-assigned run numbers
          pr_urls: [], // list of PR URLs that this job is associated with
          pr_results: [], // list of job statuses for the PRs in which the job was run
          pr_nums: [], // list of PR numbers that this job is associated with
          pr_runs: 0, // e.g. 10, if it ran 10 times
          pr_fails: 0, // e.g. 3, if it failed 3 out of 10 times
          pr_skips: 0, // e.g. 7, if it got skipped the other 7 times
        };
      }
      var job_stat = job_stats[job["name"]];
      job_stat["runs"] += 1;
      job_stat["run_nums"].push(run["run_number"]);
      job_stat["urls"].push(job["html_url"]);
      if (job["conclusion"] != "success") {
        if (job["conclusion"] == "skipped") {
          job_stat["skips"] += 1;
          job_stat["results"].push("Skip");
        } else {
          // failed or cancelled
          job_stat["fails"] += 1;
          job_stat["results"].push("Fail");
        }
      } else {
        job_stat["results"].push("Pass");
      }
      job_stat["required"] = required_jobs.includes(job["name"]);
    }
  }
  for (const pr of prs_with_check_data) {
    for (const check of pr["checks"]) {
      if ((check["name"] in job_stats)) {
        var job_stat = job_stats[check["name"]];
        job_stat["pr_runs"] += 1;
        job_stat["pr_urls"].push(pr["html_url"]);
        job_stat["pr_nums"].push(pr["number"]);
        if (check["conclusion"] != "success") {
          if (check["conclusion"] == "skipped") {
            // TODO: increment these counts?
            job_stat["pr_skips"] += 1;
            job_stat["pr_results"].push("Skip");
          } else {
            // failed or cancelled
            job_stat["pr_fails"] += 1;
            job_stat["pr_results"].push("Fail");
          }
        } else {
          job_stat["pr_results"].push("Pass");
        }
      }
    }
  }
  return job_stats;
}

async function main() {
  // Fetch recent workflow runs via the github API
  var workflow_runs = await fetch_workflow_runs();

  // Fetch required jobs from main branch
  var main_branch = await fetch_main_branch();
  var required_jobs = get_required_jobs(main_branch);

  // Fetch job data for each of the runs.
  // Store all of this in an array of maps, runs_with_job_data.
  var promises_buf = [];
  for (const run of workflow_runs["workflow_runs"]) {
    promises_buf.push(get_job_data(run));
  }
  runs_with_job_data = await Promise.all(promises_buf);

  // Fetch recent pull requests via the github API
  var pull_requests = await fetch_pull_requests();

  // Fetch last pr_count closed PRs
  // Store all of this in an array of maps, prs_with_check_data.
  var promises_buffer = [];
  for (const pr of pull_requests) {
    promises_buffer.push(get_check_data(pr));
  }
  prs_with_check_data = await Promise.all(promises_buffer);

  // Transform the raw details of each run and its jobs' results into a
  // an array of just the jobs and their overall results (e.g. pass or fail,
  // and the URLs associated with them).
  var job_stats = compute_job_stats(runs_with_job_data, prs_with_check_data, required_jobs);

  // Write the job_stats to console as a JSON object
  console.log(JSON.stringify(job_stats));
  // console.log(JSON.stringify(required_jobs));
}


main();
