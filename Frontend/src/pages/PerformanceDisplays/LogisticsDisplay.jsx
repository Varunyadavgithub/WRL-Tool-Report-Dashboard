import Title from "../../components/common/Title";

const LogisticsDisplay = () => {
  // Dummy data for summary
  const summaryData = [
    {
      title: "Total FG Unloading Scans",
      value: 152,
      unit: "scans",
      color: "bg-blue-100 text-blue-800 border-blue-300",
    },
    {
      title: "Trucks Loaded Today",
      value: 140,
      unit: "trucks",
      color: "bg-green-100 text-green-800 border-green-300",
    },
    {
      title: "Dispatch Records Exported",
      value: 130,
      unit: "records",
      color: "bg-purple-100 text-purple-800 border-purple-300",
    },
    {
      title: "Avg Time Unload ➜ Load",
      value: "36 mins",
      unit: "",
      color: "bg-yellow-100 text-yellow-800 border-yellow-300",
    },
    {
      title: "Avg Time Load ➜ Dispatch",
      value: "28 mins",
      unit: "",
      color: "bg-orange-100 text-orange-800 border-orange-300",
    },
    {
      title: "Failed or Delayed Dispatches",
      value: 12,
      unit: "issues",
      color: "bg-red-100 text-red-800 border-red-300",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-100 p-4 overflow-x-hidden max-w-full">
      <Title title="Logistics Performance Display" align="center" />

      {/* Summary Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl">
        <div className="flex flex-col items-center mb-4">
          <span className="text-xl font-semibold">Summary</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {summaryData.map((item, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg shadow border ${item.color}`}
            >
              <div className="text-sm font-medium">{item.title}</div>
              <div className="text-2xl font-bold mt-2">{item.value}</div>
              {item.unit && <div className="text-sm">{item.unit}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LogisticsDisplay;
