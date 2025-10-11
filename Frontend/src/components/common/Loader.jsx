const Loader = () => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white/30 backdrop-blur-xs z-50">
      <div className="w-16 h-16 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
    </div>
  );
};

export default Loader;
