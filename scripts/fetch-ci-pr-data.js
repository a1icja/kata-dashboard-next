//
// This script is designed to query the github API for a useful summary
// of recent PR CI tests.
//
// The general flow is as follows:
//   1. retrieve the last 10 closed PRs
//   2. fetch the checks for each PR (using the head commit SHA)
//
// To run locally:
// node --require dotenv/config scripts/fetch-ci-pr-data.js
// .env file with:
// NODE_ENV=development
// TOKEN=token <GITHUB_PAT_OR_OTHER_VALID_TOKEN>


// Set token used for making Authorized GitHub API calls
const TOKEN = process.env.TOKEN;  // In dev, set by .env file; in prod, set by GitHub Secret
  
// pull_requests attribute often empty if commit/branch from a fork: https://github.com/orgs/community/discussions/25220
var pull_requests_url =
  "https://api.github.com/repos/" +
  "kata-containers/kata-containers/pulls?state=closed&per_page=";
var pr_checks_url =  // for our purposes, 'check' refers to a job in the context of a PR
  "https://api.github.com/repos/" +
  "kata-containers/kata-containers/commits/";  // will be followed by {commit_sha}/check-runs
  // Max of 100 per page, w/ little *over* 300 checks total, so that's 40 calls total for 10 PRs

// Github API URL for the main branch of the kata-containers repo.
// Used to get the list of required jobs/checks.
var main_branch_url = 
  "https://api.github.com/repos/" +
  "kata-containers/kata-containers/branches/main";


// The number of checks to fetch from the github API on each paged request.
var results_per_request = 100;
// The last X closed PRs to retrieve
var pr_count = 10; 
// Count of the number of fetches
var fetch_count = 0;


// Perform a github API request for the last pr_count closed PRs
async function fetch_pull_requests() {
    const prs_url = `${pull_requests_url}${pr_count}`;
    const response = await fetch(prs_url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `token ${TOKEN}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
  
    if (!response.ok) {
      throw new Error(`Failed to fetch pull requests: ${response.status}`);
    }
  
    const json = await response.json();
    fetch_count++;
    // console.log(`fetch ${fetch_count}: ${prs_url}
    //     returned PRs cnt: ${Object.keys(json).length}`);
    return json;
}


// Perform a github API request for a list of "Required" jobs
async function fetch_main_branch() {
    const response = await fetch(main_branch_url, {
        headers: {
            Accept: "application/vnd.github+json",
            Authorization: `token ${TOKEN}`,
            "X-GitHub-Api-Version": "2022-11-28",
        },
    });

    if (!response.ok) {
    throw new Error(`Failed to fetch main branch data: ${response.status}`);
    }

    const json = await response.json();
    fetch_count++;
    const contexts = json?.protection?.required_status_checks?.contexts;
    // console.log(`fetch ${fetch_count}: ${main_branch_url}
    //     required jobs cnt: ${contexts.length}`);
    return json;
}


// Perform a github API request for a list of commits for a PR (takes in the PR's head commit SHA)
function get_check_data(pr) {
  async function fetch_checks_by_page(which_page) {
    var checks_url = `${pr_checks_url}${prs_with_check_data["commit_sha"]}/check-runs?per_page=${results_per_request}&page=${which_page}`;
    const response = await fetch(checks_url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `token ${TOKEN}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch check data: ${response.status}`);
    }

    const json = await response.json();
    fetch_count++;
    // console.log(`fetch ${fetch_count}: ${checks_url}
    //     returned check cnt / total cnt: ${json['check_runs'].length} / ${json['total_count']}`);
    return json;
  }

  // Fetch the checks for a PR.
  function fetch_checks(p) {
    return fetch_checks_by_page(p)
    .then(function (checks_request) {
      // console.log('checks_request', checks_request);
      for (const check of checks_request["check_runs"]) {
        prs_with_check_data["checks"].push({
            name: check["name"],
            conclusion: check["conclusion"]
        });
      }
      if (p * results_per_request >= checks_request["total_count"]) {
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


// Calculate and return check stats across all runs
function compute_check_stats(prs_with_check_data, required_jobs) {
  var check_stats = {};
  for (const pr of prs_with_check_data) {
    for (const check of pr["checks"]) {
        if (!(check["name"] in check_stats)) {
            check_stats[check["name"]] = {
                runs: 0,     // e.g. 10, if it ran 10 times
                fails: 0,    // e.g. 3, if it failed 3 out of 10 times
                skips: 0,    // e.g. 7, if it got skipped the other 7 times
                urls: [],    // list of PR URLs that this check is associated with
                results: [], // list of check statuses for the PRs in which the check was run
                run_nums: [],    // list of PR numbers that this check is associated with
            };
        }
        if ((check["name"] in check_stats)) {
            var check_stat = check_stats[check["name"]];
            check_stat["runs"] += 1;
            check_stat["urls"].push(pr["html_url"])
            check_stat["run_nums"].push(pr["number"])
            if (check["conclusion"] != "success") {
            if (check["conclusion"] == "skipped") {
                check_stat["skips"] += 1;
                check_stat["results"].push("Skip");
            } else {
                // failed or cancelled
                check_stat["fails"] += 1;
                check_stat["results"].push("Fail");
            }
            } else {
            check_stat["results"].push("Pass");
            }
            check_stat["required"] = required_jobs.includes(check["name"]);
        }
    }
  }
  return check_stats;
}


async function main() {
  // Fetch required jobs from main branch
  var main_branch = await fetch_main_branch();
  var required_jobs = get_required_jobs(main_branch);

  // Fetch recent pull requests via the github API
  var pull_requests = await fetch_pull_requests();

  // Fetch last pr_count closed PRs
  // Store all of this in an array of maps, prs_with_check_data.
  var promises_buffer = [];
  for (const pr of pull_requests) {
    promises_buffer.push(get_check_data(pr));
  }
  prs_with_check_data = await Promise.all(promises_buffer);
  // console.log("prs_with_check_data: ", prs_with_check_data);
  
  // Transform the raw details of each run and its checks' results into a
  // an array of just the checks and their overall results (e.g. pass or fail,
  // and the URLs associated with them).
  var check_stats = compute_check_stats(prs_with_check_data, required_jobs);

  // Write the check_stats to console as a JSON object
  console.log(JSON.stringify(check_stats));
  // console.log(JSON.stringify(required_jobs));

  // Print total number of jobs
  // console.log(`\n\nTotal job count: ${Object.keys(check_stats).length}\n\n`);
}


main();