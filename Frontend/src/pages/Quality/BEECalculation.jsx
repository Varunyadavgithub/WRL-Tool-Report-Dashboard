import { useState, useEffect } from "react";
import InputField from "../../components/common/InputField";
import Title from "../../components/common/Title";
import Button from "../../components/common/Button";
import axios from "axios";
import modelsData from "../../data/modelsData.json";
import { baseURL } from "../../assets/assets";

export default function BEECalculation() {
  /* ---------------- STATES ---------------- */
  const [models, setModels] = useState(modelsData);
  const [hard, setHard] = useState({ model: "", volume: "", energy: "" });
  const [glass, setGlass] = useState({ model: "", volume: "", energy: "" });
  const [hardTable, setHardTable] = useState([]);
  const [glassTable, setGlassTable] = useState([]);

  const [showHardList, setShowHardList] = useState(false);
  const [showGlassList, setShowGlassList] = useState(false);

  const [showModelPopup, setShowModelPopup] = useState(false);
  const [newModel, setNewModel] = useState({ model: "", volume: "" });
  const [searchModel, setSearchModel] = useState("");

  /* ---------------- CLOSE DROPDOWN ON OUTSIDE CLICK ---------------- */
  useEffect(() => {
    const close = () => {
      setShowHardList(false);
      setShowGlassList(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  /* ---------------- STAR LOGIC ---------------- */
  const getAchievedStar = (table) =>
    table.find((r) => r.status === "TRUE")?.star || "Not Qualified";

  /* ------------ HARD CALC ------------ */
  const calcHard = (V, E) => {
    const A = E * 365;
    let R = [
      { star: 1, min: 3.52 * V + 105.54, max: 4.23 * V + 126.65 },
      { star: 2, min: 2.82 * V + 84.43, max: 3.52 * V + 105.54 },
      { star: 3, min: 2.25 * V + 67.55, max: 2.82 * V + 84.43 },
      { star: 4, min: 1.8 * V + 54.04, max: 2.25 * V + 67.55 },
      { star: 5, min: 0, max: 1.8 * V + 54.04 },
    ];
    return R.map((r) => ({
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

  /* ------------ GLASS CALC ------------ */
  const calcGlass = (V, E) => {
    const A = E * 365;
    let R = [
      { star: 1, min: 5.12 * V + 340.78, max: 6.4 * V + 425.97 },
      { star: 2, min: 4.09 * V + 272.62, max: 5.12 * V + 340.78 },
      { star: 3, min: 3.27 * V + 218.09, max: 4.09 * V + 272.62 },
      { star: 4, min: 2.61 * V + 174.47, max: 3.27 * V + 218.09 },
      { star: 5, min: 0, max: 2.61 * V + 174.47 },
    ];
    return R.map((r) => ({
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

  /* ------------ NEXT STAR IMPROVEMENT ------------ */
  function getNextStarImprovement(table, currentKWh) {
    const row = table.find((r) => r.status === "TRUE");
    if (!row || row.star === 5)
      return "⭐ Already 5 Star — Best Efficiency Achieved";

    const idx = table.findIndex((r) => r.star === row.star) - 1;
    const next = table[idx];

    const requiredAEC = next.max;
    const requiredKWh = (requiredAEC / 365).toFixed(2);
    const improve = (currentKWh - requiredKWh).toFixed(2);

    return `⬆ Reduce ${improve} kWh/day to reach ⭐${row.star + 1}`;
  }

  /* ------------ SAVE BEE RESULT ------------ */
  const save = async () => {
    await axios.post(`${baseURL}/saveBeeRating`, {
      hardModel: hard.model,
      hardRating: getAchievedStar(hardTable),
      glassModel: glass.model,
      glassRating: getAchievedStar(glassTable),
    });
    alert("Saved Successfully");
  };

  /* ------------ MODEL MASTER FUNCTIONS ------------ */
  function addModel() {
    if (!newModel.model || !newModel.volume)
      return alert("Enter Model & Volume");
    setModels([...models, newModel]);
    setNewModel({ model: "", volume: "" });
  }

  function deleteModel(name) {
    setModels(models.filter((m) => m.model !== name));
  }

  async function saveModelsToDB() {
    await axios.post(`${baseURL}/saveModelList`, models);
    alert("Model Master Updated!");
    setShowModelPopup(false);
  }

  /* ================= UI START ================= */

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
          ⚙ Manage Models
        </Button>
      </div>

      {/* ================= Main Panels ================= */}
      <div className="grid md:grid-cols-2 gap-10">
        {/* ========== HARD TOP ========== */}
        <div className="bg-white p-7 rounded-xl shadow border-blue-400 border">
          <h2 className="text-center text-xl font-bold text-blue-700 mb-3">
            Hard Top
          </h2>

          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <InputField
              label="Model"
              value={hard.model}
              onFocus={() => setShowHardList(true)}
              onChange={(e) => {
                setHard({ ...hard, model: e.target.value });
                setShowHardList(true);
              }}
            />

            {showHardList && hard.model && (
              <ul className="absolute w-full bg-white border rounded shadow max-h-40 overflow-y-auto z-50">
                {models
                  .filter((m) =>
                    m.model.toLowerCase().includes(hard.model.toLowerCase())
                  )
                  .map((m, i) => (
                    <li
                      key={i}
                      className="p-2 hover:bg-blue-100 cursor-pointer"
                      onClick={() => {
                        setHard({ ...hard, model: m.model, volume: m.volume });
                        if (hard.energy)
                          setHardTable(calcHard(m.volume, hard.energy));
                        setShowHardList(false);
                      }}
                    >
                      {m.model} - {m.volume}L
                    </li>
                  ))}
              </ul>
            )}
          </div>

          <InputField label="Volume" value={hard.volume} disabled />
          <InputField
            label="Energy kWh/day"
            type="number"
            onChange={(e) => {
              setHard({ ...hard, energy: e.target.value });
              setHardTable(calcHard(hard.volume, e.target.value));
            }}
          />

          {/* Live result */}
          {hardTable.length > 0 && (
            <div className="mt-3 text-center">
              <span
                className={`px-5 py-2 text-white rounded inline-block ${
                  getAchievedStar(hardTable) == 1
                    ? "bg-red-500"
                    : getAchievedStar(hardTable) == 2
                    ? "bg-orange-500"
                    : getAchievedStar(hardTable) == 3
                    ? "bg-yellow-500"
                    : getAchievedStar(hardTable) == 4
                    ? "bg-green-600"
                    : getAchievedStar(hardTable) == 5
                    ? "bg-blue-700"
                    : "bg-gray-500"
                }`}
              >
                ⭐ {getAchievedStar(hardTable)}
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
                  <th colSpan={3}>Annual Energy Consumption (Et) in kWh/year at 38°C</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {hardTable.map((r, i) => (
                  <tr
                    key={i}
                    className={`${
                      r.status === "TRUE" ? "bg-green-200 font-bold" : ""
                    }`}
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

        {/* ========== GLASS TOP ========== */}
        <div className="bg-white p-7 rounded-xl shadow border-green-400 border">
          <h2 className="text-center text-xl font-bold text-green-700 mb-3">
            Glass Top
          </h2>

          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <InputField
              label="Model"
              value={glass.model}
              onFocus={() => setShowGlassList(true)}
              onChange={(e) => {
                setGlass({ ...glass, model: e.target.value });
                setShowGlassList(true);
              }}
            />

            {showGlassList && glass.model && (
              <ul className="absolute w-full bg-white border rounded shadow max-h-40 overflow-y-auto z-50">
                {models
                  .filter((m) =>
                    m.model.toLowerCase().includes(glass.model.toLowerCase())
                  )
                  .map((m, i) => (
                    <li
                      key={i}
                      className="p-2 hover:bg-green-100 cursor-pointer"
                      onClick={() => {
                        setGlass({
                          ...glass,
                          model: m.model,
                          volume: m.volume,
                        });
                        if (glass.energy)
                          setGlassTable(calcGlass(m.volume, glass.energy));
                        setShowGlassList(false);
                      }}
                    >
                      {m.model} - {m.volume}L
                    </li>
                  ))}
              </ul>
            )}
          </div>

          <InputField label="Volume" value={glass.volume} disabled />
          <InputField
            label="Energy kWh/day"
            type="number"
            onChange={(e) => {
              setGlass({ ...glass, energy: e.target.value });
              setGlassTable(calcGlass(glass.volume, e.target.value));
            }}
          />

          {glassTable.length > 0 && (
            <div className="mt-3 text-center">
              <span
                className={`px-5 py-2 text-white rounded inline-block ${
                  getAchievedStar(glassTable) == 1
                    ? "bg-red-500"
                    : getAchievedStar(glassTable) == 2
                    ? "bg-orange-500"
                    : getAchievedStar(glassTable) == 3
                    ? "bg-yellow-500"
                    : getAchievedStar(glassTable) == 4
                    ? "bg-green-600"
                    : getAchievedStar(glassTable) == 5
                    ? "bg-blue-700"
                    : "bg-gray-500"
                }`}
              >
                ⭐ {getAchievedStar(glassTable)}
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
                  <th colSpan={3}>Annual Energy Consumption (Et) in kWh/year at 38°C</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {glassTable.map((r, i) => (
                  <tr
                    key={i}
                    className={`${
                      r.status === "TRUE" ? "bg-green-200 font-bold" : ""
                    }`}
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
          onClick={save}
          className="bg-blue-600 text-white px-8 py-2 rounded text-lg"
        >
          💾 Save BEE Rating
        </Button>
      </div>

      {/* ================= MODEL MASTER POPUP ================= */}
      {showModelPopup && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-[999]">
          <div className="bg-white w-[650px] p-6 rounded-xl shadow-2xl">
            <h2 className="text-2xl font-bold text-center text-indigo-700 mb-4">
              📦 Model Master Management
            </h2>

            <input
              placeholder="🔍 Search Model..."
              className="border p-2 w-full mb-4 rounded focus:ring-2 ring-indigo-400"
              value={searchModel}
              onChange={(e) => setSearchModel(e.target.value.toLowerCase())}
            />

            <div className="max-h-[330px] overflow-y-auto border rounded">
              <table className="w-full text-center text-sm">
                <thead className="bg-indigo-100 sticky top-0 text-indigo-700">
                  <tr>
                    <th className="py-2">Model</th>
                    <th>Volume</th>
                    <th>Delete</th>
                  </tr>
                </thead>

                <tbody>
                  {models
                    .filter((m) => m.model.toLowerCase().includes(searchModel))
                    .map((m, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td>{m.model}</td>
                        <td>
                          <input
                            value={m.volume}
                            type="number"
                            className="border p-1 w-24 rounded"
                            onChange={(e) => {
                              let arr = [...models];
                              arr[i].volume = e.target.value;
                              setModels(arr);
                            }}
                          />
                        </td>
                        <td>
                          <button
                            onClick={() => deleteModel(m.model)}
                            className="text-red-600 text-lg"
                          >
                            ✖
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Add Model Row */}
            <div className="mt-4 bg-indigo-50 p-3 rounded-lg flex gap-2">
              <input
                placeholder="Model"
                value={newModel.model}
                onChange={(e) =>
                  setNewModel({ ...newModel, model: e.target.value })
                }
                className="border p-2 rounded flex-1"
              />
              <input
                placeholder="Volume"
                type="number"
                value={newModel.volume}
                onChange={(e) =>
                  setNewModel({ ...newModel, volume: e.target.value })
                }
                className="border p-2 w-24 rounded"
              />
              <Button
                onClick={addModel}
                className="bg-indigo-600 text-white px-4 py-2 rounded"
              >
                + Add
              </Button>
            </div>

            <div className="mt-5 flex justify-between">
              <Button
                onClick={() => setShowModelPopup(false)}
                className="bg-gray-500 text-white px-6 rounded"
              >
                Close
              </Button>
              <Button
                onClick={saveModelsToDB}
                className="bg-green-600 text-white px-6 rounded"
              >
                💾 Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
