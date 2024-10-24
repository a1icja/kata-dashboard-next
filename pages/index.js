import { useEffect, useState } from "react";
import Image from "next/image";

import { DataTable } from "primereact/datatable";
import { Column }    from "primereact/column";
import { Tooltip }   from 'primereact/tooltip';

import NightlyData  from "../data/job_stats.json";
import PRData       from "../data/check_stats.json";
import { basePath } from "../next.config.js";
import BarChart from './BarChart'; 


export default function Home() {
  const [loading,        setLoading]        = useState(true);
  const [jobs,           setJobs]           = useState([]);
  const [checks,         setChecks]         = useState([]);
  const [rows,           setRows]           = useState([]);
  const [expandedRows,   setExpandedRows]   = useState([]);
  const [requiredFilter, setRequiredFilter] = useState(false);
  const [keepSearch,     setKeepSearch]     = useState(false);
  const [display,        setDisplay]        = useState("nightly");

  const icons = [
    "sunny.svg",
    "partially-sunny.svg",
    "cloudy.svg",
    "rainy.svg",
    "stormy.svg",
  ];

  // Fetch data (either local or external)
  useEffect(() => {
    const fetchData = async () => {
      let nightlyData = process.env.NODE_ENV === "development" ? NightlyData : await fetch(
        "https://raw.githubusercontent.com/a1icja/kata-dashboard-next/refs/heads/latest-dashboard-data/data/job_stats.json"
      ).then((res) => res.json());
      let prData = process.env.NODE_ENV === "development" ? PRData : {};

      const mapData = (data) => Object.keys(data).map((key) => ({ name: key, ...data[key] }));
      setJobs(mapData(nightlyData));
      setChecks(mapData(prData));
      setLoading(false);
    };
    fetchData();
  }, []);

  // Get bar chart statistics. 
  const getTotalStats = (data) => {
    return data.reduce((acc, job) => {
      acc.runs += job.runs;
      acc.fails += job.fails;
      acc.skips += job.skips;
      return acc;
    }, { runs: 0, fails: 0, skips: 0 });
  };
  const totalStats = display === "nightly" ? getTotalStats(jobs) : getTotalStats(checks);

  const applyFilter = (filteredJobs, parts) => {
    for (let i = 2; i < parts.length; i++) {
      const [matchMode, value] = parts[i].split("=")[1].split("&");
      const decoded = decodeURIComponent(value).replace("/", "").trim().toLowerCase();
      const filterMap = {
        contains   : (name) => name.includes(decoded),
        notContains: (name) => !name.includes(decoded),
        equals     : (name) => name === decoded,
        notEquals  : (name) => name !== decoded,
        startsWith : (name) => name.startsWith(decoded),
        endsWith   : (name) => name.endsWith(decoded),
      };
      filteredJobs = filteredJobs.filter((job) => filterMap[matchMode](job.name.toLowerCase()));
    }
    return filteredJobs;
  };

  useEffect(() => {
    setLoading(true);
    let filteredJobs = display === "nightly" ? jobs : checks;
    if (requiredFilter) filteredJobs = filteredJobs.filter((job) => job.required);

    const urlParts = window.location.href.split("?");
    if (urlParts[1]) filteredJobs = applyFilter(filteredJobs, urlParts);

    setRows(
      filteredJobs.map((job, idx) => ({
        name    : job.name,
        runs    : job.runs,
        fails   : job.fails,
        skips   : job.skips,
        required: job.required,
        weather : getWeatherIndex(job),
        reruns  : job.reruns,
        total_reruns  : job.reruns.reduce((total, r) => total + r, 0),
      }))
    );
    setLoading(false);
  }, [jobs, checks, requiredFilter, display]);

  // Close all rows on view switch. 
  useEffect(() => {
    setExpandedRows([])
  }, [display]); 

  const getWeatherIndex = (stat) => {
    const failRate = (stat.fails + stat.skips) / (stat.runs + stat.reruns.reduce((total, r) => total + r, 0));
    let idx = Math.floor((failRate * 10) / 2);
    if (idx === icons.length) idx -= 1;
    return isNaN(idx) ? 4 : idx;
  };

  const weatherTemplate = (data) => (
    <div>
      <Image src={`${basePath}/${icons[getWeatherIndex(data)]}`} alt="weather" width={32} height={32} />
    </div>
  );

  const toggleRow = (rowData) => {
    setExpandedRows((prev) =>
      prev.includes(rowData) ? prev.filter((r) => r !== rowData) : [...prev, rowData]
    );
  };

  const nameTemplate = (rowData) => (
    <span onClick={() => toggleRow(rowData)} className="cursor-pointer">
      {rowData.name}
    </span>
  );

  const buttonClass = (active) => `tab px-4 py-2 border-2 
    ${active ? "border-blue-500 bg-blue-500 text-white" : "border-gray-300 bg-white"}`;

  const tabClass = (active) => `tab px-4 py-2 border-b-2 focus:outline-none
    ${active ? "border-blue-500 bg-gray-300" : "border-gray-300 bg-white"}`;

  const rowExpansionTemplate = (data) => {
    const job = (display === "nightly" ? jobs : checks).find((job) => job.name === data.name);
  
    if (!job) return <div className="p-3 bg-gray-100">No data available for this job.</div>;
  
    const getRunStatusIcon = (runs) => {
      if (Array.isArray(runs)) {
        const allPass = runs.every(run => run === "Pass");
        const allFail = runs.every(run => run === "Fail");

        if (allPass) {return "✅";}
        if (allFail) {return "❌";}
      } else if (runs === "Pass") {
        return "✅";
      } else if (runs === "Fail") {
        return "❌";
      }
      return "⚠️";  // return a warning if a mix of results
    };

    const runEntries = job.run_nums.map((run_num, idx) => ({
      run_num,
      result: job.results[idx],
      reruns: job.reruns[idx],
      rerun_result: job.rerun_results[idx],
      url: job.urls[idx],
    }));    

    return (
      <div key={`${job.name}-runs`} className="p-3 bg-gray-100">
        <div className="flex flex-wrap gap-4">
          {runEntries.map(({run_num, result, reruns, rerun_result, url }, idx) => {
            const runStatuses = rerun_result
              ? rerun_result.map((result) => `${result === 'Pass' ? '✅ Success' : result === 'Fail' ? '❌ Fail' : '⚠️ Warning'}`)
              .join('\n')
              : '';
            
            const sanitizedJobName = job.name.replace(/[^a-zA-Z0-9-_]/g, ''); // IDs can't have a '/'...
            const badgeId = `badge-tooltip-${sanitizedJobName}-${run_num}`;
            return (
              <div key={run_num} className="flex">
                <div key={idx} className="flex items-center">
                  <a href={url} target="_blank">
                    {reruns > 1 
                      ? getRunStatusIcon(rerun_result) 
                      : getRunStatusIcon(result)} {run_num}
                  </a>
                </div>
                {reruns > 1 &&(
                  <span className="p-overlay-badge">
                    <sup  id={badgeId}
                          className="text-xs font-bold align-super ml-1">
                    {reruns}
                    </sup>
                    <Tooltip target={`#${badgeId}`} content={runStatuses} position="top" tooltipOptions={{ autoHide: 'false' }}/>
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div>
          <br/>Maintainer: <a 
            href="https://github.com/sprt"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 underline">
              Aurelien Bombo
          </a>
        </div>
      </div>
    );
  };

  const handleFilterApply = (e) => {
    if (e.constraints.constraints[0].value) {
      let path = `/?${encodeURIComponent(e.constraints.operator)}`; 

      if (keepSearch) {
        const url = window.location.href;
        const parts = url.split('?');
        if (parts.length > 2) {
          for (let i = 2; i < parts.length; i++) {
            path += `/?${parts[i].replace('/', '').trim()}`;
          }
        }
      }

      e.constraints.constraints.forEach((c) => {
        path += `/?search=${encodeURIComponent(c.matchMode)}&${encodeURIComponent(c.value.trim())}`;
      });

      window.location.href = `${basePath}${path}`;
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
      <Column expander/>
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
      <Column field = {"required"} header = "Required" sortable />
      <Column field = {"runs"}   
              header = "Runs"
              className="whitespace-nowrap px-2"
              // body={(data) => (
              //   <span className="whitespace-nowrap">
              //     <span className="font-bold">{data.runs + data.total_reruns}</span> 
              //     {data.total_reruns > 0 ? ` (${data.total_reruns} reruns)` : ''}
              //   </span>
              // )}            
              sortable />
      <Column field = {"total_reruns"}  header = "Reruns"    sortable />
      <Column field = {"fails"}  header = "Fails"    sortable />
      <Column field = {"skips"}  header = "Skips"    sortable />
      <Column field = "weather"  header = "Weather"  body = {weatherTemplate} sortable />
    </DataTable>
  );

  return (
    <>
      <title>Kata CI Dashboard</title>
      <div className="text-center text-xs md:text-base">
        <h1 className={"text-4xl mt-4 mb-6 underline text-inherit hover:text-blue-500"}>
          <a
            href={display === 'nightly' 
              ? "https://github.com/kata-containers/kata-containers/actions/workflows/ci-nightly.yaml"
              : "https://github.com/kata-containers/kata-containers/actions/workflows/ci-on-push.yaml"}
            target="_blank"
            rel="noopener noreferrer"
          >
            Kata CI Dashboard
          </a>
        </h1>

        
        <div className="xl:absolute l:flex mx-auto top-5 right-5 w-96 h-24">
              <BarChart data={totalStats} />
        </div>

        <div className="flex justify-between items-center mt-2 ml-4">
          <div className="tabs flex space-x-2">
            <button className={tabClass(display === "nightly")}
              onClick={() => setDisplay("nightly")}
            >
              Nightly Jobs
            </button>
            <button className={tabClass(display === "prchecks")}
              onClick={() => setDisplay("prchecks")}
            >
              PR Checks
            </button>
          </div>

          <div className={"m-0 h-full space-x-2 p-4 overflow-x-hidden overflow-y-auto \
                          bg-surface-ground font-normal text-text-color antialiased select-text"}>
            <button className={buttonClass(keepSearch)} 
              onClick={() => setKeepSearch(!keepSearch)}>
              Keep URL Search Terms
            </button>

            <button className={buttonClass(requiredFilter)} 
              onClick={() => setRequiredFilter(!requiredFilter)}>
              Required Jobs Only
            </button>
          </div>

        </div>

        <main className={"m-0 h-full px-4 overflow-x-hidden overflow-y-auto bg-surface-ground \
                          font-normal text-text-color antialiased select-text"}>
          <div>{renderTable()}</div>
          <div className="mt-4 text-lg">Total Rows: {rows.length}</div>
        </main>
      </div>
    </>
  );
}
