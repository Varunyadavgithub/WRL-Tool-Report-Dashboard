import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import DateTimePicker from "./DateTimePicker";

const baseURL = import.meta.env.VITE_API_BASE_URL;

const NewReminderModal = ({
  isOpen,
  onClose,
  onSubmit,
  departments,
  priorities = ["low", "medium", "high", "critical"],
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [priority, setPriority] = useState("medium");
  const [scheduledDate, setScheduledDate] = useState("");
  const [loading, setLoading] = useState(false);

  // Form Submission Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      // Prepare reminder data for API
      const reminderData = {
        Title: title,
        Description: description,
        RecptMail: recipientEmail,
        SchldDate: new Date(scheduledDate).toISOString(),
        Department: department,
        Priority: priority,
        Status: "Pending", // Default status
      };

      // Create reminder via API
      const response = await axios.post(
        `${baseURL}reminder/addReminder`,
        reminderData
      );

      // Prepare reminder object for local state/submission
      const newReminder = {
        ...reminderData,
        Id: response.data.reminderId,
        CreatedAt: new Date().toISOString(),
      };

      // Call parent component's submit method
      onSubmit(newReminder);

      // Reset form and close modal
      resetForm();
      onClose();
      toast.success(response.data.message || "Reminder created successfully");
    } catch (error) {
      console.error("Reminder creation error:", error);
      toast.error(error.response?.data?.message || "Failed to create reminder");
    } finally {
      setLoading(false);
    }
  };

  // Form Reset Method
  const resetForm = () => {
    setTitle("");
    setDescription("");
    setRecipientEmail("");
    setDepartment("");
    setPriority("medium");
    setScheduledDate("");
  };

  // Render nothing if modal is closed
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md">
        {/* Modal Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Create New Reminder
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {/* Reminder Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Recipient Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recipient Email
            </label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Enter recipient's email"
            />
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Enter reminder title"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Provide reminder details"
            />
          </div>

          {/* Department */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Department
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Department</option>
              {departments &&
                departments.map((dept) => (
                  <option key={dept.value} value={dept.label}>
                    {dept.label}
                  </option>
                ))}
            </select>
          </div>

          {/* Priority and Scheduled Date */}
          <div className="grid grid-cols-2 gap-4">
            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {priorities.map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Scheduled Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Schedule
              </label>
              <DateTimePicker
                name="schedule"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "Please Wait..." : "Create Reminder"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewReminderModal;
