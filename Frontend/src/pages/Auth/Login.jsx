import { useState, useEffect } from "react";
import Title from "../../components/ui/Title";
import Button from "../../components/ui/Button";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useDispatch } from "react-redux";
import { setAuthUser } from "../../redux/slices/authSlice.js";
import { assets, baseURL } from "../../assets/assets.js";
import { FaEye, FaEyeSlash, FaUser, FaLock } from "react-icons/fa";

const industrialBackgrounds = [
  assets.industrialBg1,
  assets.industrialBg2,
  assets.industrialBg3,
];

const Login = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [loading, setLoading] = useState(false);
  const [currentBackground, setCurrentBackground] = useState(0);
  const [showPass, setShowPass] = useState(false);

  const [formData, setFormData] = useState({
    empcod: "",
    password: "",
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBackground((prev) => (prev + 1) % industrialBackgrounds.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

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
        {
          empcod: formData.empcod,
          password: formData.password,
        },
        {
          withCredentials: true,
        },
      );

      if (res?.data?.success) {
        dispatch(setAuthUser(res?.data?.user));
        toast.success("Login successful");
        navigate("/");
      } else {
        toast.error(res.data.message || "Login failed");
      }
    } catch (err) {
      console.error("Login failed:", err);
      toast.error(
        err.response?.data?.message || "Login failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left Side - Background Image */}
      <div
        className="w-1/2 bg-cover bg-center relative"
        style={{
          backgroundImage: `url(${industrialBackgrounds[currentBackground]})`,
          transition: "background-image 1s ease-in-out",
        }}
      >
        <div className="absolute inset-0 bg-black opacity-50"></div>

        <div className="absolute inset-0 flex flex-col justify-center items-center text-white p-8 text-center">
          <h1 className="text-5xl font-bold mb-4 font-playfair">
            Western Refrigeration Pvt.Ltd
          </h1>
          <p className="text-xl max-w-md font-playfair">
            Innovative Cooling Solutions for Modern Industries
          </p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-1/2 flex items-center justify-center bg-gray-100 p-8">
        <div className="w-full max-w-md bg-white shadow-xl rounded-lg p-8">
          <div className="flex flex-col items-center mb-8">
            <img
              src={assets.logo}
              alt="Western Logo"
              className="h-16 w-auto mb-2"
            />
            <Title
              title="Welcome Back"
              subTitle="Please enter your credentials to access your dashboard based on your role."
            />
          </div>

          <form onSubmit={handleSubmit} className="space-y-2">
            {/* Employee Code */}
            <div>
              <label className="block text-md font-semibold text-gray-700 mb-2">
                Employee Code
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  <FaUser />
                </span>
                <input
                  type="text"
                  name="empcod"
                  value={formData.empcod}
                  onChange={handleChange}
                  placeholder="Enter your employee code"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-md font-semibold text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  <FaLock />
                </span>
                <input
                  type={showPass ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 cursor-pointer"
                >
                  {showPass ? <FaEyeSlash /> : <FaEye />}
                </span>
              </div>
            </div>

            {/* Login Button */}
            <Button
              type="submit"
              className="w-full py-3 mt-2 shadow-md hover:shadow-lg"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Login"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
