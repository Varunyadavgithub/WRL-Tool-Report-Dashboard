import axios from "axios";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { baseURL } from "../../assets/assets";
import toast from "react-hot-toast";

const VisitorPassDisplay = () => {
  const { passId } = useParams();
  const [passDetails, setPassDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPassDetails = async () => {
      try {
        const res = await axios.get(`${baseURL}visitor/pass-details/${passId}`);
        console.log("Working till here...");
        console.log(res);
        if (res?.data?.success) {
          setPassDetails(res.data.data);
        } else {
          toast.error("Failed to fetch pass details");
        }
      } catch (error) {
        console.error("Error fetching pass details:", error);
        toast.error("Failed to fetch pass details");
      } finally {
        setLoading(false);
      }
    };

    fetchPassDetails();
  }, [passId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!passDetails) {
    return <div>No pass details found</div>;
  }
  return (
    <div className="visitor-pass-display container mx-auto p-6">
      <div className="pass-container bg-white shadow-lg rounded-lg p-6 max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-center mb-4">Visitor Pass</h1>

        {/* Pass Details */}
        <div className="pass-details space-y-2">
          <div className="flex">
            <strong className="w-1/3">Name:</strong>
            <span>{passDetails.visitor_name}</span>
          </div>
          <div className="flex">
            <strong className="w-1/3">Contact No:</strong>
            <span>{passDetails.visitor_contact_no}</span>
          </div>
          <div className="flex">
            <strong className="w-1/3">Company:</strong>
            <span>{passDetails.company}</span>
          </div>
          <div className="flex">
            <strong className="w-1/3">Department:</strong>
            <span>{passDetails.department_name}</span>
          </div>
          <div className="flex">
            <strong className="w-1/3">Employee To Meet:</strong>
            <span>{passDetails.employee_name}</span>
          </div>
          <div className="flex">
            <strong className="w-1/3">Valid From:</strong>
            <span>{new Date(passDetails.allow_on).toLocaleString()}</span>
          </div>
          <div className="flex">
            <strong className="w-1/3">Valid Till:</strong>
            <span>{new Date(passDetails.allow_till).toLocaleString()}</span>
          </div>
          <div className="flex">
            <strong className="w-1/3">Purpose:</strong>
            <span>{passDetails.purpose_of_visit}</span>
          </div>
        </div>

        {/* QR Code or Barcode (if available) */}
        {passDetails.qrCode && (
          <div className="qr-code mt-4 text-center">
            <img
              src={passDetails.qrCode}
              alt="Pass QR Code"
              className="mx-auto"
            />
          </div>
        )}

        {/* Print and Action Buttons */}
        <div className="actions mt-6 flex justify-center space-x-4">
          <button
            onClick={handlePrint}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Print Pass
          </button>
        </div>
      </div>

      {/* Print-specific styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .visitor-pass-display,
          .visitor-pass-display * {
            visibility: visible;
          }
          .visitor-pass-display {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
          }
        }
      `}</style>
    </div>
  );
};

export default VisitorPassDisplay;
