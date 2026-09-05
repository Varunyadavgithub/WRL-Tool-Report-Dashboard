import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { assets, baseURL } from "../assets/assets";
import { Link, useNavigate } from "react-router-dom";
import { FiLogOut, FiKey } from "react-icons/fi";
import axios from "axios";
import { logoutUser } from "../redux/slices/authSlice.js";
import toast from "react-hot-toast";
import ChangePasswordModal from "./ChangePasswordModal.jsx";

const NavBar = () => {
  const { user } = useSelector((store) => store.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [showChangePassword, setShowChangePassword] = useState(false);

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
          <button
            onClick={() => setShowChangePassword(true)}
            title="Change Password"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 text-xs md:text-sm font-semibold hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
          >
            <FiKey size={16} />
            <span className="hidden sm:inline">Change Password</span>
          </button>

          <div className="w-10 h-10 md:w-12 md:h-12 bg-gray-700 rounded-full flex items-center justify-center text-lg md:text-xl font-bold text-white flex-shrink-0">
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="hidden sm:block">
            <div className="text-black font-semibold font-playfair text-sm md:text-base">
              {user.name}
            </div>
            <div
              className={`${
                user.roleName === "admin" ? "text-red-500" : "text-gray-400"
              } text-xs md:text-sm`}
            >
              {user.roleName}
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

        {showChangePassword && (
          <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
        )}
      </div>
    </nav>
  );
};

export default NavBar;
