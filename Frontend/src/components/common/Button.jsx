const Button = ({
  children,
  onClick,
  bgColor = "bg-blue-500",
  textColor = "text-white",
  padding = "px-4 py-2",
  borderRadius = "rounded-md",
  className = "",
  ...props
}) => {
  return (
    <button
      onClick={onClick}
      className={`${bgColor} ${textColor} ${padding} ${borderRadius} ${className} hover:opacity-90 focus:outline-none cursor-pointer`}
      {...props} // Spread the other props like 'type', 'disabled', etc.
    >
      {children}
    </button>
  );
};

export default Button;