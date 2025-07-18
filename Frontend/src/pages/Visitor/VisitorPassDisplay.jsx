import axios from "axios";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { baseURL } from "../../assets/assets";
import toast from "react-hot-toast";
import QRCode from "qrcode";

const VisitorPassDisplay = () => {
  const { passId } = useParams();
  const [passDetails, setPassDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPassDetails = async () => {
      try {
        const res = await axios.get(`${baseURL}visitor/pass-details/${passId}`);
        if (res?.data?.success) {
          const data = res.data.data;

          // Generate QR Code from passId (or any data)
          const qrDataUrl = await QRCode.toDataURL(passId);

          // Add the generated QR code to the passDetails object
          setPassDetails({ ...data, qrCode: qrDataUrl });
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

  if (loading) return <div>Loading...</div>;
  if (!passDetails) return <div>No pass details found</div>;

  return (
    <div className="bg-gray-100 flex flex-col gap-4 justify-center m-7 items-center">
      {/* ✅ WRAP ONLY THE PRINT AREA IN A UNIQUE CONTAINER */}
      <div className="visitor-pass-print-area relative w-full max-w-full border-4 border-double border-black p-1 bg-white box-border">
        {/* QR Top Right */}
        <div className="absolute top-4 right-30">
          <img
            src={passDetails.qrCode || "https://via.placeholder.com/80"}
            alt="QR Code"
            className="block w-20 h-20 "
          />
        </div>

        {/* Profile Top Left */}
        <div className="absolute top-4 left-30">
          <img
            src={passDetails.visitor_photo || "https://via.placeholder.com/80"}
            alt="Profile Pic"
            className="block w-30 h-30 object-cover"
          />
        </div>

        {/* Header */}
        <div className="text-center mb-2">
          <h1 className="text-lg font-bold">Western Refrigeration Pvt. Ltd</h1>
          <p className="text-xs leading-tight">
            Survey No 631, 633, 634, 635, 636, 647, 654,
            <br />
            707, 726, 732, 741, 748, 752,
            <br />
            Village: Tadgam, Tal. Umargaon - 396 135,
            <br />
            Tadgam, Gujarat
          </p>
        </div>

        {/* Pass Title */}
        <div className="flex items-center justify-center">
          <h2 className="text-xl font-bold text-center border-2 border-black inline-block px-4 py-1 mb-2">
            Visitor Pass
          </h2>
        </div>

        {/* Pass Details */}
        <div className="flex justify-between border-2 border-black p-4 mb-3 gap-4">
          {/* Left Column */}
          <div className="w-1/2 space-y-1 text-xs">
            <div className="flex gap-2">
              <strong>Name:</strong>
              <span>{passDetails.visitor_name}</span>
            </div>
            <div className="flex gap-2">
              <strong>Contact No:</strong>
              <span>{passDetails.visitor_contact_no}</span>
            </div>
            <div className="flex gap-2">
              <strong>Company:</strong>
              <span>{passDetails.company[0]}</span>
            </div>
            <div className="flex gap-2">
              <strong>Purpose:</strong>
              <span>{passDetails.purpose_of_visit[0]}</span>
            </div>
          </div>

          {/* Right Column */}
          <div className="w-1/2 space-y-1 text-xs">
            <div className="flex gap-2">
              <strong>Department:</strong>
              <span>{passDetails.department_name[0]}</span>
            </div>
            <div className="flex gap-2">
              <strong>Employee To Meet:</strong>
              <span>{passDetails.employee_name[0]}</span>
            </div>
            <div className="flex gap-2">
              <strong>Valid From:</strong>
              <span>{new Date(passDetails.allow_on).toLocaleString()}</span>
            </div>
            <div className="flex gap-2">
              <strong>Valid Till:</strong>
              <span>{new Date(passDetails.allow_till).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Signatures */}
        <div className="flex justify-between text-xs mt-12">
          <div className="w-1/3 text-center border-t border-black pt-1">
            Security Off.
          </div>
          <div className="w-1/3 text-center border-t border-black pt-1">
            Visitor
          </div>
          <div className="w-1/3 text-center border-t border-black pt-1">
            Emp. Visited
          </div>
        </div>

        {/* Note */}
        <div className="border border-dashed border-black p-2 mt-2 text-[10px] leading-tight">
          <p className="font-bold">NOTE:</p>
          <p>1. Return Pass Duly Signed & Timed By Emp. Visited.</p>
          <p>2. Entry To Prod. Dept. Not Allowed Without Permit.</p>
        </div>

        {/* Instructions */}
        <div className="border border-dashed border-black p-2 mt-1 text-[10px] leading-tight">
          <p className="font-bold">Instructions for Visitors:</p>
          <p>Our aim: "Safety for all"</p>
          <p>* "Safety is our value not just priority".</p>
          <p>
            * Display Visitor ID in plant and return it at security main gate.
          </p>
          <p>* No entry under Alcohol/Drugs influence.</p>
          <p>
            * Possession/Consumption of Alcohol or illegal Drugs is prohibited.
          </p>
          <p>* Mobile use at workplace allowed only with consent.</p>
          <p>* Photography without permission is prohibited.</p>
          <p>* Smoking is prohibited inside the plant.</p>
        </div>
      </div>

      {/* Print Button */}
      <div className="flex justify-center mt-3 no-print">
        <button
          onClick={handlePrint}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Print Pass
        </button>
      </div>

      {/* ✅ Proper Print Styles */}
      <style jsx="true">{`
        @page {
          size: A4 portrait;
          margin: 20mm;
        }
        @media print {
          body * {
            visibility: hidden;
          }
          .visitor-pass-print-area,
          .visitor-pass-print-area * {
            visibility: visible;
          }
          .visitor-pass-print-area {
            position: absolute;
            left: 50%;
            top: 0;
            transform: translateX(-50%);
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default VisitorPassDisplay;
