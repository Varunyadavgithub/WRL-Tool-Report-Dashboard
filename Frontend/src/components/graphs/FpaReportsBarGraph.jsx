import { Bar } from "react-chartjs-2";

const FpaReportsBarGraph = ({ title, labels, datasets }) => {
  const chartData = {
    labels,
    datasets,
  };

  const chartOptions = {
    responsive: true,

    scales: {
      y: {
        beginAtZero: true,
        suggestedMax: 3, // ✅ FPQI always visible clearly
      },
    },

    plugins: {
      legend: { position: "top" },
      title: {
        display: true,
        text: title,
      },
    },
  };

  return (
    <div
      className="bg-white border border-gray-300 rounded-md p-4 shadow 
                    w-full lg:w-[420px] h-[300px]"
    >
      <h2 className="text-center font-semibold mb-2">{title}</h2>

      <div className="w-full h-[230px] flex items-center justify-center">
        <Bar data={chartData} options={chartOptions} />
      </div>
    </div>
  );
};

export default FpaReportsBarGraph;
