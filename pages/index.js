import React, { useEffect, useState, useRef } from "react";
import Image from "next/image";

import { DataTable } from "primereact/datatable";
import { Column }    from "primereact/column";
import { OverlayPanel } from 'primereact/overlaypanel';

// import NightlyData  from "../data/job_stats.json";
// import PRData       from "../data/check_stats.json";
import MaintainerMapping from "../maintainers.yml";
import { basePath } from "../next.config.js";
import BarChart from '../components/BarChart'; 


export default function Home() {
  const [loading,        setLoading]        = useState(true);
  const [jobs,           setJobs]           = useState([]);
  const [checks,         setChecks]         = useState([]);
  const [rowsSingle,     setRowsSingle]     = useState([]);
  const [rowsNightly,    setRowsNightly]           = useState([]);
  const [rowsPR,         setRowsPR]           = useState([]);
  const [expandedRows,   setExpandedRows]   = useState([]);
  const [requiredFilter, setRequiredFilter] = useState(false);
  const [keepSearch,     setKeepSearch]     = useState(true);
  const [display,        setDisplay]        = useState("nightly");
  const [selectedPR,    setSelectedPR]    = useState("");


  const icons = [
    "sunny.svg",
    "partially-sunny.svg",
    "cloudy.svg",
    "rainy.svg",
    "stormy.svg",
  ];


  // Fetch the data (either local or external)
  useEffect(() => {
    const fetchData = async () => {
      const nightlyData = process.env.NODE_ENV === "development" ? null : await fetch(
        "https://raw.githubusercontent.com/a1icja/kata-dashboard-next/refs/heads/latest-dashboard-data/data/job_stats.json"
      ).then((res) => res.json());
      const prData = process.env.NODE_ENV === "development" ? null : await fetch(
        "https://raw.githubusercontent.com/a1icja/kata-dashboard-next/refs/heads/latest-dashboard-data/data/check_stats.json"
      ).then((res) => res.json());

      const mapData = (data) => Object.keys(data).map((key) => ({ name: key, ...data[key] }));
      setJobs(mapData(nightlyData));
      setChecks(mapData(prData));
      setLoading(false);
    };
    fetchData();
  }, []);


  // Get the bar chart statistics. 
  const getTotalStats = (data) => {
    return data.reduce((acc, job) => {
      acc.runs  += job.runs;
      acc.fails += job.fails;
      acc.skips += job.skips;
      return acc;
    }, { runs: 0, fails: 0, skips: 0 });
  };

  const totalStats = display === "nightly" 
    ? getTotalStats(jobs) 
    : getTotalStats(checks);


  // Set the display (including PR num for single view).
  useEffect(() => {
    const initialDisplay = new URLSearchParams(window.location.search).get("display");
    if (initialDisplay) {
      if(initialDisplay === "prsingle"){
        const initialPR = new URLSearchParams(window.location.search).get("pr");
        if(initialPR){
          setSelectedPR(initialPR);
        }
      }
      setDisplay(initialDisplay);
    }
  }, []);


  // Filters the jobs s.t. all values must be contained in the name.
  const matchAll = (filteredJobs, urlParams) => {
    const values = urlParams.getAll("value");
    return filteredJobs.filter((job) => {
        const jobName = job.name.toLowerCase();
        return values.every((val) => {
            const decodedValue = decodeURIComponent(val).toLowerCase();
            return jobName.includes(decodedValue);
        });
    });
  };
  
  // Filters the jobs s.t. at least one value must be contained in the name.
  const matchAny = (filteredJobs, urlParams) => {
    const values = urlParams.getAll("value");
    return filteredJobs.filter((job) => {
        const jobName = job.name.toLowerCase();
        return values.some((val) => {
            const decodedValue = decodeURIComponent(val).toLowerCase();
            return jobName.includes(decodedValue); 
        });
    });
  };


  // Filter and set the rows for Nightly view. 
  useEffect(() => {
    setLoading(true);
    // Filter based on required tag.
    let filteredJobs = jobs;
    if (requiredFilter){
      filteredJobs = filteredJobs.filter((job) => job.required);
    }

    //Filter based on the URL. 
    const urlParams = new URLSearchParams(window.location.search);
    if(urlParams.get("matchMode") === "and"){
      filteredJobs = matchAll(filteredJobs, urlParams);
    }else if(urlParams.get("matchMode") === "or"){
      filteredJobs = matchAny(filteredJobs, urlParams);
    }
    //Set the rows for the table.
    setRowsNightly(
      filteredJobs.map((job) => ({
        name          : job.name,
        runs          : job.runs,
        fails         : job.fails,
        skips         : job.skips,
        required      : job.required,
        weather       : getWeatherIndex(job),
        reruns        : job.reruns,
        total_reruns  : job.reruns.reduce((total, r) => total + r, 0),
      }))
    );
    setLoading(false);
  }, [jobs, requiredFilter]);

  // Filter and set the rows for PR Checks view. 
  useEffect(() => {
    setLoading(true);
    // Filter based on required tag.
    let filteredChecks = checks
    if (requiredFilter){
      filteredChecks = filteredChecks.filter((check) => check.required);
    }

    //Filter based on the URL. 
    const urlParams = new URLSearchParams(window.location.search);
    if(urlParams.get("matchMode") === "and"){
      filteredChecks = matchAll(filteredChecks, urlParams);
    }else if(urlParams.get("matchMode") === "or"){
      filteredChecks = matchAny(filteredChecks, urlParams);
    }
    //Set the rows for the table.
    setRowsPR(
      filteredChecks.map((check) => ({
        name          : check.name,
        runs          : check.runs,
        fails         : check.fails,
        skips         : check.skips,
        required      : check.required,
        weather       : getWeatherIndex(check),
        reruns        : check.reruns,
        total_reruns  : check.reruns.reduce((total, r) => total + r, 0),
      }))
    );
    setLoading(false);
  }, [checks, requiredFilter]);

  // Filter and set the rows for Single PR view. 
  useEffect(() => {
    setLoading(true);

    let filteredData = checks;
    //Set the rows for the prsingle table
    if (requiredFilter){
      filteredData = filteredData.filter((job) => job.required);
    }

    //Filter based on the URL. 
    const urlParams = new URLSearchParams(window.location.search);
    if(urlParams.get("matchMode") === "and"){
      filteredData = matchAll(filteredData, urlParams);
    }else if(urlParams.get("matchMode") === "or"){
      filteredData = matchAny(filteredData, urlParams);
    }

    filteredData = filteredData.map((check) => {
      // Only if the check include the run number, add it to the data. 
      const index = check.run_nums.indexOf(Number(selectedPR));
      return index !== -1
        ? {
            name: check.name,
            required: check.required,
            result: check.results[index],
            runs: check.reruns[index] + 1,
          }
        : null;
    }).filter(Boolean); 
  
    setRowsSingle(filteredData);
    setLoading(false);
  }, [checks, requiredFilter, selectedPR]);


  // Close all rows on view switch. 
  // Needed because if view is switched, breaks expanded row toggling.
  useEffect(() => {
    setExpandedRows([])
  }, [display]); 


  const getWeatherIndex = (stat) => {
    const failRate = (stat.fails + stat.skips) / 
                     (stat.runs + stat.reruns.reduce((total, r) =>
                      total + r, 0));
    let idx = Math.floor((failRate * 10) / 2);
    if (idx === icons.length) idx -= 1;
    return isNaN(idx) ? 4 : idx;
  };

  const weatherTemplate = (data) => (
    <div>
      <Image
        src={`${basePath}/${icons[getWeatherIndex(data)]}`}
        alt="weather" width={32}
        height={32}/>
    </div>
  );

  
  const buttonClass = (active) => `tab md:px-4 px-2 py-2 border-2 
    ${active ? "border-blue-500 bg-blue-500 text-white" 
      : "border-gray-300 bg-white hover:bg-gray-100"}`;

  const tabClass = (active) => `tab md:px-4 px-2 py-2 border-b-2 focus:outline-none
    ${active ? "border-blue-500 bg-gray-300" 
      : "border-gray-300 bg-white hover:bg-gray-100"}`;


  const nameTemplate = (rowData) => (
    <div className="cursor-pointer" onClick={() => toggleRow(rowData)}>
    <span style={{ userSelect: 'text' }}>{rowData.name}</span>
  </div>
  );

  const toggleRow = (rowData) => {
    setExpandedRows((prev) =>
      prev.includes(rowData) 
        ? prev.filter((r) => r !== rowData) 
        : [...prev, rowData]
    );
  };

  const overlayRefs = useRef([]);

  const rowExpansionTemplate = (data) => {
    const job = (display === "nightly" 
      ? jobs 
      : checks).find((job) => job.name === data.name);
  
    if (!job) return (
        <div className="p-3 bg-gray-100">
          No data available for this job.
        </div>); 

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
      attempt_urls: job.attempt_urls[idx],
    })); 

    const maintainerData = MaintainerMapping.mappings
      .filter(({ regex }) => new RegExp(regex).test(job.name))
      .flatMap(match => match.owners);

    return (
      <div key={`${job.name}-runs`} className="p-3 bg-gray-100">
        <div className="flex flex-wrap gap-4">
          {runEntries.map(({
            run_num, 
            result, 
            url, 
            reruns, 
            rerun_result, 
            attempt_urls 
          }, idx) => {
            const allResults = rerun_result 
              ?  [result, ...rerun_result] 
              : [result];

            const runStatuses = allResults.map((result, idx) => 
              `${allResults.length - idx}. ${result === 'Pass' 
                ? '✅ Success' 
                : result === 'Fail' 
                  ? '❌ Fail' 
                  : '⚠️ Warning'}`);

            // IDs can't have a '/'...
            const sanitizedJobName = job.name.replace(/[^a-zA-Z0-9-_]/g, '');
            const badgeId = `badge-tooltip-${sanitizedJobName}-${run_num}`;
            overlayRefs.current[badgeId] = overlayRefs.current[badgeId] 
              || React.createRef();

            return (
              <div key={run_num} className="flex">
                <div key={idx} className="flex items-center">
                  {/* <a href={url} target="_blank" rel="noopener noreferrer"> */}
                  <a href={attempt_urls[0]} target="_blank" rel="noopener noreferrer">
                    {getRunStatusIcon(allResults)} {run_num}
                  </a>
                </div>
                {reruns > 0 &&(
                  <span className="p-overlay-badge">
                    <sup  className="text-xs font-bold align-super ml-1"
                          onMouseEnter={(e) => 
                            overlayRefs.current[badgeId].current.toggle(e)}>
                      {reruns+1}
                    </sup>
                    <OverlayPanel ref={overlayRefs.current[badgeId]} dismissable
                    onMouseLeave={(e) => 
                      overlayRefs.current[badgeId].current.toggle(e)}>
                    <ul className="bg-white border rounded shadow-lg p-2">
                      {runStatuses.map((status, index) => (
                        <li key={index} className="p-2 hover:bg-gray-200">
                          <a 
                            href={attempt_urls[index] || `${url}/attempts/${index}`} 
                            target="_blank" 
                            rel="noopener noreferrer">
                              {status}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </OverlayPanel>
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4 p-2 bg-gray-300 w-fit">
          {maintainerData.length > 0 ? (
            <div>
              Maintainers:{" "}
              {maintainerData.map((owner, index) => (
                <span key={index}>
                  <a 
                    href={`https://github.com/${owner.github}`} 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 underline"
                  >
                    {owner.fullname}
                  </a>
                  {index < maintainerData.length - 1 && ", "}
                </span>
              ))}
            </div>
          ) : (
            <div>No Maintainer Information Available</div>
          )}
        </div>

      </div>
    );
  };

  // Apply search terms to the URL and reload the page. 
  const handleSearch= (e) => {
    // Prevent the default behavior so that we can keep search terms.
    e.preventDefault();
    const matchMode = e.target.matchMode.value;
    const value = e.target.value.value.trimEnd(); 
    if (value) {  
      // Append the new matchMode regardless of if search terms were kept.
      const path = new URLSearchParams();
      path.append("display", display);
      if(display === "prsingle" && selectedPR){
        path.append("pr", selectedPR);
      }
      path.append("matchMode", matchMode);
      if (keepSearch) {
        // If keepSearch is true, add existing parameters in the URL.
        const urlParams = new URLSearchParams(window.location.search);
        urlParams.getAll("value").forEach((val) => {
          path.append("value", val); 
        });
      }
      //Add the search term from the form and redirect. 
      path.append("value", encodeURIComponent(value)); 
      window.location.assign(`${basePath}/?${path.toString()}`);
    }
  };

  // Clear the search parameters, but only if they exist.
  const clearSearch = () => {
    if(window.location.href.includes("matchMode")){
      const path = new URLSearchParams();
      path.append("display", display);
      if (display === "prsingle" && selectedPR) {
        path.append("pr", selectedPR);
      }
      window.location.assign(`${basePath}/?${path.toString()}`);
    }
  };

  // Update the URL on display change
  const updateUrl = (view, pr) => {
    const path = new URLSearchParams();
    path.append("display", view);
    // Add PR number Single PR view and a PR is provided
    if (view === "prsingle" && pr) {
      path.append("pr", pr);
    }
    if(window.location.href.includes("matchMode")){
      const urlParams = new URLSearchParams(window.location.search);
      path.append("matchMode", urlParams.get("matchMode"));

      urlParams.getAll("value").forEach((val) => {
        path.append("value", val); 
      });
    }
    // Update the URL without reloading
    window.history.pushState({}, '', `${basePath}/?${path.toString()}`);
  };
  

  // Render table for nightly view.
  const renderNightlyTable = () => (
    <DataTable
      value={rowsNightly}
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
        className="select-all"
        sortable
      />
      <Column field = "required"      header = "Required" sortable/>
      <Column 
        field = "runs"   
        header = "Runs"
        className="whitespace-nowrap px-2"
        // body={(data) => (
        //   <span className="whitespace-nowrap">
        //     <span className="font-bold">
        //       {data.runs}
        //     </span > 
        //     {data.total_reruns > 0 
        //       ? ` (${data.runs + data.total_reruns} total)` 
        //       : ''}
        //   </span>
        // )} 
        sortable />
      <Column field = "total_reruns"  header = "Reruns"  sortable/>
      <Column field = "fails"         header = "Fails"   sortable/>
      <Column field = "skips"         header = "Skips"   sortable/>
      <Column 
        field = "weather"  
        header = "Weather"  
        body = {weatherTemplate} 
        sortable />
    </DataTable>
  );

  const renderPRTable = () => (
    <DataTable
      value={rowsPR}
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
        className="select-all"
        sortable
      />
      <Column field = "required"      header = "Required" sortable/>
      <Column 
        field = "runs"   
        header = "Runs"
        className="whitespace-nowrap px-2"
        // body={(data) => (
        //   <span className="whitespace-nowrap">
        //     <span className="font-bold">
        //       {data.runs}
        //     </span > 
        //     {data.total_reruns > 0 
        //       ? ` (${data.runs + data.total_reruns} total)` 
        //       : ''}
        //   </span>
        // )} 
        sortable />
      <Column field = "total_reruns"  header = "Reruns"  sortable/>
      <Column field = "fails"         header = "Fails"   sortable/>
      <Column field = "skips"         header = "Skips"   sortable/>
      <Column 
        field = "weather"  
        header = "Weather"  
        body = {weatherTemplate} 
        sortable />
    </DataTable>
  );

  // Make a list of all unique run numbers in the check data.
  const runNumOptions = [...new Set(checks.flatMap(check => check.run_nums))].sort((a, b) => b - a);
    
  // Render table for prsingle view 
  const renderSingleViewTable = () => (
    <DataTable
      value={rowsSingle}
      expandedRows={expandedRows}
      stripedRows
      rowExpansionTemplate={rowExpansionTemplate}
      onRowToggle={(e) => setExpandedRows(e.data)}
      loading={loading}
      emptyMessage={selectedPR.length == 0 ? "Select a Pull Request above." : "No results found."}
    >
      <Column expander />
      <Column
        field="name"
        header="Name"
        body={nameTemplate} 
        className="select-all"
        sortable
      />
      <Column
        field="required"
        header="Required"
        sortable
      />
      <Column
        field="result"
        header="Result"
        sortable
      />
      <Column
        field="runs"
        header="Total Runs"
        sortable
      />
    </DataTable>
  );

  return (
    <>

      <title>Kata CI Dashboard</title>
      <div className="text-center text-xs md:text-base">
        <h1 className={"text-4xl mt-4 ml-4 mb-6 underline text-inherit \
                        hover:text-blue-500"}>
          <a
            href={display === 'nightly' 
              ? "https://github.com/kata-containers/kata-containers/" +
                "actions/workflows/ci-nightly.yaml"
              : "https://github.com/kata-containers/kata-containers/" +
                "actions/workflows/ci-on-push.yaml"}
            target="_blank"
            rel="noopener noreferrer"
          >
            Kata CI Dashboard
          </a>
        </h1>

        {display !== "prsingle" && ( 
        <div className="min-[1231px]:absolute flex mx-auto top-5 right-5 w-96 h-24">
              <BarChart data={totalStats} />
        </div>
        )}


        <div className="flex flex-wrap mt-2 p-4 md:text-base text-xs">
          <div className="space-x-2 pb-2 pr-3 mx-auto flex">
            <button 
              className={tabClass(display === "nightly")}
              onClick={() => {
                setDisplay("nightly");
                updateUrl("nightly");
              }}>
              Nightly Jobs
            </button>
            <button 
              className={tabClass(display === "prchecks")}
              onClick={() => {
                setDisplay("prchecks");
                updateUrl("prchecks");
              }}>
              PR Checks
            </button>
            <button 
              className={tabClass(display === "prsingle")}
              onClick={() => {
                setDisplay("prsingle");
                updateUrl("prsingle", selectedPR);
              }}>
              Single PR
            </button>
            {display === "prsingle" && ( 
              <div className="bg-blue-500 p-2 rounded-xl h-fit">
              <select 
                id="selectedrun"
                className="px-1 h-fit rounded-lg"
                onChange={(e) => {
                    setSelectedPR(e.target.value);
                    updateUrl("prsingle", e.target.value);
                  }}
                value={selectedPR} >
                  <option value="">Select PR</option>
                  {runNumOptions.map(num => (
                    <option key={num} value={num}>#{num}</option>
                  ))}
              </select>
              </div>
              )}
            </div>

          <div className="space-x-2 mx-auto">
            <button 
              className={buttonClass()} 
              onClick={() => clearSearch()}>
              Clear Search
            </button>
            <button 
              className={buttonClass(keepSearch)} 
              onClick={() => setKeepSearch(!keepSearch)}>
              Keep URL Search Terms
            </button>
            <button 
              className={buttonClass(requiredFilter)} 
              onClick={() => setRequiredFilter(!requiredFilter)}>
              Required Jobs Only
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center md:text-base text-xs">
          <div className="flex min-[1126px]:justify-end justify-center w-full"> 
            <form className="p-2 bg-gray-700 rounded-md flex flex-row" onSubmit={(e) => handleSearch(e)}> 
              <div>
                <label className="block text-white">Match Mode:</label>
                <select name="matchMode" className="px-1 h-fit rounded-lg">
                  <option value="or">Match Any</option>
                  <option value="and">Match All</option>
                </select>
              </div>
              <div className="mx-2">
                <label className="block text-white">Search Text:</label>
                <input type="text" name="value" required></input>
              </div>
              <button type="submit" className="bg-blue-500 text-white px-4 rounded-3xl">Submit</button>
            </form>
          </div>
        </div>
        
        <div className="mt-1 text-center md:text-lg text-base">
          Total Rows: {display === "prsingle" ? rowsSingle.length : display === "prchecks" ? rowsPR.length : rowsNightly.length}
        </div>

        <main className={"m-0 h-full px-4 overflow-x-hidden overflow-y-auto \
                          bg-surface-ground antialiased select-text"}>
          {/* <div>{renderTable()}</div> */}
          <div>{display === "prsingle" ? renderSingleViewTable() : display === "prchecks" ? renderPRTable() : renderNightlyTable()}</div>
        </main>
      </div>
    </>
  );
}
