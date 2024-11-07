import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const BarChart = ({ data }) => {
  const chartData = {
    labels: ['Runs', 'Fails', 'Skips'],
    datasets: [
      {
        label: 'Job Stats',
        data: [
          data?.runs || 0, 
          data?.fails || 0, 
          data?.skips || 0
        ],
        backgroundColor: ['#36a2eb', '#ff6384', '#ffcd56'],
        borderColor: ['#36a2eb', '#ff6384', '#ffcd56'],
        borderWidth: 1,
        barThickness: 10
      },
    ],
  };

  const options = {
    indexAxis: 'y', // Horizontal bar chart
    scales: {
      x: { beginAtZero: true },
    },
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
  };

  return <Bar data={chartData} options={options} />;
};

export default BarChart;