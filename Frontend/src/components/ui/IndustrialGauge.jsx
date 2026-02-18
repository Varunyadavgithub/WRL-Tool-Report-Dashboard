const IndustrialGauge = ({title,unit,actual,set,min,max}) => {

  return(
  <div className="bg-gradient-to-br from-slate-50 to-white border rounded-2xl shadow-lg p-6">

    <h3 className="font-semibold text-xl text-center mb-4">{title} ANALYSIS</h3>

    <div className="text-center text-5xl font-bold text-blue-600 mb-4">
      {actual ?? "--"} <span className="text-lg">{unit}</span>
    </div>

    <div className="grid grid-cols-2 gap-4 text-sm">

      <div className="bg-blue-100 rounded-xl p-3 text-center">
        <div className="text-gray-500">Actual</div>
        <div className="font-bold text-lg">{actual ?? "--"} {unit}</div>
      </div>

      <div className="bg-yellow-100 rounded-xl p-3 text-center">
        <div className="text-gray-500">Set</div>
        <div className="font-bold text-lg">{set ?? "--"} {unit}</div>
      </div>

      <div className="bg-green-100 rounded-xl p-3 text-center">
        <div className="text-gray-500">Shift Max</div>
        <div className="font-bold text-lg">{max ?? "--"} {unit}</div>
      </div>

      <div className="bg-purple-100 rounded-xl p-3 text-center">
        <div className="text-gray-500">Shift Min</div>
        <div className="font-bold text-lg">{min ?? "--"} {unit}</div>
      </div>

    </div>

  </div>
  );
};

export default IndustrialGauge;
