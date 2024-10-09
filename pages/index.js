import { useEffect, useState } from "react";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import Image from 'next/image';
// import localData from "../data/job_stats.json";
import getConfig from 'next/config';

// const { publicRuntimeConfig } = getConfig();
// const basePath = publicRuntimeConfig.basePath || "";
const basePath = "";

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [rows, setRows] = useState([]);
  const [expandedRows, setExpandedRows] = useState([]);
  const [requiredFilter, setRequiredFilter] = useState(false);
  const [display, setDisplay] = useState('nightly'); 

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
      console.log("test")
      const response = await fetch(
        "https://raw.githubusercontent.com/a1icja/kata-dashboard-next/refs/heads/latest-dashboard-data/data/job_stats.json"
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

  useEffect(() => {
    setLoading(true);

    // Filter based on required tag.
    let filteredJobs = jobs;
    if (requiredFilter) {
      filteredJobs = jobs.filter(job => job.required);
    }

    // Filter based on name from URL
    const url = new URLSearchParams(window.location.search);
    const searchParam = url.get("search");
    if (searchParam) {
      filteredJobs = filteredJobs.filter(job => 
          job.name.toLowerCase().includes(searchParam.toLowerCase())
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
    setExpandedRows([])
  }, [display]); 

  const handleRequiredFilterChange = (checked) => {
    setRequiredFilter(checked);
  };

  const getWeatherIcon = (stat) => {
    let fail_rate = 0;
    if (display === 'nightly') {
      fail_rate = (stat["fails"] + stat["skips"]) / stat["runs"];
    } else {
      fail_rate = (stat["pr_fails"] + stat["pr_skips"]) / stat["pr_runs"];
    }
    var idx = Math.floor((fail_rate * 10) / 2); // e.g. failing 3/9 runs is .33, or idx=1
    if (idx == icons.length) {
      // edge case: if 100% failures, then we go past the end of icons[]
      // back the idx down by 1
      console.assert(fail_rate == 1.0);
      idx -= 1;
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
        onChange={(e) => handleRequiredFilterChange(e.target.checked)}
        style={{height: '1rem', width: '1rem'}}
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
      <span
        onClick={() => toggleRow(rowData)}
        style={{ cursor: 'pointer' }}
      >
        {rowData.name}
      </span>
    );
  };

  const rowExpansionTemplate = (data) => {
    // console.log(data);

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
      <div key={`${job.name}-runs`} className="p-3" style={{ marginLeft: '4.5rem', marginTop: '-2.0rem' }}>
        {display === 'nightly' && (
          <div>
            {runs.map((run) => {
              const emoji = run.result === "Pass" ? "✅" : run.result === "Fail" ? "❌" : "⚠️";
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
        {display === 'prchecks' && (
          <div>
            {prs.length > 0 ? (
              prs.map((pr) => {
                const emoji = pr.res === "Pass" ? "✅" : pr.res === "Fail" ? "❌" : "⚠️";
                return (
                  <span key={`${job.name}-prs-${pr.num}`}>
                    <a href={pr.url}>
                      {emoji} PR #{pr.num}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                    </a>
                  </span>
                )
              })
            ) : (
              <div>No PRs associated with this job</div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderTable = () => (
    <DataTable
      value={rows}
      expandedRows={expandedRows}
      stripedRows
      rowExpansionTemplate={rowExpansionTemplate}
      onRowToggle={(e) => setExpandedRows(e.data)}
      loading={loading}
    >
      <Column expander style={{ width: "5rem" }} />
      <Column field="name" header="Name" body={nameTemplate} filter sortable 
      filterHeader="Filter by Name" 
      filterPlaceholder="Search..."/>
      <Column header={requiredCheckbox}></Column>
      <Column field="required" header="Required" sortable/>
      <Column field={display === 'nightly' ? 'runs' : 'pr_runs'} header="Runs" sortable />
      <Column field={display === 'nightly' ? 'fails' : 'pr_fails'} header="Fails" sortable />
      <Column field={display === 'nightly' ? 'skips' : 'pr_skips'} header="Skips" sortable />
      <Column field="weather" header="Weather" body={weatherTemplate} sortable />
    </DataTable>
  );

  return (
    <div className="text-center">
      <h1 className="text-4xl mt-4 mb-0 underline text-inherit hover:text-blue-500">
        <a
          href="https://github.com/kata-containers/kata-containers/actions/workflows/ci-nightly.yaml"
          target="_blank"
          rel="noopener noreferrer"
        >
          Kata CI Dashboard
        </a>
      </h1>

      <div className="flex justify-between items-center mt-4 ml-4">
        <div className="tabs">
          <button
            className={`tab px-4 py-2 border-b-2 ${display === 'nightly' ? 'border-blue-500 bg-white' : 'border-gray-300'} focus:outline-none`}
            onClick={() => setDisplay('nightly')}
          >
            Nightly Jobs
          </button>
          <button
            className={`tab px-4 py-2 border-b-2 ${display === 'prchecks' ? 'border-blue-500 bg-white' : 'border-gray-300'} focus:outline-none`}
            onClick={() => setDisplay('prchecks')}
          >
            PR Checks
          </button>
        </div>
      </div>



      <main className="m-0 h-full p-4 overflow-x-hidden overflow-y-auto bg-surface-ground font-normal text-text-color antialiased select-text">
        <div>
          {renderTable()}
        </div>
        <div className="mt-4 text-lg">
          Total Rows: {rows.length}
        </div>
      </main>
    </div>
  );
}
