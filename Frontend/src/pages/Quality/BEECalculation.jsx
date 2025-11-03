import Title from "../../components/common/Title";

const BEECalculation = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <Title
        title="BEE Calculation"
        align="center"
        className="mb-8 text-3xl font-bold text-gray-800"
      />
      <div className="overflow-x-auto">
        {/* First Table */}
        <table className="bg-white border border-black border-b-0 rounded-lg shadow-md">
          <tbody>
            <tr className="bg-yellow-300 text-black">
              <th className="py-3 px-6 border border-black text-left">
                Model Name
              </th>
              <td className="py-3 px-6 border border-black bg-white">
                F350GL25
              </td>
            </tr>
            <tr className="bg-yellow-300 text-black">
              <th className="py-3 px-6 border border-black text-left">
                Net Volume
              </th>
              <td className="py-3 px-6 border border-black bg-white">258</td>
            </tr>
            <tr className="bg-yellow-300 text-black">
              <th className="py-3 px-6 border border-black border-b-0 text-left">
                Calculated energy consumption kWh/Day
              </th>
              <td className="py-3 px-6 border border-black border-b-0 bg-white">
                3.343
              </td>
            </tr>
          </tbody>
        </table>

        {/* Second Table */}
        <table className="bg-white border border-black rounded-lg shadow-md text-center">
          <thead>
            <tr className="bg-gray-300">
              <th className="py-3 px-6 text-red-500 border border-black">
                Star Rating
              </th>
              <th
                className="py-3 px-6 text-red-500 border border-black"
                colSpan="3"
              >
                Annual Energy Consumption (Et) in kWh/year at 38°C
              </th>
              <th className="py-3 px-6 text-red-500 border border-black">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-white">
              <td className="py-3 px-6 border border-black font-semibold text-left">
                1 Star *
              </td>
              <td className="py-3 px-6 border border-black">1327.8</td>
              <td className="py-3 px-6 border border-black">1220.2</td>
              <td className="py-3 px-6 border border-black">1661.7</td>
              <td className="py-3 px-6 border border-black bg-red-300 font-bold">
                FALSE
              </td>
            </tr>
            <tr className="bg-white">
              <td className="py-3 px-6 border border-black font-semibold text-left">
                2 Star **
              </td>
              <td className="py-3 px-6 border border-black">1061.8</td>
              <td className="py-3 px-6 border border-black">1220.2</td>
              <td className="py-3 px-6 border border-black">1327.8</td>
              <td className="py-3 px-6 border border-black bg-green-300 font-bold">
                TRUE
              </td>
            </tr>
            <tr className="bg-white">
              <td className="py-3 px-6 border border-black font-semibold text-left">
                3 Star ***
              </td>
              <td className="py-3 px-6 border border-black">847.9</td>
              <td className="py-3 px-6 border border-black">1220.2</td>
              <td className="py-3 px-6 border border-black">1061.8</td>
              <td className="py-3 px-6 border border-black bg-red-300 font-bold">
                FALSE
              </td>
            </tr>
            <tr className="bg-white">
              <td className="py-3 px-6 border border-black  font-semibold text-left">
                4 Star ****
              </td>
              <td className="py-3 px-6 border border-black">676.2</td>
              <td className="py-3 px-6 border border-black">1220.2</td>
              <td className="py-3 px-6 border border-black">847.9</td>
              <td className="py-3 px-6 border border-black bg-red-300 font-bold">
                FALSE
              </td>
            </tr>
            <tr className="bg-white">
              <td className="py-3 px-6 border border-black font-semibold text-left">
                5 Star *****
              </td>
              <td className="py-3 px-6 border border-black"></td>
              <td className="py-3 px-6 border border-black">1220.2</td>
              <td className="py-3 px-6 border border-black">676.2</td>
              <td className="py-3 px-6 border border-black bg-red-300 font-bold">
                FALSE
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BEECalculation;
