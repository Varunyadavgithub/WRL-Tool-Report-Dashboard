import { useRef, useState } from "react";
import Title from "../../components/common/Title";
import InputField from "../../components/common/InputField";
import SelectField from "../../components/common/SelectField";
import axios from "axios";
import toast from "react-hot-toast";
import { useSelector } from "react-redux";
import { useEffect } from "react";
import { baseURL } from "../../assets/assets";
import { useNavigate } from "react-router-dom";

const VisitorPass = () => {
  const { user } = useSelector((store) => store.auth);
  const navigate = useNavigate();

  const [visitorData, setVisitorData] = useState({
    visitorPhoto: null,
    name: "",
    contactNo: "",
    email: "",
    company: "",
    noOfPeople: 1,
    nationality: "",
    identityType: "",
    identityNo: "",
    address: "",
    country: "",
    state: "",
    city: "",
    vehicleDetails: "",
    allowOn: "",
    allowTill: "",
    departmentTo: "",
    employeeTo: "",
    visitType: "",
    remark: "",
    specialInstruction: "",
    purposeOfVisit: "",
    createdBy: user?.id,
  });
  const [fetchLoading, setFetchLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);

  const fetchEmployees = async () => {
    try {
      const params = {
        deptId: selectedDepartment.value,
      };
      const res = await axios.get(`${baseURL}visitor/employees`, { params });
      if (res?.data?.success) {
        const data = res?.data.data;
        const formatted = data.map((item) => ({
          label: item.emp_name,
          value: item.emp_id.toString(),
        }));
        setEmployees(formatted);
      }
    } catch (error) {
      console.error("Failed to fetch employees:", error);
      toast.error("Failed to fetch employees.");
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [selectedDepartment]);

  const fetchDepartments = async () => {
    try {
      const res = await axios.get(`${baseURL}visitor/departments`);
      const formatted = res?.data.map((item) => ({
        label: item.department_name,
        value: item.deptCode.toString(),
      }));
      setDepartments(formatted);
    } catch (error) {
      console.error("Failed to fetch departments:", error);
      toast.error("Failed to fetch departments.");
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
    } catch (err) {
      setError("Could not access camera");
      console.error(err);
    }
  };

  // Capture photo
  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    // Set canvas dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to image
    const photoDataUrl = canvas.toDataURL("image/jpeg");

    // Update states
    setCapturedPhoto(photoDataUrl);
    setVisitorData((prev) => ({
      ...prev,
      visitorPhoto: photoDataUrl,
    }));

    // Stop video stream
    const stream = video.srcObject;
    const tracks = stream.getTracks();
    tracks.forEach((track) => track.stop());
  };

  // Render photo capture section
  const renderPhotoCaptureSection = () => {
    return (
      <div className="photo-capture-section flex flex-col gap-2 items-center justify-center">
        {error && <div className="error text-red-500">{error}</div>}

        <div className="camera-preview flex flex-col items-center justify-center">
          {!capturedPhoto ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                style={{
                  display: capturedPhoto ? "none" : "block",
                  transform: "scaleX(-1)",
                }}
                className="bg-white border border-dashed border-purple-400 rounded-xl"
              />
              <div className="flex gap-4 my-4">
                <button
                  onClick={startCamera}
                  className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75 mr-2 cursor-pointer"
                >
                  Open Camera
                </button>

                <button
                  onClick={capturePhoto}
                  className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75 cursor-pointer"
                >
                  Capture Photo
                </button>
              </div>
            </>
          ) : (
            <>
              <img
                src={capturedPhoto}
                alt="Captured"
                className="captured-photo"
              />
              <div className="flex my-4">
                <button
                  onClick={() => setCapturedPhoto(null)}
                  className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75 cursor-pointer"
                >
                  Retake
                </button>
              </div>
            </>
          )}
        </div>

        {/* Hidden canvas for photo capture */}
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>
    );
  };

  // Handler to update form data
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setVisitorData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Submit handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    // Basic validation
    const requiredFields = [
      "name",
      "contactNo",
      "email",
      "identityType",
      "identityNo",
      "allowOn",
      "allowTill",
      "departmentTo",
      "employeeTo",
      "purposeOfVisit",
    ];
    for (let field of requiredFields) {
      if (!visitorData[field]) {
        toast.error(`Please fill the "${field}" field.`);
        return;
      }
    }
    try {
      setLoading(true);
      const payload = {
        ...visitorData,
      };
      const res = await axios.post(`${baseURL}visitor/generate-pass`, payload);
      if (res?.data?.success) {
        toast.success(
          res?.data?.message || "Visitor Pass generated successfully"
        );
      }
      navigate(`/visitor-pass-display/${res?.data?.data?.passId}`);
    } catch (error) {
      console.error("Failed to generate visitor pass:", error);
      toast.error(
        error.response?.data?.message || "Failed to generate visitor pass"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFetchPreviousData = async () => {
    if (!visitorData.contactNo) {
      toast.error("Please enter a contact number");
      return;
    }

    const contactNoRegex = /^[0-9]{10}$/; // Assumes 10-digit phone number
    if (!contactNoRegex.test(visitorData.contactNo)) {
      toast.error("Please enter a valid 10-digit contact number");
      return;
    }
    try {
      setFetchLoading(true);
      const res = await axios.get(`${baseURL}visitor/fetch-previous-pass`, {
        params: { contactNo: visitorData.contactNo },
      });

      if (res?.data?.success) {
        const fetchedData = res?.data?.data;

        // Update visitor data with fetched information
        setVisitorData((prevData) => ({
          ...prevData,
          name: fetchedData.visitor_name || prevData.name,
          email: fetchedData.visitor_email || prevData.email,
          address: fetchedData.address || prevData.address,
          company: fetchedData.company || prevData.company,
          identityType: fetchedData.identity_type || prevData.identityType,
          identityNo: fetchedData.identity_no || prevData.identityNo,
          country: fetchedData.country || prevData.country,
          state: fetchedData.state || prevData.state,
          city: fetchedData.city || prevData.city,
          nationality: fetchedData.nationality || prevData.nationality,
        }));

        toast.success("Previous visitor data fetched successfully");
      } else {
        toast.error("No previous data found for this contact number");
      }
    } catch (error) {
      console.error("Failed to fetch visitor data:", error);
      toast.error(
        error.response?.data?.message || "Failed to fetch visitor data"
      );
    } finally {
      setFetchLoading(false);
    }
  };
  return (
    <div className="min-h-screen bg-gray-100 p-4 overflow-x-hidden max-w-full">
      <Title title="Visitor Pass" align="center" />

      {/* Visitor Pass Form */}
      <form onSubmit={handleSubmit} className="mt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Personal Information Section */}
          <div className="bg-purple-100 border border-dashed border-purple-400 p-4 rounded-xl">
            <h2 className="text-xl font-semibold mb-4 text-center">
              Personal Information
            </h2>
            {/* New Photo Capture Section */}
            {renderPhotoCaptureSection()}
            <div className="grid grid-cols-2 gap-4 w-full">
              <div className="w-full">
                <InputField
                  label="Name"
                  type="text"
                  name="name"
                  placeholder="Enter your full name"
                  value={visitorData.name}
                  onChange={handleInputChange}
                  className="w-full"
                />
              </div>
              <div className="flex items-center  justify-center gap-2 w-full">
                <InputField
                  label="Contact No."
                  type="text"
                  name="contactNo"
                  placeholder="Enter your contact no."
                  value={visitorData.contactNo}
                  onChange={handleInputChange}
                  className="w-full"
                />
                <div>
                  <button
                    type="button"
                    onClick={handleFetchPreviousData}
                    disabled={fetchLoading}
                    className={`px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition ${
                      fetchLoading
                        ? "opacity-50 cursor-not-allowed"
                        : "cursor-pointer"
                    }`}
                  >
                    {fetchLoading ? "Fetching..." : "Fetch"}
                  </button>
                </div>
              </div>
              <div className="w-full">
                <InputField
                  label="Email"
                  type="email"
                  name="email"
                  placeholder="Enter your email address"
                  value={visitorData.email}
                  onChange={handleInputChange}
                  className="w-full"
                />
              </div>
              <div className="w-full">
                <InputField
                  label="Company"
                  type="text"
                  name="company"
                  placeholder="Enter your company"
                  value={visitorData.company}
                  onChange={handleInputChange}
                  className="w-full"
                />
              </div>
              <div className="w-full">
                <InputField
                  label="No. of People"
                  type="number"
                  name="noOfPeople"
                  placeholder="Enter the number of people"
                  value={visitorData.noOfPeople}
                  onChange={handleInputChange}
                  className="w-full"
                />
              </div>
              <div className="w-full">
                <InputField
                  label="Nationality"
                  type="text"
                  name="nationality"
                  placeholder="Enter your nationality"
                  value={visitorData.nationality}
                  onChange={handleInputChange}
                  className="w-full"
                />
              </div>
              <div className="w-full">
                <SelectField
                  label="Identity Type"
                  name="identityType"
                  options={[
                    { value: "", label: "Select Identity Type" },
                    { value: "adhaar_card", label: "Adhaar Card" },
                    { value: "pan_card", label: "Pan Card" },
                    { value: "Others", label: "Others" },
                  ]}
                  value={visitorData.identityType}
                  onChange={handleInputChange}
                  className="w-full"
                />
              </div>
              <div className="w-full">
                <InputField
                  label="Identity No."
                  type="text"
                  name="identityNo"
                  placeholder="Enter the identity no."
                  value={visitorData.identityNo}
                  onChange={handleInputChange}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Address and Identity Section */}
          <div className="bg-purple-100 border border-dashed border-purple-400 p-4 rounded-xl">
            <h2 className="text-xl font-semibold mb-4 text-center">
              Address & Identity
            </h2>
            <div className="space-y-3">
              <label className="block font-semibold mb-1">Addess</label>
              <textarea
                name="address"
                value={visitorData.address}
                onChange={handleInputChange}
                placeholder="Full Address"
                className="w-full p-2 border rounded"
                required
              />
              <div className="grid grid-cols-2 gap-4 w-full">
                <div className="w-full">
                  <SelectField
                    label="Country"
                    name="country"
                    options={[
                      { value: "", label: "Select Country" },
                      { value: "in", label: "India" },
                      { value: "jp", label: "Japan" },
                      { value: "cn", label: "China" },
                    ]}
                    value={visitorData.country}
                    onChange={handleInputChange}
                    className="w-full"
                  />
                </div>
                <div className="w-full">
                  <SelectField
                    label="State"
                    name="state"
                    options={[
                      { value: "", label: "Select State" },
                      { value: "andhra_pradesh", label: "Andhra Pradesh" },
                      {
                        value: "arunachal_pradesh",
                        label: "Arunachal Pradesh",
                      },
                      { value: "assam", label: "Assam" },
                      { value: "bihar", label: "Bihar" },
                      { value: "chhattisgarh", label: "Chhattisgarh" },
                      { value: "goa", label: "Goa" },
                      { value: "gujarat", label: "Gujarat" },
                      { value: "haryana", label: "Haryana" },
                      { value: "himachal_pradesh", label: "Himachal Pradesh" },
                      { value: "jharkhand", label: "Jharkhand" },
                      { value: "karnataka", label: "Karnataka" },
                      { value: "kerala", label: "Kerala" },
                      { value: "madhya_pradesh", label: "Madhya Pradesh" },
                      { value: "maharashtra", label: "Maharashtra" },
                      { value: "manipur", label: "Manipur" },
                      { value: "meghalaya", label: "Meghalaya" },
                      { value: "mizoram", label: "Mizoram" },
                      { value: "nagaland", label: "Nagaland" },
                      { value: "odisha", label: "Odisha" },
                      { value: "punjab", label: "Punjab" },
                      { value: "rajasthan", label: "Rajasthan" },
                      { value: "sikkim", label: "Sikkim" },
                      { value: "tamil_nadu", label: "Tamil Nadu" },
                      { value: "telangana", label: "Telangana" },
                      { value: "tripura", label: "Tripura" },
                      { value: "uttar_pradesh", label: "Uttar Pradesh" },
                      { value: "uttarakhand", label: "Uttarakhand" },
                      { value: "west_bengal", label: "West Bengal" },
                    ]}
                    value={visitorData.state}
                    onChange={handleInputChange}
                    className="w-full"
                  />
                </div>
                <div className="w-full">
                  <SelectField
                    label="City"
                    name="city"
                    options={[
                      { value: "", label: "Select City" },
                      { value: "mumbai", label: "Mumbai" },
                      { value: "delhi", label: "Delhi" },
                      { value: "bengaluru", label: "Bengaluru" },
                      { value: "hyderabad", label: "Hyderabad" },
                      { value: "ahmedabad", label: "Ahmedabad" },
                      { value: "chennai", label: "Chennai" },
                      { value: "kolkata", label: "Kolkata" },
                      { value: "pune", label: "Pune" },
                      { value: "jaipur", label: "Jaipur" },
                      { value: "lucknow", label: "Lucknow" },
                      { value: "bhopal", label: "Bhopal" },
                      { value: "patna", label: "Patna" },
                      { value: "kochi", label: "Kochi" },
                      { value: "chandigarh", label: "Chandigarh" },
                      { value: "visakhapatnam", label: "Visakhapatnam" },
                    ]}
                    value={visitorData.city}
                    onChange={handleInputChange}
                    className="w-full"
                  />
                </div>

                <div className="w-full">
                  <InputField
                    label="Vehicle Details"
                    type="text"
                    name="vehicleDetails"
                    placeholder="Enter the vehicle details"
                    value={visitorData.vehicleDetails}
                    onChange={handleInputChange}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Visit Details Section */}
          <div className="bg-purple-100 border border-dashed border-purple-400 p-4 rounded-xl">
            <h2 className="text-xl font-semibold mb-4 text-center">
              Visit Details
            </h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 w-full">
                <div className="w-full">
                  <label className="block font-semibold mb-1" htmlFor="allowOn">
                    Allow On
                  </label>
                  <input
                    type="datetime-local"
                    id="allowOn"
                    name="allowOn"
                    value={visitorData.allowOn}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>

                <div className="w-full">
                  <label
                    className="block font-semibold mb-1"
                    htmlFor="allowTill"
                  >
                    Allow Till
                  </label>
                  <input
                    type="datetime-local"
                    id="allowTill"
                    name="allowTill"
                    value={visitorData.allowTill}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>

                <div className="w-full">
                  <SelectField
                    label="Department To Visit"
                    name="departmentTo" // Changed from departmentId to departmentTo
                    options={departments}
                    value={visitorData.departmentTo} // Use visitorData state
                    onChange={(e) => {
                      const selectedDept = departments.find(
                        (opt) => opt.value === e.target.value
                      );

                      // Update both selectedDepartment and visitorData
                      setSelectedDepartment(selectedDept);

                      // Update visitorData with selected department
                      setVisitorData((prev) => ({
                        ...prev,
                        departmentTo: e.target.value,
                      }));
                    }}
                    required
                    className="w-full"
                  />
                </div>

                <div className="w-full">
                  <SelectField
                    label="Employee To Visit"
                    name="employeeTo"
                    options={employees}
                    value={visitorData.employeeTo} // Use visitorData state
                    onChange={(e) => {
                      const selectedEmp = employees.find(
                        (opt) => opt.value === e.target.value
                      );

                      // Update both selectedEmployees and visitorData
                      setSelectedEmployees(selectedEmp);

                      // Update visitorData with selected employee
                      setVisitorData((prev) => ({
                        ...prev,
                        employeeTo: e.target.value,
                      }));
                    }}
                    required
                    className="w-full"
                  />
                </div>

                <div className="w-full">
                  <SelectField
                    label="Visit Type"
                    name="visitType"
                    options={[
                      { value: "", label: "Select Visit Type" },
                      { value: "business", label: "Business" },
                      { value: "tourism", label: "Tourism" },
                      { value: "other", label: "Other" },
                    ]}
                    value={visitorData.visitType}
                    onChange={handleInputChange}
                    className="w-full"
                  />
                </div>

                <div className="w-full">
                  <InputField
                    label="Remark"
                    type="text"
                    name="remark"
                    placeholder="Enter the remark"
                    value={visitorData.remark}
                    onChange={handleInputChange}
                    className="w-full"
                  />
                </div>
              </div>

              <label className="block font-semibold mb-1">
                Special Instruction
              </label>
              <textarea
                name="specialInstruction"
                value={visitorData.specialInstruction}
                onChange={handleInputChange}
                placeholder="Enter Some Special Instruction"
                className="w-full p-2 border rounded"
                required
              />

              <label className="block font-semibold mb-1">
                Purpose of Visit
              </label>
              <textarea
                name="purposeOfVisit"
                value={visitorData.purposeOfVisit}
                onChange={handleInputChange}
                placeholder="Enter the Purpose of Visit"
                className="w-full p-2 border rounded"
                required
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="mt-6 text-center">
          <button
            type="submit"
            className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700 transition cursor-pointer"
          >
            Generate Visitor Pass
          </button>
        </div>
      </form>
    </div>
  );
};

export default VisitorPass;
