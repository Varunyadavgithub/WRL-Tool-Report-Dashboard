import Title from "../../components/common/Title";
import SelectField from "../../components/common/SelectField";
import InputField from "../../components/common/InputField";
import Button from "../../components/common/Button";
import axios from "axios";
import toast from "react-hot-toast";
import { useEffect, useState } from "react";
import { FaEdit } from "react-icons/fa";
import { MdDeleteForever } from "react-icons/md";
import PopupModal from "../../components/common/PopupModal";
import { WiThermometer } from "react-icons/wi";
import { FaBolt } from "react-icons/fa";
import { MdPowerSettingsNew } from "react-icons/md";

const baseURL = import.meta.env.VITE_API_BASE_URL;

const LPTRecipe = () => {
  const [loading, setLoading] = useState(false);
  const [variants, setVariants] = useState([]);
  const [minTemp, setMinTemp] = useState("");
  const [maxTemp, setMaxTemp] = useState("");
  const [actualTemp, setActualTemp] = useState("");
  const [minCurr, setMinCurr] = useState("");
  const [maxCurr, setMaxCurr] = useState("");
  const [actualCurr, setActualCurr] = useState("");
  const [minPow, setMinPow] = useState("");
  const [maxPow, setMaxPow] = useState("");
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [itemToUpdate, setItemToUpdate] = useState(null);

  const [updateFields, setUpdateFields] = useState({
    modelName: "",
    minTemp: "",
    maxTemp: "",
    minCurr: "",
    maxCurr: "",
    minPow: "",
    maxPow: "",
  });

  const [recipes, setRecipes] = useState([]);

  useEffect(() => {
    fetchModelVariants();
    fetchRecipes();
  }, []);

  const fetchModelVariants = async () => {
    try {
      const res = await axios.get(`${baseURL}shared/model-variants`);
      const formatted = res?.data.map((item) => ({
        label: item.MaterialName,
        value: item.MatCode.toString(),
      }));
      setVariants(formatted);
    } catch (error) {
      console.error("Failed to fetch model variants:", error);
      toast.error("Failed to fetch model variants.");
    }
  };

  const fetchRecipes = async () => {
    try {
      const res = await axios.get(`${baseURL}quality/lpt-recipe`);
      if (res?.data?.success) {
        setRecipes(res.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch recipes:", error);
      toast.error("Failed to fetch recipes.");
    }
  };

  const handleAddRecipe = async () => {
    if (
      !selectedVariant ||
      !minTemp ||
      !maxTemp ||
      !minCurr ||
      !maxCurr ||
      !minPow ||
      !maxPow
    ) {
      return toast.error("All fields are required.");
    }

    try {
      setLoading(true);
      await axios.post(`${baseURL}quality/lpt-recipe`, {
        matCode: selectedVariant.value,
        modelName: selectedVariant.label,
        minTemp,
        maxTemp,
        minCurr,
        maxCurr,
        minPow,
        maxPow,
      });

      toast.success("Recipe added successfully.");
      fetchRecipes();
      setSelectedVariant(null);
      setMinTemp("");
      setMaxTemp("");
      setMinCurr("");
      setMaxCurr("");
      setMinPow("");
      setMaxPow("");
    } catch (err) {
      console.error(err);
      toast.error("Failed to add recipe.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = (item) => {
    setItemToUpdate(item);
    setUpdateFields({
      modelName: item.ModelName || "",
      minTemp: item.MinTemp || "",
      maxTemp: item.MaxTemp || "",
      minCurr: item.MinCurrent || "",
      maxCurr: item.MaxCurrent || "",
      minPow: item.MinPower || "",
      maxPow: item.MaxPower || "",
    });
    setShowUpdateModal(true);
  };

  const confirmUpdate = async () => {
    if (
      !updateFields.modelName ||
      !updateFields.minTemp ||
      !updateFields.maxTemp ||
      !updateFields.minCurr ||
      !updateFields.maxCurr ||
      !updateFields.minPow ||
      !updateFields.maxPow
    ) {
      toast.error("All fields are required.");
      return;
    }

    try {
      setLoading(true);
      const res = await axios.put(
        `${baseURL}quality/lpt-recipe/${updateFields.modelName}`,
        {
          minTemp: updateFields.minTemp,
          maxTemp: updateFields.maxTemp,
          minCurr: updateFields.minCurr,
          maxCurr: updateFields.maxCurr,
          minPow: updateFields.minPow,
          maxPow: updateFields.maxPow,
        }
      );

      // Check response status
      if (res?.data?.success) {
        toast.success("Recipe updated successfully.");
        fetchRecipes();
        setShowUpdateModal(false);
      } else {
        toast.error(res.data.error || "Failed to update recipe.");
      }
    } catch (err) {
      console.error(err);
      toast.error(
        err.res?.data?.error || "Failed to update recipe. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (item) => {
    setItemToDelete(item);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      setLoading(true);
      await axios.delete(
        `${baseURL}quality/lpt-recipe/${itemToDelete.ModelName}`
      );
      toast.success("Recipe deleted successfully.");
      fetchRecipes();
      setShowDeleteModal(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete recipe.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 overflow-x-hidden max-w-full">
      <Title title="LPT Recipe" align="center" />

      {/* Filters Section */}
      <div className="flex gap-2">
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl flex flex-wrap gap-4 items-center">
          <SelectField
            label="Model Variant"
            options={variants}
            value={selectedVariant?.value || ""}
            onChange={(e) =>
              setSelectedVariant(
                variants.find((opt) => opt.value === e.target.value) || 0
              )
            }
          />
          <div className="flex flex-col gap-4 p-5 bg-red-50 shadow-md border border-red-200 rounded-xl min-w-[220px]">
            <h1 className="text-lg font-bold text-center text-red-700 flex items-center justify-center gap-2">
              <WiThermometer className="text-2xl" />
              Temperature
            </h1>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <InputField
                  label="Min Temp"
                  type="text"
                  value={minTemp}
                  onChange={(e) => setMinTemp(e.target.value)}
                  className="w-32 mx-auto"
                />
                <InputField
                  label="Max Temp"
                  type="text"
                  value={maxTemp}
                  onChange={(e) => setMaxTemp(e.target.value)}
                  className="w-32 mx-auto"
                />
              </div>
            </div>
          </div>

          {/* Current Block */}
          <div className="flex flex-col gap-4 p-5 bg-blue-50 shadow-md border border-blue-200 rounded-xl min-w-[220px]">
            <h1 className="text-lg font-bold text-center text-blue-700 flex items-center justify-center gap-2">
              <FaBolt className="text-xl" />
              Current
            </h1>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <InputField
                  label="Min Current"
                  type="text"
                  value={minCurr}
                  onChange={(e) => setMinCurr(e.target.value)}
                  className="w-32 mx-auto"
                />
                <InputField
                  label="Max Current"
                  type="text"
                  value={maxCurr}
                  onChange={(e) => setMaxCurr(e.target.value)}
                  className="w-32 mx-auto"
                />
              </div>
            </div>
          </div>

          {/* Power Block */}
          <div className="flex flex-col gap-4 p-5 bg-yellow-50 shadow-md border border-yellow-200 rounded-xl min-w-[220px]">
            <h1 className="text-lg font-bold text-center text-yellow-700 flex items-center justify-center gap-2">
              <MdPowerSettingsNew className="text-xl" />
              Power
            </h1>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <InputField
                  label="Min Power"
                  type="text"
                  value={minPow}
                  onChange={(e) => setMinPow(e.target.value)}
                  className="w-32 mx-auto"
                />
                <InputField
                  label="Max Power"
                  type="text"
                  value={maxPow}
                  onChange={(e) => setMaxPow(e.target.value)}
                  className="w-32 mx-auto"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <Button
              bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
              textColor={loading ? "text-white" : "text-black"}
              className={`font-semibold ${loading ? "cursor-not-allowed" : ""}`}
              onClick={() => handleAddRecipe()}
              disabled={loading}
            >
              Add
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl w-full">
        <div className="flex bg-white border border-gray-300 rounded-md p-4 w-full">
          <div className="w-full max-h-[600px] overflow-x-auto">
            <table className="w-full border bg-white text-xs text-left rounded-lg table-auto">
              <thead className="bg-gray-200 sticky top-0 z-10 text-center">
                {/* First header row */}
                <tr>
                  <th className="px-2 py-2 border min-w-[50px]" rowSpan={2}>
                    Sr No.
                  </th>
                  <th className="px-2 py-2 border" rowSpan={2}>
                    Model Name
                  </th>
                  <th className="px-2 py-2 border" colSpan={2}>
                    Temperature (°C)
                  </th>
                  <th className="px-2 py-2 border" colSpan={2}>
                    Current (A)
                  </th>
                  <th className="px-2 py-2 border" colSpan={2}>
                    Power (W)
                  </th>
                  <th className="px-2 py-2 border" colSpan={2}>
                    Actions
                  </th>
                </tr>

                {/* Second header row */}
                <tr>
                  <th className="px-2 py-2 border">Min</th>
                  <th className="px-2 py-2 border">Max</th>
                  <th className="px-2 py-2 border">Min</th>
                  <th className="px-2 py-2 border">Max</th>
                  <th className="px-2 py-2 border">Min</th>
                  <th className="px-2 py-2 border">Max</th>
                  <th className="px-2 py-2 border">Update</th>
                  <th className="px-2 py-2 border">Delete</th>
                </tr>
              </thead>

              <tbody>
                {recipes.map((item, index) => (
                  <tr
                    key={index}
                    className="text-center hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-2 py-2 border">{index + 1}</td>
                    <td className="px-2 py-2 border">{item.ModelName}</td>
                    {/* Temperature */}
                    <td className="px-2 py-2 border">{item.MinTemp}</td>
                    <td className="px-2 py-2 border">{item.MaxTemp}</td>
                    {/* Current */}
                    <td className="px-2 py-2 border">{item.MinCurrent}</td>
                    <td className="px-2 py-2 border">{item.MaxCurrent}</td>
                    {/* Power */}
                    <td className="px-2 py-2 border">{item.MinPower}</td>
                    <td className="px-2 py-2 border">{item.MaxPower}</td>
                    {/* Actions */}
                    <td className="px-2 py-2 border">
                      <button
                        className="text-green-500 hover:text-green-700 transition-colors cursor-pointer"
                        onClick={() => handleUpdate(item)}
                        title="Update"
                      >
                        <FaEdit size={18} />
                      </button>
                    </td>
                    <td className="px-2 py-2 border">
                      <button
                        className="text-red-500 hover:text-red-700 transition-colors cursor-pointer"
                        onClick={() => handleDelete(item)}
                        title="Delete"
                      >
                        <MdDeleteForever size={20} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {showUpdateModal && (
        <PopupModal
          title="Update Recipe"
          description=""
          confirmText="Update"
          cancelText="Cancel"
          modalId="update-modal"
          onConfirm={confirmUpdate}
          onCancel={() => setShowUpdateModal(false)}
          icon={<FaEdit className="text-blue-500 w-10 h-10 mx-auto" />}
        >
          <div className="space-y-4 mt-4 text-left">
            <InputField
              label="Model Name"
              type="text"
              value={updateFields.modelName}
              readOnly
              className="text-black dark:text-white"
            />
            <div>
              <div className="flex flex-col items-center justify-center gap-2">
                {/* Temperature Inputs */}
                <div className="flex items-center justify-between gap-4">
                  <InputField
                    label="Min Temp"
                    type="text"
                    value={updateFields.minTemp}
                    onChange={(e) =>
                      setUpdateFields({
                        ...updateFields,
                        minTemp: e.target.value,
                      })
                    }
                    className="text-black dark:text-white"
                  />
                  <InputField
                    label="Max Temp"
                    type="text"
                    value={updateFields.maxTemp}
                    onChange={(e) =>
                      setUpdateFields({
                        ...updateFields,
                        maxTemp: e.target.value,
                      })
                    }
                    className="text-black dark:text-white"
                  />
                </div>

                {/* Current Inputs */}
                <div className="flex items-center justify-between gap-4">
                  <InputField
                    label="Min Curr"
                    type="text"
                    value={updateFields.minCurr}
                    onChange={(e) =>
                      setUpdateFields({
                        ...updateFields,
                        minCurr: e.target.value,
                      })
                    }
                    className="text-black dark:text-white"
                  />
                  <InputField
                    label="Max Curr"
                    type="text"
                    value={updateFields.maxCurr}
                    onChange={(e) =>
                      setUpdateFields({
                        ...updateFields,
                        maxCurr: e.target.value,
                      })
                    }
                    className="text-black dark:text-white"
                  />
                </div>

                {/* Power Inputs */}
                <div className="flex items-center justify-between gap-4">
                  <InputField
                    label="Min Power"
                    type="text"
                    value={updateFields.minPow}
                    onChange={(e) =>
                      setUpdateFields({
                        ...updateFields,
                        minPow: e.target.value,
                      })
                    }
                    className="text-black dark:text-white"
                  />
                  <InputField
                    label="Max Power"
                    type="text"
                    value={updateFields.maxPow}
                    onChange={(e) =>
                      setUpdateFields({
                        ...updateFields,
                        maxPow: e.target.value,
                      })
                    }
                    className="text-black dark:text-white"
                  />
                </div>
              </div>
            </div>
          </div>
        </PopupModal>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <PopupModal
          title="Delete Confirmation"
          description="Are you sure you want to delete this item?"
          confirmText="Yes, Delete"
          cancelText="Cancel"
          modalId="delete-modal"
          onConfirm={confirmDelete}
          onCancel={() => setShowDeleteModal(false)}
          icon={<MdDeleteForever className="text-red-500 w-12 h-12 mx-auto" />}
        />
      )}
    </div>
  );
};

export default LPTRecipe;
