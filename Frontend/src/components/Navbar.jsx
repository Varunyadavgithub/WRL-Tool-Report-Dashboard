import { useSelector, useDispatch } from "react-redux";
import { assets, baseURL } from "../assets/assets";
import { Link, useNavigate } from "react-router-dom";
import { FiLogOut } from "react-icons/fi";
import axios from "axios";
import { logoutUser } from "../redux/slices/authSlice.js";
import toast from "react-hot-toast";

const NavBar = () => {
  const { user } = useSelector((store) => store.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await axios.post(`${baseURL}auth/logout`, {}, { withCredentials: true });
      dispatch(logoutUser());
      toast.success("Logout Successfully");
      navigate("/login");
    } catch (error) {
      console.error("Logout failed", error);
      toast.error("Logout failed. Please try again.");
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-white h-16 flex items-center px-4 shadow-sm border-b border-gray-200">
      <div className="w-full flex items-center justify-between">
        <Link to="/" className="flex items-center">
          <img
            src={assets.logo}
            alt="Western Logo"
            className="h-10 w-auto mr-3"
          />
          <h1 className="text-xl md:text-2xl font-bold text-blue-800 tracking-wide hidden sm:block">
            Western Refrigeration Pvt.Ltd
          </h1>
        </Link>
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-gray-700 rounded-full flex items-center justify-center text-lg md:text-xl font-bold text-white flex-shrink-0">
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="hidden sm:block">
            <div className="text-black font-semibold font-playfair text-sm md:text-base">
              {user.name}
            </div>
            <div
              className={`${
                user.role === "admin" ? "text-red-500" : "text-gray-400"
              } text-xs md:text-sm`}
            >
              {user.role}
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Logout"
            className="text-gray-600 hover:text-red-600 transition-colors cursor-pointer p-2"
          >
            <FiLogOut size={22} />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
