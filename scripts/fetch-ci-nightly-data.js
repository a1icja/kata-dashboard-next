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
// To run locally:
// node --require dotenv/config scripts/fetch-ci-nightly-data.js
// .env file with:
// NODE_ENV=development
// TOKEN=token <GITHUB_PAT_OR_OTHER_VALID_TOKEN>

// Set token used for making Authorized GitHub API calls.
// In dev, set by .env file; in prod, set by GitHub Secret.
require('dotenv').config();
const TOKEN = process.env.TOKEN;  
  
// Github API URL for the kata-container ci-nightly workflow's runs. This
// will only get the most recent 10 runs ('per_page=10').
const total_runs = 10;

const ci_nightly_runs_url =
  "https://api.github.com/repos/" +
  "kata-containers/kata-containers/actions/workflows/" +
  `ci-nightly.yaml/runs?per_page=${total_runs}`;
  // NOTE: For checks run on main after push/merge,
  // do similar call with: payload-after-push.yaml.

// Github API URL for the main branch of the kata-containers repo.
// Used to get the list of required jobs.
const main_branch_url = 
  "https://api.github.com/repos/" +
  "kata-containers/kata-containers/branches/main";

// The number of jobs to fetch from the github API on each paged request.
const jobs_per_request = 100;

// Count of the number of fetches.
var fetch_count = 0;


// Perform a github API request for workflow runs.
async function fetch_workflow_runs() {
  const response = await fetch(ci_nightly_runs_url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `token ${TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    console.error(`Failed to fetch workflow runs:  ${response.status}: ` +
                                                   `${response.statusText}`);
  }

  const json = await response.json();
  fetch_count++;
  return await json;
}


// Perform a github API request for a list of "Required" jobs.
async function fetch_main_branch() {
  const response = await fetch(main_branch_url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `token ${TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    console.error(`Failed to fetch main branch:  ${response.status}: ` +
                                                   `${response.statusText}`);
  }

  const json = await response.json();
  fetch_count++;
  // const contexts = json?.protection?.required_status_checks?.contexts;
  return json;
}


// Extract list of required jobs. 
// (i.e. main branch details: protection: required_status_checks: contexts)
function get_required_jobs(main_branch) {
  return main_branch["protection"]["required_status_checks"]["contexts"];
}


// Get job data about a workflow run.
// Returns a map that has information about a run, e.g.
//   ID assigned by github
//   run number assigned by github
//   'jobs' array, which has some details about each job from that run.
function get_job_data(run) {
  // Perform the actual (paged) request
  async function fetch_jobs_by_page(which_page) {
    const jobs_url = `${run["jobs_url"]}?per_page=${jobs_per_request}&page=${which_page}`;
    const response = await fetch(jobs_url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `token ${TOKEN}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch jobs:  ${response.status}: ` +
                                                   `${response.statusText}`);
    }

    const json = await response.json();
    fetch_count++;
    return await json;
  }

  // Fetch the jobs for a run. Extract a few details from the response,
  // including the job name and whether it concluded successfully.

  function fetch_jobs(p) {
    return fetch_jobs_by_page(p)
    .then(function (jobs_request) {
      for (const job of jobs_request["jobs"]) {
        run_with_job_data["jobs"].push({
          name: job["name"],
          run_id: job["run_id"],
          html_url: job["html_url"],      // URL to a job in a specific run
          conclusion: job["conclusion"],
          reruns: job["run_attempt"] - 1,
        });
      }
      if (p * jobs_per_request >= jobs_request["total_count"]) {
        return run_with_job_data;
      }
      return fetch_jobs(p + 1);
    })    
    .catch(function (error) {
      console.error("Error fetching checks:", error);
      throw error;
    });
  }

  const run_with_job_data = {
    id: run["id"],
    run_number: run["run_number"],
    created_at: run["created_at"],
    previous_attempt_url: run["previous_attempt_url"],
    html_url: run["html_url"],           // URL to the overall run 
    conclusion: null,
    jobs: [],
  };
  if (run["status"] === "in_progress") {
    return new Promise((resolve) => {
      resolve(run_with_job_data);
    });
  }
  run_with_job_data["conclusion"] = run["conclusion"];
  return fetch_jobs(1);
}


