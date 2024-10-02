import { useEffect, useState } from "react";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
// import { fetchCIData } from "../scripts/fetch-ci-nightly-data";
import data from "../data/job_stats.json";

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [rows, setRows] = useState([]);
  const [expandedRows, setExpandedRows] = useState([]);

  const icons = [
    "sunny.svg",
    "partially-sunny.svg",
    "cloudy.svg",
    "rainy.svg",
    "stormy.svg",
  ];

  useEffect(() => {
    const fetchData = async () => {
      // const data = await fetchCIData();

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
    const rows = jobs.map((job) => {
      return {
        name: job.name,
        runs: job.runs,
        fails: job.fails,
        skips: job.skips,
        weather: "Sunny",
      };
    });
    setRows(rows);
    setLoading(false);
  }, [jobs]);

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
        <img
          src={`${icon}`}
          alt="weather"
          style={{ width: "2rem", height: "2rem" }}
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
    );
  };

  return (
    <div className="text-center">
      <h1>Kata CI Dashboard</h1>
      <DataTable
        value={rows}
        expandedRows={expandedRows}
        stripedRows
        rowExpansionTemplate={rowExpansionTemplate}
        onRowToggle={(e) => setExpandedRows(e.data)}
        loading={loading}
      >
        <Column expander style={{ width: "5rem" }} />
        <Column field="name" header="Name" filter></Column>
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
