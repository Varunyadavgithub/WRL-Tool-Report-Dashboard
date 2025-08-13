const PopupModal = ({
  title,
  description,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  icon,
  modalId,
  children, // Add this line
}) => {
  return (
    <div
      id={modalId}
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/20"
    >
      <div className="bg-white dark:bg-gray-700 rounded-xl p-6 w-[90%] max-w-md shadow-md text-center relative">
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 text-white text-2xl cursor-pointer"
        >
          ✕
        </button>
        {icon}
        <h3 className="text-lg font-medium text-gray-800 dark:text-white mt-4">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-300 mt-2">
            {description}
          </p>
        )}

        {children}

        <div className="flex justify-center gap-4 mt-6">
          <button
            onClick={onConfirm}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 cursor-pointer"
          >
            {confirmText}
          </button>
          <button
            onClick={onCancel}
            className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 cursor-pointer"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PopupModal;