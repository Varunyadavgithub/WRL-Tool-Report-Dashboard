import { useEffect, useState } from "react";
import Title from "../../components/common/Title";
import InputField from "../../components/common/InputField";
import Button from "../../components/common/Button";
import { FaPeopleRoof } from "react-icons/fa6";
import { GiPlagueDoctorProfile } from "react-icons/gi";
import toast from "react-hot-toast";
import axios from "axios";
import { baseURL } from "../../assets/assets";
import SelectField from "../../components/common/SelectField";

const Visitors = () => {
  const [loading, setLoading] = useState(false);
  const [visitorsData, setVisitorsData] = useState([]);
  const [searchParams, setSearchParams] = useState({
    term: "",
    item: "all",
  });

  const fetchVisitors = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${baseURL}visitor/visitors`);
      if (res?.data?.success) {
        const data = res?.data?.data;
        const formatted = Array.isArray(data) ? data : [data]; // ?? wrap if not array
        setVisitorsData(formatted);
      } else {
        toast.error(res?.data?.message || "Failed to fetch visitors data");
      }
    } catch (error) {
      console.error("Error fetching visitors:", error);
      toast.error("Failed to fetch visitors data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisitors();
  }, []);

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editVisitor, setEditVisitor] = useState(null);
  const [editForm, setEditForm] = useState({
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
  });

  // Open Edit Modal
  const handleEditClick = (visitor) => {
    setEditVisitor(visitor);
    setEditForm({
      visitorPhoto: visitor.photo_url || null,
      name: visitor.name || "",
      contact_no: visitor.contact_no || "",
      email: visitor.email || "",
      company: visitor.company || "",
      noOfPeople: visitor.noOfPeople || 1,
      nationality: visitor.nationality || "",
      identityType: visitor.identityType || "",
      identityNo: visitor.identityNo || "",
      address: visitor.address || "",
      country: visitor.country || "",
      state: visitor.state || "",
    });
    setEditModalOpen(true);
  };

  // Handle Edit Form Change
  const handleEditFormChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  // Submit Edit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.put(
        `${baseURL}visitor/visitors/${editVisitor._id}`,
        editForm
      );
      if (res?.data?.success) {
        toast.success("Visitor updated successfully");
        setEditModalOpen(false);
        fetchVisitors();
      } else {
        toast.error(res?.data?.message || "Failed to update visitor");
      }
    } catch (error) {
      toast.error("Failed to update visitor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="container mx-auto max-w-6xl">
        <Title
          title="Visitors Management"
          align="center"
          className="mb-8 text-3xl font-bold text-gray-800"
        />

        {/* Search Section */}
        <div className="bg-white shadow-lg rounded-xl border border-purple-100 p-6 mt-4 flex flex-col gap-4 items-center justify-center">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center">
            <FaPeopleRoof className="mr-4 text-blue-800 text-4xl" />
            Visitor Search
          </h2>
          <div className="flex flex-col md:flex-row gap-4 w-full max-w-3xl">
            <InputField
              type="text"
              placeholder="Search by Name or Mobile No."
              value={searchParams.term}
              onChange={(e) =>
                setSearchParams({ ...searchParams, term: e.target.value })
              }
              className="flex-1"
            />
            <Button
              text="Search"
              onClick={() => {
                toast.success("Search functionality is not implemented yet.");
              }}
            />
          </div>
        </div>

        {/* Visitor List */}
        <div className="bg-white shadow-lg rounded-xl border border-purple-100 p-6 mt-6">
          {loading ? (
            <div className="text-center text-gray-500 py-6">
              Loading visitors...
            </div>
          ) : visitorsData.length > 0 ? (
            visitorsData.map((visitor, index) => (
              <div
                key={index}
                className="group flex flex-col md:flex-row items-center md:items-start justify-between gap-6 bg-white shadow-md hover:shadow-xl transition-all rounded-xl p-6 mb-4 border border-purple-100"
              >
                {/* Photo */}
                <div className="flex-shrink-0">
                  {visitor.photo_url ? (
                    <img
                      src={visitor.photo_url}
                      alt={`${visitor.name}'s photo`}
                      className="w-28 h-28 object-cover rounded-full border-4 border-blue-300 shadow-md"
                    />
                  ) : (
                    <div className="w-28 h-28 flex items-center justify-center bg-gray-100 rounded-full border-4 border-blue-200 text-gray-400 text-5xl shadow-md">
                      <GiPlagueDoctorProfile />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">
                      {visitor.name}
                    </h2>
                    <p className="text-gray-500">
                      {visitor.company} &bull; {visitor.state}
                    </p>
                    <p className="mt-1">
                      <span className="font-semibold">??</span>{" "}
                      {visitor.contact_no}
                    </p>
                    <p>
                      <span className="font-semibold">??</span> {visitor.email}
                    </p>
                  </div>

                  <div className="text-gray-600">
                    <p>
                      <span className="font-semibold">Last Visit: </span>
                      {visitor.last_visit
                        ? new Date(visitor.last_visit).toLocaleDateString(
                            "en-GB",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }
                          )
                        : "N/A"}
                    </p>
                    <div className="mt-3 flex gap-3">
                      <button
                        className="flex items-center gap-2 px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow transition"
                        onClick={() => handleEditClick(visitor)}
                      >
                        ?? Edit
                      </button>
                      <button className="flex items-center gap-2 px-4 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-full shadow transition">
                        ?? Pass
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-red-500 py-6">
              No visitor data available.
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-xl shadow-lg p-8 w-full relative">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 text-2xl"
              onClick={() => setEditModalOpen(false)}
            >
              &times;
            </button>
            <h2 className="text-xl font-bold mb-4 text-gray-800">
              Edit Visitor
            </h2>
            <form onSubmit={handleEditSubmit} className="mt-6">
              <div className="flex flex-col items-center justify-center gap-2 mb-4">
                {/* Personal Information Section */}
                <div className="flex flex-col items-center gap-2">
                  {editForm.visitorPhoto ? (
                    <img
                      src={
                        typeof editForm.visitorPhoto === "string"
                          ? editForm.visitorPhoto
                          : URL.createObjectURL(editForm.visitorPhoto)
                      }
                      alt="Profile Preview"
                      className="w-24 h-24 object-cover rounded-full border-4 border-purple-400 shadow-md"
                    />
                  ) : (
                    <div className="w-24 h-24 flex items-center justify-center bg-gray-100 rounded-full border-4 border-purple-200 text-gray-400 text-4xl shadow-md">
                      <GiPlagueDoctorProfile />
                    </div>
                  )}

                  {/* File Upload */}
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setEditForm({
                            ...editForm,
                            visitorPhoto: e.target.files[0],
                          });
                        }
                      }}
                      className="hidden"
                    />
                    <div className="inline-block px-4 py-1.5 bg-purple-100 text-purple-700 rounded-full text-sm font-medium hover:bg-purple-200 transition">
                      Upload Profile Picture
                    </div>
                  </label>
                  <span className="text-xs text-gray-500">
                    Accepted formats: JPG, PNG, WEBP
                  </span>
                </div>
                <div className="bg-purple-100 border border-dashed border-purple-400 p-4 rounded-xl">
                  <h2 className="text-xl font-semibold mb-4 text-center">
                    Personal Information
                  </h2>
                  <div className="grid grid-cols-2 gap-4 w-full">
                    <div className="w-full">
                      <InputField
                        label="Name"
                        type="text"
                        name="name"
                        placeholder="Enter your full name"
                        value={editForm.name}
                        onChange={handleEditFormChange}
                        className="w-full"
                      />
                    </div>
                    <div className="flex items-center  justify-center gap-2 w-full">
                      <InputField
                        label="Contact No."
                        type="text"
                        name="contactNo"
                        placeholder="Enter your contact no."
                        value={editForm.contactNo}
                        onChange={handleEditFormChange}
                        className="w-full"
                      />
                    </div>
                    <div className="w-full">
                      <InputField
                        label="Email"
                        type="email"
                        name="email"
                        placeholder="Enter your email address"
                        value={editForm.email}
                        onChange={handleEditFormChange}
                        className="w-full"
                      />
                    </div>
                    <div className="w-full">
                      <InputField
                        label="Company"
                        type="text"
                        name="company"
                        placeholder="Enter your company"
                        value={editForm.company}
                        onChange={handleEditFormChange}
                        className="w-full"
                      />
                    </div>
                    <div className="w-full">
                      <InputField
                        label="No. of People"
                        type="number"
                        name="noOfPeople"
                        placeholder="Enter the number of people"
                        value={editForm.noOfPeople}
                        onChange={handleEditFormChange}
                        className="w-full"
                      />
                    </div>
                    <div className="w-full">
                      <InputField
                        label="Nationality"
                        type="text"
                        name="nationality"
                        placeholder="Enter your nationality"
                        value={editForm.nationality}
                        onChange={handleEditFormChange}
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
                        value={editForm.identityType}
                        onChange={handleEditFormChange}
                        className="w-full"
                      />
                    </div>
                    <div className="w-full">
                      <InputField
                        label="Identity No."
                        type="text"
                        name="identityNo"
                        placeholder="Enter the identity no."
                        value={editForm.identityNo}
                        onChange={handleEditFormChange}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-purple-100 border border-dashed border-purple-400 p-4 rounded-xl">
                  <h2 className="text-xl font-semibold mb-4 text-center">
                    Address & Identity
                  </h2>
                  <div className="space-y-3">
                    <label className="block font-semibold mb-1">Addess</label>
                    <textarea
                      name="address"
                      value={editForm.address}
                      onChange={handleEditFormChange}
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
                          value={editForm.country}
                          onChange={handleEditFormChange}
                          className="w-full"
                        />
                      </div>
                      <div className="w-full">
                        <SelectField
                          label="State"
                          name="state"
                          options={[
                            { value: "", label: "Select State" },
                            {
                              value: "andhra_pradesh",
                              label: "Andhra Pradesh",
                            },
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
                            {
                              value: "himachal_pradesh",
                              label: "Himachal Pradesh",
                            },
                            { value: "jharkhand", label: "Jharkhand" },
                            { value: "karnataka", label: "Karnataka" },
                            { value: "kerala", label: "Kerala" },
                            {
                              value: "madhya_pradesh",
                              label: "Madhya Pradesh",
                            },
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
                            {
                              value: "andaman_and_nicobar_islands",
                              label: "Andaman and Nicobar Islands",
                            },
                            { value: "chandigarh", label: "Chandigarh" },
                            {
                              value: "dadra_and_nagar_haveli_and_daman_and_diu",
                              label: "Dadra and Nagar Haveli and Daman and Diu",
                            },
                            { value: "delhi", label: "Delhi" },
                            {
                              value: "jammu_and_kashmir",
                              label: "Jammu and Kashmir",
                            },
                            { value: "ladakh", label: "Ladakh" },
                            { value: "lakshadweep", label: "Lakshadweep" },
                            { value: "puducherry", label: "Puducherry" },
                            // All Indian states and union territories included
                          ]}
                          value={editForm.state}
                          onChange={handleEditFormChange}
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
                          value={editForm.city}
                          onChange={handleEditFormChange}
                          className="w-full"
                        />
                      </div>

                      <div className="w-full">
                        <InputField
                          label="Vehicle Details"
                          type="text"
                          name="vehicleDetails"
                          placeholder="Enter the vehicle details"
                          value={editForm.vehicleDetails}
                          onChange={handleEditFormChange}
                          className="w-full"
                        />
                      </div>
                    </div>
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
        </div>
      )}
    </div>
  );
};

export default Visitors;