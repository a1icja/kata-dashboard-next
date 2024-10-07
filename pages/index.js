import { useEffect, useState } from "react";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import Image from 'next/image';
import getConfig from 'next/config';
import data from "../data/job_stats.json";

const { publicRuntimeConfig } = getConfig();
const basePath = publicRuntimeConfig.basePath;
// const basePath = "";

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
        try {
          const jobData = Object.keys(data).map((key) => {
            const job = data[key];
            return { name: key, ...job };
          });
          setJobs(jobData);
        } catch (error) {
          console.error("Error fetching data:", error);
        } finally {
          setLoading(false); // Set loading false whether success or failure
        }
      };
  
      fetchData();
  }, []);

  useEffect(() => {
    console.log("triggered");
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
    runs: display === "pr" ? job.pr_runs : job.runs,
    fails: display === "pr" ? job.pr_fails : job.fails,
    skips: display === "pr" ? job.pr_skips : job.skips,
    required: job.required,
    weather: "Sunny",
    }));
    
    setRows(filteredRows);  
    setLoading(false);
  }, [jobs, requiredFilter, display]);


  const handleRequiredFilterChange = (checked) => {
    setRequiredFilter(checked);
  };

  const handleDisplayChange = (value) => {
    setDisplay(value);
    console.log(value);
  }

  // Function to toggle row expansion
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

  const getWeatherIcon = (stat) => {
    const fail_rate = (stat["fails"] + stat["skips"]) / stat["runs"];
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
          src={`${basePath}${icon}`}
          alt="weather"
          width={32}
          height={32} 
          // priority
        />
      </div>
    );
  };

  const rowExpansionTemplate = (data) => {
    // console.log(data);

    const job = jobs.find((job) => job.name === data.name);

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

    if (display == "pr")
    {
      return (
        <div key={`${job.name}-runs`} className="p-3 ml-8"> 
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
      );
    }
    else
    {
      return (
        <div key={`${job.name}-runs`} className="p-3 ml-8">
          {runs.map((run) => {
            const emoji =
              run.result === "Pass" ? "✅" : run.result === "Fail" ? "❌" : "⚠️";
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
      );
    }
  };

  const requiredTemplate = (data) => {
    return (
      <span style={{ color: data.required ? 'green' : 'red' }}>
        {data.required ? 'True' : 'False'}
      </span>
    );
  };

  const requiredHeader = (
    <div>
      <input
        type="checkbox"
        checked={requiredFilter === true}
        onChange={(e) => handleRequiredFilterChange(e.target.checked)}
        style={{height: '1rem', width: '1rem'}}
      />
    </div>
  );

  return (
    <div>
      <h1 className="text-center mt-5 mb-3 text-5xl underline hover:text-sky-700">
        <a
          href="https://github.com/kata-containers/kata-containers/actions/workflows/ci-nightly.yaml"
          target="_blank"
          rel="noopener noreferrer"
          className="title-link"
        >
          Kata CI Dashboard
        </a>
      </h1>
      <nav className="w-48 h-screen bg-gray-400 border-10 border-slate-500 fixed top-0 left-0 pt-5">
        <h2 className="text-center underline">Display View</h2>

        <input className="ml-4 mt-2" type="radio" name="display" value="nightly" 
        checked={display === 'nightly'} 
        onChange={(e) => handleDisplayChange(e.target.value)}></input>
        <label>Nightly Runs</label>
        <br></br>

        <input className="ml-4" type="radio" name="display" value="pr"
        checked={display === 'pr'} 
        onChange={(e) => handleDisplayChange(e.target.value)}></input>
        <label>PRs</label> 

      </nav>
      <div className="ml-48">

      <DataTable
        value={rows}
        expandedRows={expandedRows}
        stripedRows
        rowExpansionTemplate={rowExpansionTemplate}
        onRowToggle={(e) => setExpandedRows(e.data)}
        loading={loading}
      >
        <Column expander style={{ width: "5rem" }} />
        <Column field="name" header="Name" body={nameTemplate} 
          filter 
          filterHeader="Filter by Name" 
          filterPlaceholder="Search..." 
          sortable></Column>
        <Column header={requiredHeader}></Column>
        <Column field="required" 
          header="Required"
          body={requiredTemplate}
          sortable></Column>          
        <Column field="runs" header="Runs" sortable></Column>
        <Column field="fails" header="Fails" sortable></Column>
        <Column field="skips" header="Skips" sortable></Column>
        <Column
          field="weather"
          header="Weather"
          body={weatherTemplate}
          sortable
        ></Column>
      </DataTable>
      </div>
    </div>
  );
}
