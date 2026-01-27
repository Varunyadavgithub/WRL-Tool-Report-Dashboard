import { useState, useEffect } from "react";
import InputField from "../../components/ui/InputField";
import Title from "../../components/ui/Title";
import Button from "../../components/ui/Button";
import axios from "axios";
import { baseURL } from "../../assets/assets";
import {
  FaStar,
  FaSave,
  FaCog,
  FaBoxOpen,
  FaSearch,
  FaTrash,
  FaPlus,
  FaArrowUp,
} from "react-icons/fa";
import toast from "react-hot-toast";
import { RxCross1 } from "react-icons/rx";

/* ================= CONSTANTS ================= */
const STAR_COLORS = {
  1: "bg-red-500",
  2: "bg-orange-500",
  3: "bg-yellow-500",
  4: "bg-green-600",
  5: "bg-blue-700",
};

/* ================= HELPER FUNCTIONS ================= */
const getAchievedStar = (table) =>
  table.find((r) => r.status === "TRUE")?.star || "Not Qualified";

const getStarClass = (star) => STAR_COLORS[star] || "bg-gray-500";

const calcHard = (V, E) => {
  const A = E * 365;
  const ranges = [
    { star: 1, min: 3.52 * V + 105.54, max: 4.23 * V + 126.65 },
    { star: 2, min: 2.82 * V + 84.43, max: 3.52 * V + 105.54 },
    { star: 3, min: 2.25 * V + 67.55, max: 2.82 * V + 84.43 },
    { star: 4, min: 1.8 * V + 54.04, max: 2.25 * V + 67.55 },
    { star: 5, min: 0, max: 1.8 * V + 54.04 },
  ];

  return ranges.map((r) => ({
    star: r.star,
    min: r.min,
    Et: A,
    max: r.max,
    status:
      r.star === 5
        ? A < r.max
          ? "TRUE"
          : "FALSE"
        : A >= r.min && A < r.max
          ? "TRUE"
          : "FALSE",
  }));
};

const calcGlass = (V, E) => {
  const A = E * 365;
  const ranges = [
    { star: 1, min: 5.12 * V + 340.78, max: 6.4 * V + 425.97 },
    { star: 2, min: 4.09 * V + 272.62, max: 5.12 * V + 340.78 },
    { star: 3, min: 3.27 * V + 218.09, max: 4.09 * V + 272.62 },
    { star: 4, min: 2.61 * V + 174.47, max: 3.27 * V + 218.09 },
    { star: 5, min: 0, max: 2.61 * V + 174.47 },
  ];

  return ranges.map((r) => ({
    star: r.star,
    min: r.min,
    AEC: A,
    max: r.max,
    status:
      r.star === 5
        ? A < r.max
          ? "TRUE"
          : "FALSE"
        : A >= r.min && A < r.max
          ? "TRUE"
          : "FALSE",
  }));
};

const getNextStarImprovement = (table, currentKWh) => {
  if (!table || table.length === 0) return null;

  const row = table.find((r) => r.status === "TRUE");

  // If no row achieved TRUE yet
  if (!row) {
    const next = table[table.length - 1]; // pick the last star (lowest) as next
    const requiredKWh = (next.max / 365).toFixed(2);
    const improve = (currentKWh - requiredKWh).toFixed(2);

    return (
      <span className="flex items-center justify-center gap-2">
        <FaArrowUp />
        Reduce {improve} kWh/day to reach <FaStar /> {next.star}
      </span>
    );
  }

  // Already 5-star?
  if (row.star === 5) {
    return (
      <span className="flex items-center justify-center gap-2">
        <FaStar /> Already 5 Star — Best Efficiency Achieved
      </span>
    );
  }

  // Otherwise, get the next higher star
  const currentIndex = table.findIndex((r) => r.star === row.star);
  const next = table[currentIndex - 1]; // previous in array = higher star
  if (!next) return null; // safety check

  const requiredKWh = (next.max / 365).toFixed(2);
  const improve = (currentKWh - requiredKWh).toFixed(2);

  return (
    <span className="flex items-center justify-center gap-2">
      <FaArrowUp />
      Reduce {improve} kWh/day to reach <FaStar /> {next.star}
    </span>
  );
};

