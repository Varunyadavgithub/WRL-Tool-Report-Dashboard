import ReactToPrint from "react-to-print";
import { useRef } from "react";

const PrintableSecuritySheet = ({ data }) => {
  const ref = useRef();

  return (
    <div>
      <ReactToPrint
        trigger={() => (
          <button className="bg-blue-600 text-white p-2 rounded">
            Print Sheet
          </button>
        )}
        content={() => ref.current}
      />

      <div ref={ref} className="p-6 bg-white">
        <h2 className="text-xl font-bold mb-4">
          WRL Security Manpower List
        </h2>
        <table className="w-full border">
          <thead>
            <tr>
              <th>Department</th>
              <th>Date</th>
              <th>Manpower</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.Id}>
                <td>{item.DepartmentName}</td>
                <td>{item.RequiredDate}</td>
                <td>{item.TotalManpower}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PrintableSecuritySheet;