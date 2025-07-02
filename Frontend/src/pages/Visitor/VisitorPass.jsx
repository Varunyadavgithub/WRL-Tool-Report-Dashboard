import { useEffect, useState } from "react";
import Title from "../../components/common/Title";
import InputField from "../../components/common/InputField";
import SelectField from "../../components/common/SelectField";
import { usePhotoCapture } from "../../hooks/usePhotoCapture";

const VisitorPass = () => {
  // State to manage visitor pass data
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
    postalCode: "",
    vehicleDetails: "",
    allowOn: "",
    allowTill: "",
    departmentTo: "",
    employeeTo: "",
    visitType: "",
    specialInstruction: "",
  });

  const {
    capturedPhoto,
    isCapturing,
    videoRef,
    canvasRef,
    startCamera,
    capturePhoto,
    retakePhoto,
    errorMessage,
  } = usePhotoCapture();

  // Update visitor data when photo is captured
  useEffect(() => {
    if (capturedPhoto) {
      setVisitorData((prev) => ({
        ...prev,
        visitorPhoto: capturedPhoto,
      }));
    }
  }, [capturedPhoto]);

  // Render method for photo capture
  const renderPhotoCaptureSection = () => {
    return (
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 my-4 rounded-xl">
        <h2 className="text-xl font-semibold mb-4 text-center">
          Visitor Photo
        </h2>

        {/* Error Handling */}
        {errorMessage && (
          <div
            className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4"
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        <div className="flex flex-col items-center">
          {/* Camera Not Started */}
          {!capturedPhoto && !isCapturing && (
            <button
              type="button"
              onClick={startCamera}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mb-4"
            >
              Open Camera
            </button>
          )}

          {/* Camera Active */}
          {isCapturing && (
            <div className="flex flex-col items-center">
              <video
                ref={videoRef}
                autoPlay
                className="w-full max-w-xs mb-4 border-2 border-gray-300"
              />

              <button
                type="button"
                onClick={capturePhoto}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 mb-4"
              >
                Capture Photo
              </button>
            </div>
          )}

          {/* Photo Captured */}
          {capturedPhoto && (
            <div className="flex flex-col items-center">
              <img
                src={capturedPhoto}
                alt="Captured"
                className="w-full max-w-xs mb-4 border-2 border-gray-300"
              />

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={retakePhoto}
                  className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
                >
                  Retake
                </button>
              </div>
            </div>
          )}

          {/* Hidden canvas for photo capture */}
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>
      </div>
    );
  };

  // Handler to update form data
  const handleInputChange = (e) => {
    const { name, value, type, files } = e.target;
    setVisitorData((prevState) => ({
      ...prevState,
      [name]: type === "file" ? files[0] : value,
    }));
  };

  // Submit handler
  const handleSubmit = (e) => {
    e.preventDefault();
    // Implement submission logic
    console.log("Visitor Pass Data:", visitorData);
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
              <div className="w-full">
                <InputField
                  label="Contact No."
                  type="text"
                  name="contactNo"
                  placeholder="Enter your contact no."
                  value={visitorData.contactNo}
                  onChange={handleInputChange}
                  className="w-full"
                />
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
                    { value: "passport", label: "Passport" },
                    { value: "driving_license", label: "Driving License" },
                    { value: "national_id", label: "National ID" },
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
                    label="Postal Code"
                    type="text"
                    name="postalCode"
                    placeholder="Enter the postal code"
                    value={visitorData.postalCode}
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
                  <InputField
                    label="Allow On"
                    type="text"
                    name="allowOn"
                    placeholder="Enter the allowed time"
                    value={visitorData.allowOn}
                    onChange={handleInputChange}
                    className="w-full"
                  />
                </div>
                <div className="w-full">
                  <InputField
                    label="Allow Till"
                    type="text"
                    name="allowTill"
                    placeholder="Enter the allowed time"
                    value={visitorData.allowTill}
                    onChange={handleInputChange}
                    className="w-full"
                  />
                </div>
                <div className="w-full">
                  <InputField
                    label="Department To"
                    type="text"
                    name="departmentTo"
                    placeholder="Enter the department to visit"
                    value={visitorData.departmentTo}
                    onChange={handleInputChange}
                    className="w-full"
                  />
                </div>
                <div className="w-full">
                  <InputField
                    label="Employee To"
                    type="text"
                    name="employeeTo"
                    placeholder="Enter the employee to visit"
                    value={visitorData.employeeTo}
                    onChange={handleInputChange}
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
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="mt-6 text-center">
          <button
            type="submit"
            className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700 transition"
          >
            Generate Visitor Pass
          </button>
        </div>
      </form>
    </div>
  );
};

export default VisitorPass;
