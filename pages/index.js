import { useEffect, useState } from "react";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
// import { fetchCIData } from "../scripts/fetch-ci-nightly-data";
import data from "../data/job_stats.json";
import Image from 'next/image';
import getConfig from 'next/config';

const { publicRuntimeConfig } = getConfig();
const basePath = publicRuntimeConfig.basePath;
// const basePath = "";

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [expandedRows, setExpandedRows] = useState([]);
  const [requiredFilter, setRequiredFilter] = useState(false);

  const icons = [
    "sunny.svg",
    "partially-sunny.svg",
    "cloudy.svg",
    "rainy.svg",
    "stormy.svg",
  ];

  // Fetch job data once
  useEffect(() => {
    // const data = await fetchCIData();

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

  const filteredRows = requiredFilter ? jobs.filter((job) => job.required) : jobs;

  const handleRequiredFilterChange = (checked) => {
    setRequiredFilter(checked);
  };

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
  const nameStyle = { cursor: 'pointer' };
  const nameTemplate = (rowData) => (
    <span onClick={() => toggleRow(rowData)} style={nameStyle}>
      {rowData.name}
    </span>
  );

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
          src={`${basePath}/${icon}`}
          alt="weather"
          width={32}
          height={32} 
          // priority
        />
      </div>
    );
  };

  const rowExpansionTemplate = (data) => {
    console.log(data);
  
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
        {/* Display Runs */}
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
        
        {/* Display Unique PRs in a Row */}
        <div style={{ marginTop: '1rem' }}>
          {prs.length > 0 ? (
            prs.map((pr) => {
              const emoji = pr.res === "Pass" ? "✅" : pr.res === "Fail" ? "❌" : "⚠️";
              return (
                <span key={`${job.name}-prs-${pr.num}`}>
                  <a href={pr.url} target="_blank" rel="noopener noreferrer">
                    {emoji} PR #{pr.num}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                  </a>
                </span>
              )
            })
          ) : (
            <div>No PRs associated with this job</div>
          )}
        </div>
      </div>
    );
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
      Required&nbsp;&nbsp;
      <input
        type="checkbox"
        checked={requiredFilter === true}
        onChange={(e) => handleRequiredFilterChange(e.target.checked)}
        style={{height: '1rem', width: '1rem'}}
      />
    </div>
  );

  return (
    <div className="text-center">
      <h1>
        <a
          href="https://github.com/kata-containers/kata-containers/actions/workflows/ci-nightly.yaml"
          target="_blank"
          rel="noopener noreferrer"
          className="title-link"
        >
          Kata CI Dashboard
        </a>
      </h1>
      <DataTable
        value={filteredRows}
        expandedRows={expandedRows}
        stripedRows
        rowExpansionTemplate={rowExpansionTemplate}
        onRowToggle={(e) => setExpandedRows(e.data)}
        loading={loading}
      >
        <Column expander style={{ width: "5rem" }} />
        <Column field="name" header="Name" body={nameTemplate} filter sortable></Column>
        <Column field="runs" header="Runs" sortable></Column>
        <Column field="fails" header="Fails" sortable></Column>
        <Column field="skips" header="Skips" sortable></Column>
        <Column field="required" 
          header={requiredHeader} 
          body={requiredTemplate}
          style={{ minWidth: '125px' }}
          headerStyle={{ minWidth: '125px' }}
        ></Column>
        <Column
          field="weather"
          header="Weather"
          body={weatherTemplate}
          sortable
        ></Column>
      </DataTable>
    </div>
  );
}
