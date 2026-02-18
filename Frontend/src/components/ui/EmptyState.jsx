import { BsExclamationCircle } from "react-icons/bs";

function EmptyState({ message = "No data found." }) {
  return (
    <div className="flex flex-col items-center gap-2.5 text-gray-400 py-10">
      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
        <BsExclamationCircle size={26} className="text-gray-300" />
      </div>
      <p className="text-sm font-medium text-gray-500">{message}</p>
    </div>
  );
}

export default EmptyState;
