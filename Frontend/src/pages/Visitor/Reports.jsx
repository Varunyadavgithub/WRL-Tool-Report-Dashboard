import { useState } from "react";
import Title from "../../components/common/Title";
import { useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";

const baseURL = import.meta.env.VITE_API_BASE_URL;

const Reports = () => {
  const [visitors, setVisitors] = useState([]);

  const fetchVisitors = async () => {
    try {
      const res = await axios.get(`${baseURL}visitor/repot`);

      if (res?.data?.success) {
        setVisitors(res?.data?.data);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
      toast.error("Failed to fetch users.");
    }
  };

  useEffect(() => {
    fetchVisitors();
  }, []);
  return (
    <div className="min-h-screen bg-gray-100 p-4 overflow-x-hidden max-w-full">
      <Title title="Visitors Reports" align="center" />

      {/* Tables Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl">
        <div className="flex justify-between items-center mb-4">
          <div className="flex-1 text-center">
            <span className="text-2xl font-bold text-purple-800">
              Visitors Reports Overview
            </span>
          </div>
        </div>

        <div className="bg-white border border-gray-300 rounded-md p-2">
          <div className="flex flex-wrap gap-4">
            {/* Users Table Section */}
            <div className="w-full overflow-x-auto">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xl font-semibold text-purple-700">
                  Visitors
                </h3>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">
                    Total Visitors: {visitors.length || "0"}
                  </span>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-[500px] overflow-y-auto">
                  <table className="min-w-full bg-white text-xs text-left table-auto">
                    <thead className="bg-purple-200 sticky top-0 z-10">
                      <tr>
                        <th className="px-2 py-2 text-center border-b w-[50px]">
                          Sr.No.
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[120px]">
                          Name
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[150px]">
                          Contact No.
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[100px]">
                          Email
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[100px]">
                          Company
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[100px]">
                          Nationality
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[100px]">
                          Identity Type
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[100px]">
                          Identity No
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[100px]">
                          Address
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[100px]">
                          Country
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[100px]">
                          State
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[120px]">
                          City
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[120px]">
                          Postal Code
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[100px]">
                          Vehicle Details
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[100px]">
                          Check In Time
                        </th>
                        <th className="px-2 py-2 text-center border-b min-w-[100px]">
                          Check Out Time
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Conditional rendering for users */}
                      {visitors && visitors.length > 0 ? (
                        visitors.map((visitor, index) => (
                          <tr
                            key={visitor.id}
                            className="hover:bg-gray-50 transition-colors duration-200"
                          >
                            <td className="px-2 py-2 text-center border-b">
                              {index + 1}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {visitor.name}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {visitor.contact_no}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {visitor.email}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {visitor.company}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {visitor.nationality}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {visitor.identity_type}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {visitor.identity_no}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {visitor.address}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {visitor.country}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {visitor.state}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {visitor.city}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {visitor.postal_code}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {visitor.vehicle_details}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {visitor.check_in_time
                                .replace("T", " ")
                                .replace("Z", "")}
                            </td>
                            <td className="px-2 py-2 text-center border-b">
                              {visitor.check_out_time
                                .replace("T", " ")
                                .replace("Z", "")}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={17}
                            className="text-center py-4 text-gray-500"
                          >
                            No visitors found. Add a new visitor to get started.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;

// Select * from visitor_passes

// id
// visitor_id
// visitor_photo
// visitor_name
// visitor_contact_no
// visitor_email
// company
// no_of_people
// nationality
// identity_type
// identity_no
// address
// country
// state
// city
// postal_code
// vehicle_details
// allow_on
// allow_till
// department_to_visit
// employee_to_visit
// visit_type
// special_instructions
// check_in_time
// check_out_time
// created_by
// created_at

// INSERT INTO visitor_passes
//    (
//     visitor_id,
//     visitor_photo,
//     visitor_name,
//     visitor_contact_no,
//     visitor_email,
//     company,
//     no_of_people,
//     nationality,
//     identity_type,
//     identity_no,
//     address,
//     country,
//     state,
//     city,
//     postal_code,
//     vehicle_details,
//     allow_on,
//     allow_till,
//     department_to_visit,
//     employee_to_visit,
//     visit_type,
//     special_instructions,
//     created_by,
//     created_at
//     )
// VALUES
//     (
//     4,
//     'hsvscweb3ud4tcf',
//     'Varun Yadav',
//     '9106547391',
//     'varun.yadav@example.com',
//     'Acme Corp',
//     3,
//     'Indian',
//     'Passport',
//     'A1234567',
//     '123 Street Name, Locality',
//     'India',
//     'Maharashtra',
//     'Mumbai',
//     '400001',
//     'MH01AB1234',
//     '2025-07-07 09:00:00',
//     '2025-07-07 18:00:00',
//     'IT Department',
//     101,
//     'Business',
//     'No special instructions',
//     6438,
//     GETDATE()
//     );

//     Select * from visitors

// INSERT INTO visitors
//    (
//     name,
//     contact_no,
//     email,
//     company,
//     nationality,
//     identity_type,
//     identity_no,
//     address,
//     country,
//     state,
//     city,
//     postal_code,
//     vehicle_details,
//     photo_url,
//     created_at
//     )
// VALUES
//     (
//     'Varun Yadav',
//     '9106547391',
//     'varun.yadav@example.com',
//     'Acme Corp',
//     'Indian',
//     'Passport',
//     'A1234567',
//     '123 Street Name, Locality',
//     'India',
//     'Maharashtra',
//     'Mumbai',
//     '400001',
//     'MH01AB1234',
//     'hsvscweb3ud4tcf',
//     GETDATE()
//     );
