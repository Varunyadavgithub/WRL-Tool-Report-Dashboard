const PopupModal = ({
  title,
  description,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  icon,
  modalId,
  children,
  modalClassName = "", // ✅ New prop for custom width
  confirmButtonColor = "bg-red-600 hover:bg-red-700", // ✅ Customizable button color
}) => {
  return (
    <div
      id={modalId}
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/20 p-3 sm:p-4"
    >
      {/* Modal Container - Uses custom width if provided */}
      <div
        className={`
          bg-white dark:bg-gray-700 
          rounded-xl 
          p-4 sm:p-6 
          shadow-xl 
          text-center 
          relative
          max-h-[95vh]
          overflow-y-auto
          ${modalClassName || "w-[90%] max-w-md"}
        `}
      >
        {/* Close Button */}
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-white text-xl sm:text-2xl cursor-pointer transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-600"
        >
          ✕
        </button>

        {/* Icon */}
        {icon && <div className="mb-2">{icon}</div>}

        {/* Title */}
        <h3 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-white mt-2 sm:mt-4 pr-8">
          {title}
        </h3>

        {/* Description */}
        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-300 mt-2">
            {description}
          </p>
        )}

        {/* Children Content */}
        {children}

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row justify-center gap-2 sm:gap-4 mt-6">
          <button
            onClick={onCancel}
            className="w-full sm:w-auto bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white px-5 py-2.5 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 cursor-pointer transition-colors font-medium"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`w-full sm:w-auto text-white px-5 py-2.5 rounded-md cursor-pointer transition-colors font-medium ${confirmButtonColor}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PopupModal;