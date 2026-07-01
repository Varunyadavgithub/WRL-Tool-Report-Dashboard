/**
 * Server-side Chart.js renderer (no browser) used to embed chart images into
 * the report PDFs attached to subscriber emails — mirrors the chart configs
 * the frontend builds with react-chartjs-2, but rendered headlessly via
 * @napi-rs/canvas (ships prebuilt binaries, no native build toolchain needed).
 */
import { Chart, registerables } from "chart.js";
import { createCanvas } from "@napi-rs/canvas";

Chart.register(...registerables);

export const renderChartPNG = (config, width = 480, height = 240) => {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const chart = new Chart(ctx, {
    ...config,
    options: { ...(config.options || {}), responsive: false, animation: false },
  });
  const buffer = canvas.toBuffer("image/png");
  chart.destroy();
  return buffer;
};
