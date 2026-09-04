import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { KeyRound, Eye, EyeOff, X, Check, Loader2, ShieldCheck } from "lucide-react";
import { baseURL } from "../assets/assets";

const STRENGTH_LEVELS = [
  { label: "Too short", color: "bg-gray-300", text: "text-gray-400" },
  { label: "Weak", color: "bg-red-400", text: "text-red-500" },
  { label: "Fair", color: "bg-amber-400", text: "text-amber-500" },
  { label: "Good", color: "bg-blue-500", text: "text-blue-600" },
  { label: "Strong", color: "bg-emerald-500", text: "text-emerald-600" },
];

const getStrength = (pw) => {
  if (!pw || pw.length < 6) return 0;
  let score = 1;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
};

const PasswordField = ({ label, name, value, onChange, placeholder, show, onToggleShow, hint }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
      {label}
    </label>
    <div className="relative">
      <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      <input
        type={show ? "text" : "password"}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={name === "currentPassword" ? "current-password" : "new-password"}
        className="w-full pl-10 pr-10 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
      />
      <button
        type="button"
        onClick={onToggleShow}
        tabIndex={-1}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
    {hint}
  </div>
);

const ChangePasswordModal = ({ onClose }) => {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [show, setShow] = useState({ currentPassword: false, newPassword: false, confirmPassword: false });
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    const onKeyDown = (e) => e.key === "Escape" && handleClose();
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 150);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const toggleShow = (name) => setShow((prev) => ({ ...prev, [name]: !prev[name] }));

  const strength = useMemo(() => getStrength(form.newPassword), [form.newPassword]);
  const lengthOk = form.newPassword.length >= 6;
  const matchOk = form.newPassword.length > 0 && form.newPassword === form.confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { currentPassword, newPassword, confirmPassword } = form;

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all fields.");
      return;
    }
    if (!lengthOk) {
      toast.error("New password must be at least 6 characters.");
      return;
    }
    if (!matchOk) {
      toast.error("New password and confirmation do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(
        `${baseURL}auth/change-password`,
        { currentPassword, newPassword },
        { withCredentials: true },
      );
      toast.success(res?.data?.message || "Password changed successfully");
      handleClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to change password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-opacity duration-150 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onMouseDown={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        className={`w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden transition-all duration-150 ${
          visible ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-5 bg-gradient-to-br from-blue-600 to-blue-800 text-white">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
          <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center mb-3">
            <ShieldCheck size={22} />
          </div>
          <h3 className="text-lg font-bold leading-none">Change Password</h3>
          <p className="text-xs text-blue-100 mt-1.5">
            Update your account password. You'll keep using it to sign in next time.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <PasswordField
            label="Current Password"
            name="currentPassword"
            value={form.currentPassword}
            onChange={handleChange}
            placeholder="Enter current password"
            show={show.currentPassword}
            onToggleShow={() => toggleShow("currentPassword")}
          />

          <PasswordField
            label="New Password"
            name="newPassword"
            value={form.newPassword}
            onChange={handleChange}
            placeholder="Enter new password"
            show={show.newPassword}
            onToggleShow={() => toggleShow("newPassword")}
            hint={
              form.newPassword.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i < strength ? STRENGTH_LEVELS[strength].color : "bg-slate-150 bg-slate-200"
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-[11px] font-medium mt-1 ${STRENGTH_LEVELS[strength].text}`}>
                    {STRENGTH_LEVELS[strength].label}
                  </p>
                </div>
              )
            }
          />

          <PasswordField
            label="Confirm New Password"
            name="confirmPassword"
            value={form.confirmPassword}
            onChange={handleChange}
            placeholder="Re-enter new password"
            show={show.confirmPassword}
            onToggleShow={() => toggleShow("confirmPassword")}
          />

          {/* Requirements checklist */}
          <div className="flex flex-col gap-1.5 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2.5">
            <div className={`flex items-center gap-2 text-xs ${lengthOk ? "text-emerald-600" : "text-slate-400"}`}>
              <span
                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 ${
                  lengthOk ? "bg-emerald-100" : "bg-slate-200"
                }`}
              >
                {lengthOk && <Check size={9} strokeWidth={3} />}
              </span>
              At least 6 characters
            </div>
            <div className={`flex items-center gap-2 text-xs ${matchOk ? "text-emerald-600" : "text-slate-400"}`}>
              <span
                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 ${
                  matchOk ? "bg-emerald-100" : "bg-slate-200"
                }`}
              >
                {matchOk && <Check size={9} strokeWidth={3} />}
              </span>
              Passwords match
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-2.5 text-sm font-semibold rounded-lg text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading ? "Saving..." : "Save Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