/* ================= COMPONENT ================= */
export default function BEECalculation() {
  const [models, setModels] = useState([]);
  const [hard, setHard] = useState({ model: "", volume: "", energy: "" });
  const [glass, setGlass] = useState({ model: "", volume: "", energy: "" });
  const [hardTable, setHardTable] = useState([]);
  const [glassTable, setGlassTable] = useState([]);

  const [showHardList, setShowHardList] = useState(false);
  const [showGlassList, setShowGlassList] = useState(false);
  const [showModelPopup, setShowModelPopup] = useState(false);
  const [newModel, setNewModel] = useState({ model: "", volume: "" });
  const [searchModel, setSearchModel] = useState("");

  /* ================= FETCH MODELS ================= */
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${baseURL}quality/bee/models`);
        if (res.data?.success) setModels(res.data.models);
      } catch {
        toast.error("Failed to load models");
      }
    })();
  }, []);

  /* ================= CLOSE DROPDOWNS ================= */
  useEffect(() => {
    const close = () => {
      setShowHardList(false);
      setShowGlassList(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  /* ================= API ACTIONS ================= */
  const saveRating = async () => {
    const toastId = toast.loading("Saving BEE Rating...");

    if (!hard.model && !glass.model) {
      toast.error("Please enter either Hard Top or Glass Top", { id: toastId });
      return;
    }

    const payload = hard.model
      ? {
          hardModel: hard.model,
          hardRating: getAchievedStar(hardTable),
          glassModel: null,
          glassRating: null,
        }
      : {
          hardModel: null,
          hardRating: null,
          glassModel: glass.model,
          glassRating: getAchievedStar(glassTable),
        };

    try {
      await axios.post(`${baseURL}quality/bee/save-rating`, payload);
      toast.success("BEE Rating saved successfully", { id: toastId });
      setHard({ model: "", volume: "", energy: "" });
      setGlass({ model: "", volume: "", energy: "" });
      setHardTable([]);
      setGlassTable([]);
    } catch {
      toast.error("Failed to save BEE Rating", { id: toastId });
    }
  };

  const saveModels = async () => {
    const toastId = toast.loading("Saving models...");
    try {
      await axios.post(`${baseURL}quality/bee/models`, models);
      toast.success("Model updated successfully", { id: toastId });
      setShowModelPopup(false);
    } catch {
      toast.error("Failed to save models", { id: toastId });
    }
  };

  /* ================= MODEL CRUD ================= */
  const addModel = () => {
    if (!newModel.model || !newModel.volume || !newModel.type)
      return toast.error("Please enter Model name, Volume and Type.");
    setModels((prev) => [...prev, newModel]);
    setNewModel({ model: "", volume: "", type: "" });
  };

  const deleteModel = async (name) => {
    const toastId = toast.loading(`Deleting model ${name}...`);

    try {
      // Call API to delete the model
      await axios.delete(`${baseURL}quality/bee/models/${name}`);

      // Remove from frontend state after successful deletion
      setModels((prev) => prev.filter((m) => m.model !== name));

      toast.success(`Model ${name} deleted successfully`, { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error(`Failed to delete model ${name}`, { id: toastId });
    }
  };

  return (
    <div className="p-10 bg-gray-100 min-h-screen">
      <Title
        title="BEE Star Rating Calculator"
        align="center"
        className="text-3xl font-bold mb-8"
      />

      <div className="flex justify-end mb-4">
        <Button
          onClick={() => setShowModelPopup(true)}
          className="bg-indigo-600 text-white px-6 rounded"
        >
          <FaCog className="inline mr-2" />
          Manage Models
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-10">
        {/* ================= HARD TOP ================= */}
        <div className="bg-white p-7 rounded-xl shadow border border-blue-400">
          <h2 className="text-center text-xl font-bold text-blue-700 mb-3">
            Hard Top
          </h2>

          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <InputField
              label="Model"
              value={hard.model}
              disabled={!!glass.model}
              onFocus={() => setShowHardList(true)}
              onChange={(e) => {
                setHard({ ...hard, model: e.target.value });
                setShowHardList(true);
                if (e.target.value)
                  setGlass({ ...glass, model: "", energy: "", volume: "" });
              }}
            />

            {showHardList && hard.model && (
              <ul className="absolute w-full bg-white border rounded shadow max-h-40 overflow-y-auto z-50">
                {models.filter(
                  (m) =>
                    m.type === "Hard Top" &&
                    m.model.toLowerCase().includes(hard.model.toLowerCase()),
                ).length > 0 ? (
                  models
                    .filter(
                      (m) =>
                        m.type === "Hard Top" &&
                        m.model
                          .toLowerCase()
                          .includes(hard.model.toLowerCase()),
                    )
                    .map((m, i) => (
                      <li
                        key={i}
                        className="p-2 hover:bg-blue-100 cursor-pointer"
                        onClick={() => {
                          setHard({
                            model: m.model,
                            volume: m.volume,
                            energy: "",
                          });
                          setHardTable([]);
                          setShowHardList(false);
                        }}
                      >
                        {m.model} - {m.volume}L
                      </li>
                    ))
                ) : (
                  <li className="p-2 text-gray-400">No models found</li>
                )}
              </ul>
            )}
          </div>

          <InputField label="Volume" value={hard.volume} disabled />

          <InputField
            label="Energy kWh/day"
            type="number"
            value={hard.energy}
            onChange={(e) => {
              setHard({ ...hard, energy: e.target.value });
              setHardTable(calcHard(hard.volume, e.target.value));
            }}
          />

          {hardTable.length > 0 && (
            <div className="mt-3 text-center">
              <span
                className={`px-5 py-2 text-white rounded inline-block ${getStarClass(
                  getAchievedStar(hardTable),
                )}`}
              >
                <FaStar className="inline mr-2" />
                {getAchievedStar(hardTable)}
              </span>

              <p className="mt-1 text-blue-700 font-semibold text-sm">
                {getNextStarImprovement(hardTable, hard.energy)}
              </p>
            </div>
          )}

          {hardTable.length > 0 && (
            <table className="w-full mt-4 text-center border">
              <thead className="bg-blue-100">
                <tr>
                  <th>Star</th>
                  <th colSpan={3}>
                    Annual Energy Consumption (Et) in kWh/year at 38°C
                  </th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {hardTable.map((r, i) => (
                  <tr
                    key={i}
                    className={
                      r.status === "TRUE" ? "bg-green-200 font-bold" : ""
                    }
                  >
                    <td>{r.star}</td>
                    <td>{r.min.toFixed(2)}</td>
                    <td>{r.Et.toFixed(2)}</td>
                    <td>{r.max.toFixed(2)}</td>
                    <td
                      className={
                        r.status === "TRUE" ? "text-green-700" : "text-red-600"
                      }
                    >
                      {r.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ================= GLASS TOP ================= */}
        <div className="bg-white p-7 rounded-xl shadow border border-green-400">
          <h2 className="text-center text-xl font-bold text-green-700 mb-3">
            Glass Top
          </h2>

          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <InputField
              label="Model"
              value={glass.model}
              disabled={!!hard.model}
              onFocus={() => setShowGlassList(true)}
              onChange={(e) => {
                setGlass({ ...glass, model: e.target.value });
                setShowGlassList(true);
                if (e.target.value)
                  setHard({ ...hard, model: "", energy: "", volume: "" });
              }}
            />

            {showGlassList && glass.model && (
              <ul className="absolute w-full bg-white border rounded shadow max-h-40 overflow-y-auto z-50">
                {models.filter(
                  (m) =>
                    m.type === "Glass Top" &&
                    m.model.toLowerCase().includes(glass.model.toLowerCase()),
                ).length > 0 ? (
                  models
                    .filter(
                      (m) =>
                        m.type === "Glass Top" &&
                        m.model
                          .toLowerCase()
                          .includes(glass.model.toLowerCase()),
                    )
                    .map((m, i) => (
                      <li
                        key={i}
                        className="p-2 hover:bg-green-100 cursor-pointer"
                        onClick={() => {
                          setGlass({
                            model: m.model,
                            volume: m.volume,
                            energy: "",
                          });
                          setGlassTable([]);
                          setShowGlassList(false);
                        }}
                      >
                        {m.model} - {m.volume}L
                      </li>
                    ))
                ) : (
                  <li className="p-2 text-gray-400">No models found</li>
                )}
              </ul>
            )}
          </div>

          <InputField label="Volume" value={glass.volume} disabled />

          <InputField
            label="Energy kWh/day"
            type="number"
            value={glass.energy}
            onChange={(e) => {
              setGlass({ ...glass, energy: e.target.value });
              setGlassTable(calcGlass(glass.volume, e.target.value));
            }}
          />

          {glassTable.length > 0 && (
            <div className="mt-3 text-center">
              <span
                className={`px-5 py-2 text-white rounded inline-block ${getStarClass(
                  getAchievedStar(glassTable),
                )}`}
              >
                <FaStar className="inline mr-2" />
                {getAchievedStar(glassTable)}
              </span>

              <p className="mt-1 text-green-700 font-semibold text-sm">
                {getNextStarImprovement(glassTable, glass.energy)}
              </p>
            </div>
          )}

          {glassTable.length > 0 && (
            <table className="w-full mt-4 text-center border">
              <thead className="bg-green-100">
                <tr>
                  <th>Star</th>
                  <th colSpan={3}>
                    Annual Energy Consumption (AEC) in kWh/year at 38°C
                  </th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {glassTable.map((r, i) => (
                  <tr
                    key={i}
                    className={
                      r.status === "TRUE" ? "bg-green-200 font-bold" : ""
                    }
                  >
                    <td>{r.star}</td>
                    <td>{r.min.toFixed(2)}</td>
                    <td>{r.AEC.toFixed(2)}</td>
                    <td>{r.max.toFixed(2)}</td>
                    <td
                      className={
                        r.status === "TRUE" ? "text-green-700" : "text-red-600"
                      }
                    >
                      {r.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="text-center mt-10">
        <Button
          onClick={saveRating}
          className="bg-blue-600 text-white px-8 py-2 rounded text-lg"
        >
          <FaSave className="inline mr-2" />
          Save BEE Rating
        </Button>
      </div>

      {/* ================= MODEL MASTER POPUP ================= */}
      {showModelPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[999] p-4">
          <div className="bg-white w-full max-w-3xl p-6 rounded-2xl shadow-2xl relative">
            {/* Header */}
            <div className="flex items-center justify-between mb-5 border-b pb-2">
              <h2 className="text-2xl font-bold text-indigo-700 flex items-center gap-2">
                <FaBoxOpen /> Model Master Management
              </h2>
              <button
                onClick={() => setShowModelPopup(false)}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-600 hover:text-gray-800 transition-colors duration-200 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-gray-400 cursor-pointer"
              >
                <RxCross1 className="text-xl" />
              </button>
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 mb-4 p-2 border rounded-lg shadow-sm bg-gray-50">
              <FaSearch className="text-gray-400" />
              <input
                placeholder="Search Model..."
                className="outline-none flex-1 bg-transparent text-gray-700"
                value={searchModel}
                onChange={(e) => setSearchModel(e.target.value.toLowerCase())}
              />
            </div>

            {/* Table */}
            <div className="overflow-x-auto max-h-[300px] border rounded-lg shadow-sm bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-indigo-50 sticky top-0 text-indigo-700 font-semibold">
                  <tr>
                    <th className="px-3 py-2">Model</th>
                    <th className="px-3 py-2">Volume (L)</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2 text-center">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {models
                    .filter((m) => m.model.toLowerCase().includes(searchModel))
                    .map((m, i) => (
                      <tr
                        key={i}
                        className="border-b hover:bg-indigo-50 transition-colors duration-200"
                      >
                        <td className="px-3 py-2">{m.model}</td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={m.volume}
                            className="border p-1 w-24 rounded outline-none focus:ring-1 focus:ring-indigo-400"
                            onChange={(e) => {
                              const arr = [...models];
                              arr[i].volume = e.target.value;
                              setModels(arr);
                            }}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={m.type || "Not Defined"}
                            className="border p-1 rounded outline-none focus:ring-1 focus:ring-indigo-400"
                            onChange={(e) => {
                              const arr = [...models];
                              arr[i].type = e.target.value;
                              setModels(arr);
                            }}
                          >
                            <option value="Not Defined">Not Defined</option>
                            <option value="Hard Top">Hard Top</option>
                            <option value="Glass Top">Glass Top</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => deleteModel(m.model)}
                            className="text-red-600 hover:text-red-800 transition-colors duration-200"
                          >
                            <FaTrash />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Add New Model */}
            <div className="mt-4 p-3 rounded-lg bg-indigo-50 flex flex-col sm:flex-row gap-2 items-center shadow-sm">
              <input
                placeholder="Model"
                value={newModel.model}
                onChange={(e) =>
                  setNewModel({ ...newModel, model: e.target.value })
                }
                className="border p-2 rounded flex-1 outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <input
                placeholder="Volume"
                type="number"
                value={newModel.volume}
                onChange={(e) =>
                  setNewModel({ ...newModel, volume: e.target.value })
                }
                className="border p-2 w-24 rounded outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <select
                value={newModel.type || "Not Defined"}
                onChange={(e) =>
                  setNewModel({ ...newModel, type: e.target.value })
                }
                className="border p-2 rounded w-32 outline-none focus:ring-1 focus:ring-indigo-400"
              >
                <option value="Not Defined">Not Defined</option>
                <option value="Hard Top">Hard Top</option>
                <option value="Glass Top">Glass Top</option>
              </select>
              <Button
                onClick={addModel}
                className="bg-indigo-600 text-white px-5 py-2 rounded hover:bg-indigo-700 transition-colors duration-200 flex items-center gap-1"
              >
                <FaPlus /> Add
              </Button>
            </div>

            {/* Footer Buttons */}
            <div className="mt-5 flex justify-end gap-3">
              <Button
                onClick={() => setShowModelPopup(false)}
                className="bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600 transition-colors duration-200"
              >
                Close
              </Button>
              <Button
                onClick={saveModels}
                className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 transition-colors duration-200"
              >
                <FaSave className="inline mr-2" />
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
