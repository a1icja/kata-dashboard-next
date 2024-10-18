import { useEffect, useState } from "react";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import Image from "next/image";
// import localData from "../data/job_stats.json";
import { basePath } from "../next.config.js";

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [rows, setRows] = useState([]);
  const [expandedRows, setExpandedRows] = useState([]);
  const [requiredFilter, setRequiredFilter] = useState(false);
  const [keepSearch, setKeepSearch] = useState(false);
  const [display, setDisplay] = useState("nightly");

  const icons = [
    "sunny.svg",
    "partially-sunny.svg",
    "cloudy.svg",
    "rainy.svg",
    "stormy.svg",
  ];

  useEffect(() => {
    const fetchData = async () => {
      let data = {};
      // if (process.env.NODE_ENV === "development") {
      //   data = localData;
      // } else {
      const response = await fetch(
        "https://raw.githubusercontent.com/a1icja/kata-dashboard-next" +
        "/refs/heads/latest-dashboard-data/data/job_stats.json"
      );
      data = await response.json();
      // }

      try {
        const jobData = Object.keys(data).map((key) => {
          const job = data[key];
          return { name: key, ...job };
        });
        setJobs(jobData);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const testRules  = (name, parts) => {
    for(let i=2; i<parts.length; i++){
      // Rule = matchMode&value/
      const rule= parts[i].split('=')[1];
  
      const matchMode = rule.split('&')[0];
      const value = rule.split('&')[1];

      // Remove trailing '/' from search and trim.
      const decoded = (
        decodeURIComponent(value)
        .replace('/', '')
      ).trim().toLowerCase();

      if (matchMode === 'contains'){
        if(name.includes(decoded)){
          return true;
        }
      }else if(matchMode === 'notContains'){
        if(!name.includes(decoded)){
          return true;
        }
      }else if(matchMode === 'equals'){
        if(name === decoded){
          return true;
        }
      }else if(matchMode === 'notEquals'){
        if(name !== decoded){
          return true;
        }
      }else if(matchMode === 'startsWith'){
        if(name.startsWith(decoded)){
          return true;
        }
      }else if(matchMode === 'endsWith'){
        if(name.endsWith(decoded)){
          return true;
        }
      }
    }
    // Only return false if it satifies none of the rules. 
    return false;
  }

  useEffect(() => {
    setLoading(true);

    // Filter based on required tag.
    let filteredJobs = jobs;
    if (requiredFilter) {
      filteredJobs = jobs.filter((job) => job.required);
    }

    // Get the current URL
    const url = window.location.href;

    // Pattern: /?operator/?search=matchMode&value/?search=matchMode&value
    // Thus, split on ? to isolate each area
    const parts = url.split('?');

    // For the operator, and = match all / or = match any
    if(parts[1] === "and/"){
      // Iterate through ?search=matchMode&value/
      for(let i=2; i<parts.length; i++){
        // Rule = matchMode&value/
        const rule= parts[i].split('=')[1];
        
        const matchMode = rule.split('&')[0];
        const value = rule.split('&')[1];

        // Remove trailing '/' from search abd trim.
        const decoded = (
          decodeURIComponent(value)
          .replace('/', '')
        ).trim().toLowerCase();

        // Not case sensitive now, remove toLowerCase to make it so. 
        if (matchMode === 'contains'){
          filteredJobs = filteredJobs.filter((job) =>
            job.name.toLowerCase().includes(decoded)
        );
        }else if(matchMode === 'notContains'){
          filteredJobs = filteredJobs.filter((job) =>
            !job.name.toLowerCase().includes(decoded)
          );
        }else if(matchMode === 'equals'){
          filteredJobs = filteredJobs.filter((job) =>
            job.name.toLowerCase() === decoded
          );
        }else if(matchMode === 'notEquals'){
          filteredJobs = filteredJobs.filter((job) =>
            job.name.toLowerCase() !== decoded
          );
        }else if(matchMode === 'startsWith'){
          filteredJobs = filteredJobs.filter((job) =>
            job.name.toLowerCase().startsWith(decoded)
          );
        }else if(matchMode === 'endsWith'){
          filteredJobs = filteredJobs.filter((job) =>
            job.name.toLowerCase().endsWith(decoded)
          );
        }
      }
    } else if(parts[1] === "or/"){
      filteredJobs = filteredJobs.filter((job) =>
        testRules(job.name.toLowerCase(), parts)
      );
    }
    
    // Create rows to set into table.
    const filteredRows = filteredJobs.map((job) => ({
      name: job.name,
      runs: job.runs,
      fails: job.fails,
      skips: job.skips,
      required: job.required,
      pr_runs: job.pr_runs,
      pr_fails: job.pr_fails,
      pr_skips: job.pr_skips,
      weather: "Sunny",
    }));
    setRows(filteredRows);
    setLoading(false);
  }, [jobs, requiredFilter, display]);

  // Collapse rows if display changes
  useEffect(() => {
    setExpandedRows([]);
  }, [display]);

  const getWeatherIcon = (stat) => {
    let fail_rate = 0;
    if (display === "nightly") {
      fail_rate = (stat["fails"] + stat["skips"]) / stat["runs"];
    } else {
      fail_rate = (stat["pr_fails"] + stat["pr_skips"]) / stat["pr_runs"];
    }
    // e.g. failing 3/9 runs is .33, or idx=1
    var idx = Math.floor((fail_rate * 10) / 2); 
    if (idx == icons.length) {
      // edge case: if 100% failures, then we go past the end of icons[]
      // back the idx down by 1
      console.assert(fail_rate == 1.0);
      idx -= 1;
    }
  
    // This error checks if there are zero runs.
    // Currently, will display stormy weather.
    if(isNaN(idx)){
      idx = 4;
    }

    return icons[idx];
  };

  const weatherTemplate = (data) => {
    const icon = getWeatherIcon(data);
    return (
      <div>
        <Image
          src={`${basePath}/${icon}`}
          alt="weather"
          width={32}
          height={32}
          // priority
        />
      </div>
    );
  };

  const requiredCheckbox = (
    <div>
      <input
        type="checkbox"
        checked={requiredFilter === true}
        onChange={(e) => setRequiredFilter(e.target.checked)}
        style={{ height: "1rem", width: "1rem" }}
      />
    </div>
  );

  const toggleRow = (rowData) => {
    const isRowExpanded = expandedRows.includes(rowData);

    let updatedExpandedRows;
    if (isRowExpanded) {
      updatedExpandedRows = expandedRows.filter((r) => r !== rowData);
    } else {
      updatedExpandedRows = [...expandedRows, rowData];
    }

    setExpandedRows(updatedExpandedRows);
  };

  // Template for rendering the Name column as a clickable item
  const nameTemplate = (rowData) => {
    return (
      <span onClick={() => toggleRow(rowData)} style={{ cursor: "pointer" }}>
        {rowData.name}
      </span>
    );
  };

  const rowExpansionTemplate = (data) => {
    const job = jobs.find((job) => job.name === data.name);

    // Prepare run data
    const runs = [];
    for (let i = 0; i < job.runs; i++) {
      runs.push({
        run_num: job.run_nums[i],
        result: job.results[i],
        url: job.urls[i],
      });
    }

    const prs = [];
    job.pr_nums.forEach((pr_num, index) => {
      const pr_url = job.pr_urls[index];
      const pr_res = job.pr_results[index];

      if (!prs.some((pr) => pr.num === pr_num && pr.url === pr_url)) {
        prs.push({
          num: pr_num,
          url: pr_url,
          res: pr_res,
        });
      }
    });

    return (
      <div
        key={`${job.name}-runs`}
        className="p-3"
        style={{ marginLeft: "4.5rem", marginTop: "-2.0rem" }}
      >
        {display === "nightly" && (
          <div>
            {runs.map((run) => {
              const emoji =
                run.result === "Pass"
                  ? "✅"
                  : run.result === "Fail"
                  ? "❌"
                  : "⚠️";
              return (
                <span key={`${job.name}-runs-${run.run_num}`}>
                  <a href={run.url}>
                    {emoji} {run.run_num}
                  </a>
                  &nbsp;&nbsp;&nbsp;&nbsp;
                </span>
              );
            })}
          </div>
        )}
        {display === "prchecks" && (
          <div>
            {prs.length > 0 ? (
              prs.map((pr) => {
                const emoji =
                  pr.res === "Pass" ? "✅" : pr.res === "Fail" ? "❌" : "⚠️";
                return (
                  <span key={`${job.name}-prs-${pr.num}`}>
                    <a href={pr.url}>
                      {emoji} PR #{pr.num}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                    </a>
                  </span>
                );
              })
            ) : (
              <div>No PRs associated with this job</div>
            )}
          </div>
        )}
      </div>
    );
  };

  const handleFilterApply = (e) => {
    // If the first value isn't null, we must apply the search.
    if (e.constraints.constraints[0].value) {
      // Start the path with /?operator   (and/or)
      
      // Will always use the new operator.
      let path = `/?${encodeURIComponent(e.constraints.operator)}`; 

      // If checked, it will keep the search rules from the URL.
      if(keepSearch){
        const url = window.location.href;
        const parts = url.split('?');
        if(parts.length > 2){
          for(let i=2; i<parts.length; i++){
            path += `/?${parts[i].replace('/', '').trim()}`
          }
        }
      }
      
      // Append each matchMode/value pair to the URL.
      for (const c of e.constraints.constraints){
        path += `/?search=${encodeURIComponent(c.matchMode)}&` + 
        `${encodeURIComponent(c.value.trim())}`;
      }

      // Update URL
      window.location.href = basePath + path;
    }
  };

  const renderTable = () => (
    <DataTable
      value={rows}
      expandedRows={expandedRows}
      stripedRows
      rowExpansionTemplate={rowExpansionTemplate}
      onRowToggle={(e) => setExpandedRows(e.data)}
      loading={loading}
      emptyMessage="No results found." 
    >
      <Column expander style={{ width: "5rem" }} />
      <Column
        field="name"
        header="Name"
        body={nameTemplate}
        filter
        sortable
        onFilterApplyClick={(e) => handleFilterApply(e)}
        maxConstraints={4}
        filterHeader="Filter by Name"
        filterPlaceholder="Search..."
      />
      <Column header={requiredCheckbox}></Column>
      <Column field="required" header="Required" sortable />
      <Column
        field={display === "nightly" ? "runs" : "pr_runs"}
        header="Runs"
        sortable
      />
      <Column
        field={display === "nightly" ? "fails" : "pr_fails"}
        header="Fails"
        sortable
      />
      <Column
        field={display === "nightly" ? "skips" : "pr_skips"}
        header="Skips"
        sortable
      />
      <Column
        field="weather"
        header="Weather"
        body={weatherTemplate}
        sortable
      />
    </DataTable>
  );

  return (
    <div className="text-center">
      <h1 className={"text-4xl mt-4 mb-0 underline text-inherit" +
                     "hover:text-blue-500"}>
        <a
          href={"https://github.com/kata-containers/kata-containers/" +
          "actions/workflows/ci-nightly.yaml"}
          target="_blank"
          rel="noopener noreferrer"
        >
          Kata CI Dashboard
        </a>
      </h1>

      <div className="flex justify-center mt-4 ml-4">
        <div className="tabs mr-10">
          <button
            className={`tab px-4 py-2 border-b-2 ${
              display === "nightly"
                ? "border-blue-500 bg-gray-300"
                : "border-gray-300 bg-white"
            } focus:outline-none`}
            onClick={() => setDisplay("nightly")}
          >
            Nightly Jobs
          </button>
          <button
            className={`tab px-4 py-2 border-b-2 ${
              display === "prchecks"
                ? "border-blue-500 bg-gray-300"
                : "border-gray-300 bg-white"
            } focus:outline-none`}
            onClick={() => setDisplay("prchecks")}
          >
            PR Checks
          </button> 
        </div>

        <button
            className={`tab px-4 py-2 border-b-2 ${
              keepSearch ? "border-blue-500 bg-gray-300"
                : "border-gray-300 bg-white"
            } focus:outline-none`}
            onClick={() => setKeepSearch(!keepSearch)}
          >
            Keep URL Search Terms
          </button>
      </div>

      <main className={"m-0 h-full p-4 overflow-x-hidden overflow-y-auto" +
                       "bg-surface-ground font-normal text-text-color" +
                       "antialiased select-text"}>
        <div>{renderTable()}</div>
        <div className="mt-4 text-lg">Total Rows: {rows.length}</div>
      </main>
    </div>
  );
}
