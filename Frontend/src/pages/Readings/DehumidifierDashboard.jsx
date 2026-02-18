import axios from "axios";
import { useEffect, useState } from "react";
import { baseURL } from "../../assets/assets";
import Title from "../../components/ui/Title";
import AnimatedNumber from "../../components/ui/AnimatedNumber";
import IndustrialGauge from "../../components/ui/IndustrialGauge";
import { motion } from "framer-motion";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from "recharts";

import {
  FiDroplet,
  FiThermometer,
  FiX,
  FiActivity,
  FiClock,
} from "react-icons/fi";

/* ================= SHIFT CALCULATION ================= */

const getShiftRange = () => {
  const now = new Date();

  const today8 = new Date();
  today8.setHours(8, 0, 0, 0);

  const today20 = new Date();
  today20.setHours(20, 0, 0, 0);

  if (now >= today8 && now < today20) {
    return { start: today8, end: today20 };
  }

  if (now < today8) {
    const yesterday20 = new Date(today20.getTime() - 86400000);
    return { start: yesterday20, end: today8 };
  }

  const tomorrow8 = new Date(today8.getTime() + 86400000);
  return { start: today20, end: tomorrow8 };
};

/* ================= BUILD SUMMARY ================= */

const buildSummary = (rows) => {
  const shift = getShiftRange();

  const shiftRows = rows.filter((r) => {
    const t = new Date(r.ReadingTimeFull);
    return t >= shift.start && t <= shift.end;
  });

  const result = {
    Humidity: {},
    Temp: {},
  };

  ["Humidity", "Temp"].forEach((type) => {
    const actualValues = shiftRows
      .filter((r) => r.MeterType === type && r.ValueType === "Actual")
      .map((r) => Number(r.ActualValue));

    const setValues = shiftRows
      .filter((r) => r.MeterType === type && r.ValueType === "Set")
      .map((r) => Number(r.ActualValue));

    if (actualValues.length) {
      result[type].MinActual = Math.min(...actualValues);
      result[type].MaxActual = Math.max(...actualValues);
    }

    if (setValues.length) {
      result[type].SetValue = setValues[setValues.length - 1];
    }
  });

  return result;
};

/* ================= PAGE ================= */