// Using the previous URL, fetch the json to get the next URL.        
async function fetch_previous_attempt_url(prev_url) {   
  const response = await fetch(prev_url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `token ${TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    console.error(`Failed to fetch attempt url: ${response.statusText}`);
  }

  const json = await response.json();
  fetch_count++;
  return await json;
}


// Using the previous URL, look at the json with jobs.
// This will have the results for each job for a previous run. 
async function fetch_attempt_results(prev_url) {
  // Initialize an array to hold all jobs.
  const result = []; 

  // Fetch from pages until its processed all jobs.
  let p = 1; 
  while (true) {
    const jobs_url = `${prev_url}/jobs?per_page=500&page=${p}`;
    const response = await fetch(jobs_url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `token ${TOKEN}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch attempt results: ${response.statusText}`);
    }

    const json = await response.json();
    fetch_count++;
    result.push(...json.jobs);

    // Break we no have more pages to fetch.
    if (p * jobs_per_request >= json.total_count) {
      break;
    }
    p++; 
  }
  return { jobs: result };
}


// Get the attempt results for reruns for each job in each run.
// This constructs the field "attempt_results" and "rerun_urls" for each job.
// Results will have the result for each rerun. If no reruns, it's null.
async function get_atttempt_results(runs_with_job_data){
  for (const run of runs_with_job_data) {
    var prev_url = run["previous_attempt_url"];
    // If the run has a previous attempt (prev_url isn't null), process it. 
    while (prev_url !== null){
      // Get json with results for the run, which has job information.
      const json1 = await fetch_attempt_results(prev_url); 
      if(json1 === null){
        console.error("json1 empty");
      }  

      // For each job in the run, append the result.
      for (const job of run["jobs"]) {
        // Find the job in the json that matches the current job name.
        const match = json1.jobs.find((j) => j.name === job["name"]);

        // Initialize structures if not initialized before.
        job["attempt_results"] ??= [];
        job["rerun_urls"] ??= [];

        if (match) {
          // Add the URLs for all attempts.
          job["rerun_urls"].push(match.html_url);

          // Find the last step to see the final conclusion for the job.
          const completed = match.steps.find((step) => 
                                                step.name === "Complete job");
          // If there's a conclusion, add it to the job's attempt_results.
          if(completed){
            if (completed.conclusion != "success") {
              if (completed.conclusion == "skipped") {
                job["attempt_results"].push("Skip");
              } else {
                // Failed or cancelled.
                job["attempt_results"].push("Fail");
              }
            } else {
              job["attempt_results"].push("Pass");
            }
          } else {
            // Never completed.
            job["attempt_results"].push("Fail");
          }
        } else {
          // Not Ran.
          job["rerun_urls"].push(null);
          job["attempt_results"].push("Skip");
        }
      }
      // Get json with next attempt URL.
      const json2 = await fetch_previous_attempt_url(prev_url);
      if(json2 === null){
        console.error("json2 empty");
      }
      prev_url = json2.previous_attempt_url
    }
  }
  return runs_with_job_data;
}


// Add rerun results to fails/skips.
function count_stats(result, job_stat){
  if (result === "Skip") {
    job_stat["skips"] += 1;
  } else if (result === "Fail"){
    job_stat["fails"] += 1;
  }
  return job_stat;
}


// Calculate and return job stats across all runs
function compute_job_stats(runs_with_job_data, required_jobs) {
  const job_stats = {};
  for (const run of runs_with_job_data) {
    for (const job of run["jobs"]) {
      if (!(job["name"] in job_stats)) {
          job_stats[job["name"]] = {
            runs: 0,            // e.g. 10, if it ran 10 times
            fails: 0,           // e.g. 3, if it failed 3 out of 10 times
            skips: 0,           // e.g. 7, if it got skipped the other 7 times
            urls: [],           // ordered list of URLs to each run
            results: [],        // an array of strings, e.g. 'Pass', 'Fail', ...
            run_nums: [],       // ordered list of github-assigned run numbers
            reruns: [],         // the total number of times the test was rerun
            rerun_results: [],  // an array of strings, e.g. 'Pass', for reruns
            attempt_urls: [],   // ordered list of URLs to each job in a specific run
          };
      }
      var job_stat = job_stats[job["name"]];
      job_stat["runs"] += 1;
      job_stat["run_nums"].push(run["run_number"]);
      job_stat["required"] = required_jobs.includes(job["name"]);
      job_stat["reruns"].push(job["reruns"]);
      job_stat["rerun_results"].push(job["attempt_results"]);
      job_stat["urls"].push(run["html_url"]);

      // Always add the URL from the latest attempt.
      const jobURLs = [job["html_url"]];
      if(job["attempt_results"]){
        // Recompute the fails/skips for the job with the rerun results. 
        job["attempt_results"].forEach(result => {
          job_stat = count_stats(result, job_stat);
        });
        // Add the rerun URLs if they exist.
        jobURLs.push(...job["rerun_urls"]);
      }
      job_stat["attempt_urls"].push(jobURLs);

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
    }
  }
  return job_stats;
}


async function main() {
  // Fetch recent workflow runs via the github API
  const workflow_runs = await fetch_workflow_runs();

  // Fetch required jobs from main branch
  const main_branch = await fetch_main_branch();
  const required_jobs = get_required_jobs(main_branch);

  // Fetch job data for each of the runs.
  // Store all of this in an array of maps, runs_with_job_data.
  const promises_buf = [];
  for (const run of workflow_runs["workflow_runs"]) {
    promises_buf.push(get_job_data(run));
  }
  var runs_with_job_data = await Promise.all(promises_buf);
  
  // Get the attempt_results for each job.
  runs_with_job_data = await get_atttempt_results(runs_with_job_data)

  // Transform the raw details of each run and its jobs' results into a
  // an array of just the jobs and their overall results (e.g. pass or fail,
  // and the URLs associated with them).
  const job_stats = compute_job_stats(runs_with_job_data, required_jobs);

  // Write the job_stats to console as a JSON object
  console.log(JSON.stringify(job_stats));

  // Print total number of jobs
  // console.log(`\n\nTotal job count: ${Object.keys(job_stats).length}\n\n`);
}


main();
