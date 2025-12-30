import { useEffect, useRef } from "react";
import { Chart } from "chart.js";

const FpaBarGraph = ({ title, labels, datasets }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (chartInstance.current) chartInstance.current.destroy(); // prevent duplicate mount

    const ctx = chartRef.current.getContext("2d");

    chartInstance.current = new Chart(ctx, {
      type: "bar", // you can switch dynamically if needed
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true },
          title: {
            display: true,
            text: title,
            font: { size: 18, weight: "bold" },
            padding: 10,
          },
        },
        scales: {
          x: { beginAtZero: true },
          y: { beginAtZero: true },
        },
      },
    });

    return () => {
      if (chartInstance.current) chartInstance.current.destroy();
    };
  }, [labels, datasets, title]);

  return (
    <div style={{ width: "100%", height: "350px" }}>
      <canvas ref={chartRef}></canvas>
    </div>
  );
};

export default FpaBarGraph;