const DehumidifierDashboard = () => {
  const [machines, setMachines] = useState([]);
  const [selectedMachineId, setSelectedMachineId] = useState(null);
  const [trend, setTrend] = useState([]);
  const [summary, setSummary] = useState({});
  const [live, setLive] = useState({});

  /* -------- FETCH MACHINES -------- */
  useEffect(() => {
    const load = async () => {
      const res = await axios.get(`${baseURL}reading`);
      if (res.data.success) setMachines(res.data.data);
    };

    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  /* -------- FETCH LIVE + TREND -------- */
  useEffect(() => {
    if (!selectedMachineId) return;

    const loadLive = async () => {
      const res = await axios.get(`${baseURL}reading`);
      const m = res.data.data.find(
        (x) => x.MachineId == selectedMachineId
      );
      if (m) setLive(m);
    };

    const loadTrend = async () => {
      const res = await axios.get(
        `${baseURL}reading/machine-reading`,
        { params: { machineId: selectedMachineId } }
      );

      const rows = res.data.data;

      const grouped = {};
      rows.forEach((r) => {
        if (!grouped[r.ReadingTime]) {
          grouped[r.ReadingTime] = {
            time: r.ReadingTime,
            ReadingTimeFull: r.ReadingTimeFull,
          };
        }

        grouped[r.ReadingTime][
          `${r.MeterType}_${r.ValueType}`
        ] = Number(r.ActualValue);
      });

      const trendData = Object.values(grouped);
      setTrend(trendData);
      setSummary(buildSummary(rows));
    };

    loadLive();
    loadTrend();
  }, [selectedMachineId]);

  /* ================= UI ================= */

  return (
    <div className="p-6 bg-gradient-to-br from-slate-100 to-slate-200 min-h-screen">

      {/* HEADER */}
      <div className="flex justify-center gap-3 mb-8">
        <FiActivity className="text-3xl text-blue-600" />
        <Title title="UTILITY MONITORING PANEL" />
      </div>

      {/* MACHINE CARDS */}
      <div className="grid grid-cols-4 gap-6">

        {machines.map((m) => (
          <div
            key={m.MachineId}
            onClick={() => setSelectedMachineId(m.MachineId)}
            className="rounded-2xl border-l-8 border-blue-500 bg-white shadow-md hover:shadow-2xl hover:-translate-y-1 transition-all p-5 cursor-pointer"
          >
            <h2 className="font-semibold text-lg text-center mb-4">
              {m.MachineName}
            </h2>

            <div className="flex justify-between">
              <span className="text-blue-600 flex gap-1">
                <FiDroplet /> Humidity
              </span>
              <AnimatedNumber value={m.Humidity} suffix=" %" />
            </div>

            <div className="flex justify-between mt-2">
              <span className="text-red-600 flex gap-1">
                <FiThermometer /> Temp
              </span>
              <AnimatedNumber value={m.Temperature} suffix=" °C" />
            </div>

            <div className="text-xs text-center mt-4 text-gray-500 flex justify-center gap-1">
              <FiClock />
              {m.LastUpdate}
            </div>
          </div>
        ))}
      </div>

      {/* MODAL */}
      {selectedMachineId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="bg-white w-[95%] h-[95%] rounded-2xl p-6 overflow-y-auto relative shadow-2xl"
          >
            <button
              onClick={() => setSelectedMachineId(null)}
              className="absolute top-5 right-6 text-red-500 text-3xl"
            >
              <FiX />
            </button>

            <Title title={`CONTROL PANEL : ${live.MachineName}`} />

            {/* GAUGES */}
            <div className="grid grid-cols-2 gap-10 mt-8">

              <IndustrialGauge
                title="Humidity"
                unit="%"
                actual={live.Humidity}
                set={summary?.Humidity?.SetValue}
                min={summary?.Humidity?.MinActual}
                max={summary?.Humidity?.MaxActual}
              />

              <IndustrialGauge
                title="Temperature"
                unit="°C"
                actual={live.Temperature}
                set={summary?.Temp?.SetValue}
                min={summary?.Temp?.MinActual}
                max={summary?.Temp?.MaxActual}
              />

            </div>

            {/* GRAPH */}
            <div className="bg-white p-6 mt-10 rounded-2xl shadow-lg">
              <h2 className="text-xl font-semibold text-center mb-6">
                SHIFT TREND ANALYSIS
              </h2>

              <ResponsiveContainer width="100%" height={420}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />

                  {/* HUMIDITY BAND */}
                  {summary?.Humidity?.MinActual != null && (
                    <ReferenceArea
                      y1={summary.Humidity.MinActual}
                      y2={summary.Humidity.MaxActual}
                      fill="#dbeafe"
                      fillOpacity={0.4}
                    />
                  )}

                  {/* TEMP BAND */}
                  {summary?.Temp?.MinActual != null && (
                    <ReferenceArea
                      y1={summary.Temp.MinActual}
                      y2={summary.Temp.MaxActual}
                      fill="#fee2e2"
                      fillOpacity={0.3}
                    />
                  )}

                  {/* SET LINES */}
                  {summary?.Humidity?.SetValue != null && (
                    <ReferenceLine
                      y={summary.Humidity.SetValue}
                      stroke="#facc15"
                      strokeDasharray="6 6"
                      label="Humidity Set"
                    />
                  )}

                  {summary?.Temp?.SetValue != null && (
                    <ReferenceLine
                      y={summary.Temp.SetValue}
                      stroke="#f59e0b"
                      strokeDasharray="6 6"
                      label="Temp Set"
                    />
                  )}

                  {/* ACTUAL LINES */}
                  <Line
                    type="monotone"
                    dataKey="Humidity_Actual"
                    stroke="#2563eb"
                    strokeWidth={3}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="Temp_Actual"
                    stroke="#dc2626"
                    strokeWidth={3}
                    dot={false}
                  />

                  {/* SET TREND */}
                  <Line
                    type="monotone"
                    dataKey="Humidity_Set"
                    stroke="#facc15"
                    strokeDasharray="5 5"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="Temp_Set"
                    stroke="#f59e0b"
                    strokeDasharray="5 5"
                    dot={false}
                  />

                </LineChart>
              </ResponsiveContainer>
            </div>

          </motion.div>
        </motion.div>
      )}

    </div>
  );
};

export default DehumidifierDashboard;
