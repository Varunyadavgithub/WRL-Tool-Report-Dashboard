import { useState } from "react";
import Title from "../../components/common/Title";
import Button from "../../components/common/Button";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useDispatch } from "react-redux";
import { setAuthUser } from "../../redux/authSlice.js";
import { assets } from "../../assets/assets.js";
import { FaEye, FaEyeSlash } from "react-icons/fa";

const baseURL = import.meta.env.VITE_API_BASE_URL;

const Login = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    empcod: "",
    password: "",
  });
  const [showPass, setShowPass] = useState(false);

  const dispatch = useDispatch();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.empcod || !formData.password) {
      toast.error("Please fill in both Employee Code and Password");
      return;
    }

    setLoading(true);

    try {
      const res = await axios.post(
        `${baseURL}auth/login`,
        { empcod: formData.empcod, password: formData.password },
        {
          withCredentials: true,
        }
      );
      if (res?.data?.success) {
        dispatch(setAuthUser(res?.data?.user));
        toast.success("Login successful");
        navigate("/");
      } else {
        console.warn("Login response:", res.data);
        toast.error(res.data.message || "Login failed");
      }
    } catch (err) {
      console.error("Login failed:", err);
      toast.error(
        err.response?.data?.message || "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="flex flex-col items-center justify-center">
          <img
            src={assets.logo}
            alt="Western Logo"
            className="h-10 w-auto mr-3"
          />
          <h1 className="text-2xl font-bold text-blue-800 tracking-wide">
            Western Refrigeration Pvt.Ltd
          </h1>
        </div>
        <div className="bg-white p-8 rounded-lg shadow w-96">
          <Title
            title="Login"
            subTitle="Access your dashboard based on your role"
          />

          <form onSubmit={handleSubmit} className="mt-2">
            <div className="mb-4">
              <label className="block text-md font-semibold text-gray-700 mb-1">
                Employee Code
              </label>
              <input
                type="text"
                placeholder="Enter your employee code"
                value={formData.empcod}
                onChange={handleChange}
                name="empcod"
                className="w-full px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="mb-4">
              <label className="block text-md font-semibold text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  name="password"
                  className="w-full px-2 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-800 cursor-pointer"
                >
                  {showPass ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                </span>
              </div>
            </div>

            <Button type="submit" className="w-full mt-6" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
