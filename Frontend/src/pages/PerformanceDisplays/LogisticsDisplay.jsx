import Title from "../../components/ui/Title";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
} from "chart.js";
import { Pie, Bar } from "react-chartjs-2";
import ChartDataLabels from "chartjs-plugin-datalabels";
// Register Chart.js components
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  ChartDataLabels
);

const LogisticsDisplay = () => {
  // 🏭 Production Summary Data
  const productionSummaryData = [
    {
      title: "Shift Duration",
      value: 570,
      unit: "Min",
    },
    {
      title: "Avg. Cycle Time per Unit",
      value: 140,
      unit: "Min",
    },
    {
      title: "Units Planned Today",
      value: 130,
      unit: "NOS",
    },
    {
      title: "Rejected/Scrap Units",
      value: 13,
      unit: "NOS",
    },
    {
      title: "Line Stoppage Time",
      value: 130,
      unit: "Min",
    },
    {
      title: "Units Per Hour",
      value: 60,
      unit: "NOS",
    },
    {
      title: "Production Efficiency",
      value: 70,
      unit: "%",
    },
    {
      title: "Today's Plan Achived",
      value: 60,
      unit: "%",
    },
    {
      title: "Units Remaining Today",
      value: 189,
      unit: "NOS",
    },
  ];

  // 🚚 Dispatch Summary Data
  const dispatchSummaryData = [
    {
      title: "Orders Dispatched Today",
      value: "860",
      unit: "NOS",
    },
    {
      title: "Orders Successfully Loaded",
      value: "540",
      unit: "NOS",
    },
    {
      title: "Orders Rejected/Returned",
      value: 12,
      unit: "NOS",
    },
    {
      title: "Delays in Dispatch",
      value: 12,
      unit: "Min",
    },
    {
      title: "Orders per Hour",
      value: 12,
      unit: "NOS",
    },
    {
      title: "Daily Dispatch Target Achieved",
      value: 70,
      unit: "%",
    },
    {
      title: "Balance Orders",
      value: 12,
      unit: "NOS",
    },
    {
      title: "Required Daily Dispatch Rate",
      value: 600,
      unit: "NOS",
    },
    {
      title: "Remaining Dispatch",
      value: 200,
      unit: "NOS",
    },
  ];

  // 📊 Pie Chart Data (Dispatch)
  const dispatchChartData = {
    labels: ["Orders Dispatched Today", "Remaining Orders"],
    datasets: [
      {
        label: "Dispatch Overview",
        data: [360, 20001],
        backgroundColor: ["#34d399", "#f87171"],
        borderColor: ["#10b981", "#ef4444"],
        borderWidth: 1,
      },
    ],
  };

  // 📊 Bar Chart Data (Production)
  const productionChartData = {
    labels: ["% of Day's Plan Achieved", "Remaining Units"],
    datasets: [
      {
        label: "Production Metrics",
        data: [52.63, 47.37],
        backgroundColor: ["#60a5fa", "#fbbf24"],
      },
    ],
  };
  const pieOptions = {
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" },
      datalabels: {
        color: "#fff",
        formatter: (value) => value,
        font: { weight: "bold", size: 24 },
      },
    },
  };

  const barOptions = {
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      datalabels: {
        anchor: "end",
        align: "top",
        color: "#444",
        font: { weight: "bold", size: 24 },
        formatter: (value) => `${value} %`,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { stepSize: 10 },
      },
    },
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 max-w-full">
      {/* 🔰 Title */}
      <Title title="Logistics Performance Display" align="center" />

      {/* 📈 Chart Section - Equal Height & Width */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        {/* 📊 Pie Chart */}
        <div className="flex-1 bg-white p-6 rounded-xl shadow border border-gray-300 flex flex-col">
          <div className="text-xl font-semibold mb-4 text-center">
            Dispatch Performance (Today)
          </div>
          <div className="relative w-full h-[300px]">
            <Pie data={dispatchChartData} options={pieOptions} />
          </div>
        </div>

        {/* 📊 Bar Chart */}
        <div className="flex-1 bg-white p-6 rounded-xl shadow border border-gray-300 flex flex-col">
          <div className="text-xl font-semibold mb-4 text-center">
            Production Plan Achievement
          </div>
          <div className="relative w-full h-[300px]">
            <Bar data={productionChartData} options={barOptions} />
          </div>
        </div>
      </div>

      {/* Scrolling Marquee */}
      <div className="mt-2 overflow-hidden whitespace-nowrap rounded-md shadow-inner border border-orange-500 bg-gradient-to-r from-orange-400 via-orange-300 to-orange-400">
        <div className="animate-marquee text-base md:text-lg font-medium text-white px-4 py-2 inline-block min-w-full tracking-wide">
          🚚 Shift: A | 📅 Date: 13 Sep 2025 | ⏱️ Shift Time: 08:00 → 20:00 | ✅
          Orders Dispatched: 360 | 📦 Total Scans: 152 | 🕒 Avg Load Time: 28
          mins | ⚠️ Delays Today: 12 | 📊 Efficiency: 83%
        </div>
      </div>

      {/* 📊 Side-by-Side Summary Tables */}
      <div className="flex flex-col md:flex-row gap-6 mt-6">
        {/* 🏭 Production Summary Table */}
        <div className="flex-1 bg-white p-6 rounded-xl shadow border border-gray-300">
          <div className="text-xl font-semibold text-center mb-4">
            Production Summary
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-200">
                  <th className="border border-gray-300 px-4 py-2 text-left">
                    Metric
                  </th>
                  <th className="border border-gray-300 px-4 py-2 text-right">
                    Value
                  </th>
                  <th className="border border-gray-300 px-4 py-2 text-left">
                    Unit
                  </th>
                </tr>
              </thead>
              <tbody>
                {productionSummaryData.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-100">
                    <td className="border border-gray-300 px-4 py-2">
                      {item.title}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-right font-bold">
                      {item.value}
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      {item.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 🚚 Dispatch Summary Table */}
        <div className="flex-1 bg-white p-6 rounded-xl shadow border border-gray-300">
          <div className="text-xl font-semibold text-center mb-4">
            Dispatch Summary
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-200">
                  <th className="border border-gray-300 px-4 py-2 text-left">
                    Metric
                  </th>
                  <th className="border border-gray-300 px-4 py-2 text-right">
                    Value
                  </th>
                  <th className="border border-gray-300 px-4 py-2 text-left">
                    Unit
                  </th>
                </tr>
              </thead>
              <tbody>
                {dispatchSummaryData.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-100">
                    <td className="border border-gray-300 px-4 py-2">
                      {item.title}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-right font-bold">
                      {item.value}
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      {item.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogisticsDisplay;
