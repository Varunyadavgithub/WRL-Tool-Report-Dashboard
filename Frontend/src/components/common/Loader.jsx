const Loader = () => {
  return (
    <div className="flex justify-center items-center space-x-2 p-12">
      <div className="w-4 h-4 bg-gray-400 rounded-full animate-bounce"></div>
      <div className="w-5 h-5 bg-gray-500 rounded-full animate-bounce animation-delay-100"></div>
      <div className="w-6 h-6 bg-gray-600 rounded-full animate-bounce animation-delay-200"></div>
    </div>
  );
};

export default Loader;