import { useEffect, useState } from "react";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import Image from 'next/image';

const basePath = "";

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [rows, setRows] = useState([]);
  const [expandedRows, setExpandedRows] = useState([]);
  const [requiredFilter, setRequiredFilter] = useState(false);

  const icons = [
    "sunny.svg",
    "partially-sunny.svg",
    "cloudy.svg",
    "rainy.svg",
    "stormy.svg",
  ];

  useEffect(() => {
    const fetchData = async () => {
      const response = await fetch(
        "https://raw.githubusercontent.com/a1icja/kata-dashboard-next/refs/heads/latest-dashboard-data/data/job_stats.json"
      );
      const data = await response.json();

      const jobData = Object.keys(data).map((key) => {
        const job = data[key];
        return {
          name: key,
          ...job,
        };
      });

      setJobs(jobData);
    };

    fetchData();
  }, []);

  useEffect(() => {
    setLoading(true)

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
      weather: "Sunny",
    }));
    setRows(filteredRows);
    setLoading(false);
  }, [jobs, requiredFilter]);


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
    console.log(data);

    const job = jobs.find((job) => job.name === data.name);

    const runs = [];
    for (let i = 0; i < job.runs; i++) {
      runs.push({
        run_num: job.run_nums[i],
        result: job.results[i],
        url: job.urls[i],
      });
    }

    return (
      <div key={`${job.name}-runs`} className="p-3">
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
  );
}
