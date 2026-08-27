/**
 * MailServerConfig.jsx — SMTP / outgoing-mail-server settings.
 * Not to be confused with Master Config > Mail Config (report subscribers) —
 * this page configures the actual mail *server* (host/port/user/password)
 * every report/alert email in the app is sent through, normally set via
 * .env (SMTP_HOST/PORT/USER/PASS). Saving here overrides those per-field in
 * the DB and reloads the live transporter immediately, no restart needed.
 */

import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import {
  Server, KeyRound, Mail, Send, RotateCcw, Save,
  Loader2, Lock, Eye, EyeOff, Info, CheckCircle2,
} from "lucide-react";
import toast from "react-hot-toast";
import { ROLES } from "../../config/routes.config.js";
import {
  useGetMailServerConfigQuery,
  useUpdateMailServerConfigMutation,
  useResetMailServerConfigMutation,
  useTestMailServerConfigMutation,
} from "../../redux/api/settingsApi.js";

const SUPER_ADMIN_ROLE = ROLES.SUPER_ADMIN;

const inputCls =
  "w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 placeholder-gray-300 transition-all bg-white";

const Field = ({ label, required, children, hint }) => (
  <div>
    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
      {label} {required && <span className="text-rose-500">*</span>}
    </label>
    {children}
    {hint && <p className="mt-1 text-[10px] text-gray-400 leading-snug">{hint}</p>}
  </div>
);

export default function MailServerConfig() {
  const { user } = useSelector((store) => store.auth);
  const userRole = user?.roleName?.toLowerCase?.() ?? "";

  const { data: config, isLoading, isFetching } = useGetMailServerConfigQuery(undefined, {
    skip: userRole !== SUPER_ADMIN_ROLE,
  });
  const [updateConfig, { isLoading: saving }] = useUpdateMailServerConfigMutation();
  const [resetConfig, { isLoading: resetting }] = useResetMailServerConfigMutation();
  const [testConfig, { isLoading: testing }] = useTestMailServerConfigMutation();

  const [form, setForm] = useState({ host: "", port: "", user: "", pass: "" });
  const [showPass, setShowPass] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  useEffect(() => {
    if (config) setForm({ host: config.host, port: config.port, user: config.user, pass: "" });
  }, [config]);

  if (userRole !== SUPER_ADMIN_ROLE) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
            <Lock className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Access Denied</h2>
          <p className="text-sm text-gray-400">Only Super Admin can manage mail server settings.</p>
        </div>
      </div>
    );
  }

  const sf = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.host.trim() || !form.port || !form.user.trim()) {
      toast.error("Host, Port and Username are required.");
      return;
    }
    try {
      await updateConfig(form).unwrap();
      toast.success("Mail server settings saved — live transporter reloaded.");
      setForm((f) => ({ ...f, pass: "" }));
    } catch (err) {
      toast.error(err?.data?.message || "Failed to save mail server settings.");
    }
  };

  const handleReset = async () => {
    try {
      await resetConfig().unwrap();
      toast.success("Reverted to .env defaults.");
      setShowConfirmReset(false);
    } catch (err) {
      toast.error(err?.data?.message || "Failed to reset.");
    }
  };

  const handleTest = async () => {
    if (!testTo.trim()) { toast.error("Enter a recipient email address."); return; }
    try {
      const res = await testConfig({ to: testTo.trim() }).unwrap();
      toast.success(res?.message || "Test email sent.", { duration: 6000 });
    } catch (err) {
      toast.error(err?.data?.message || "Failed to send test email.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0 gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900 leading-none">Mail Server Settings</h1>
          <p className="text-xs text-gray-400">SMTP configuration for all outgoing report/alert emails · Super Admin Only</p>
        </div>
        {config && (
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              config.overriddenInDb ? "bg-indigo-50 text-indigo-700" : "bg-gray-100 text-gray-500"
            }`}
          >
            {config.overriddenInDb ? "Custom (DB override)" : "Using .env defaults"}
          </span>
        )}
      </div>

      <div className="p-4 lg:p-6 max-w-2xl">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-indigo-50">
                  <Server className="w-4 h-4 text-indigo-600" />
                </div>
                <h2 className="text-sm font-bold text-gray-800">SMTP Server</h2>
                {isFetching && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-300" />}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <Field label="Host" required>
                    <input value={form.host} onChange={sf("host")} placeholder="e.g. smtp.example.com" className={inputCls} />
                  </Field>
                </div>
                <Field label="Port" required>
                  <input type="number" value={form.port} onChange={sf("port")} placeholder="587" className={inputCls} />
                </Field>
                <div className="sm:col-span-3">
                  <Field label="Username" required hint="Also used as the From address on outgoing emails.">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
                      <input value={form.user} onChange={sf("user")} placeholder="noreply@example.com" className={`${inputCls} pl-9`} />
                    </div>
                  </Field>
                </div>
                <div className="sm:col-span-3">
                  <Field
                    label="Password"
                    hint={
                      config?.passwordSet
                        ? "A password is currently configured — leave blank to keep it unchanged."
                        : "No password is currently configured."
                    }
                  >
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
                      <input
                        type={showPass ? "text" : "password"}
                        value={form.pass}
                        onChange={sf("pass")}
                        placeholder={config?.passwordSet ? "•••••••• (unchanged)" : "Enter password"}
                        className={`${inputCls} pl-9 pr-9`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                      >
                        {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </Field>
                </div>
              </div>

              {config?.updatedBy && config?.overriddenInDb && (
                <p className="mt-3 text-[10px] text-gray-400">
                  Last changed by <span className="font-semibold text-gray-500">{config.updatedBy}</span>
                  {config.updatedAt && ` on ${new Date(config.updatedAt).toLocaleString("en-IN")}`}
                </p>
              )}

              <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setShowConfirmReset(true)}
                  disabled={!config?.overriddenInDb || resetting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset to .env defaults
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-200 transition disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>

            {/* Send test email */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-1">
                <div className="p-2 rounded-lg bg-emerald-50">
                  <Send className="w-4 h-4 text-emerald-600" />
                </div>
                <h2 className="text-sm font-bold text-gray-800">Send Test Email</h2>
              </div>
              <p className="text-xs text-gray-400 mb-3 ml-11">
                Verify the current live configuration actually delivers before relying on it.
              </p>
              <div className="flex items-center gap-2 ml-11">
                <input
                  type="email"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  placeholder="you@example.com"
                  className={inputCls}
                />
                <button
                  onClick={handleTest}
                  disabled={testing}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200 transition disabled:opacity-50 shrink-0"
                >
                  {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  {testing ? "Sending…" : "Send Test"}
                </button>
              </div>
            </div>

            <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-blue-50 border border-blue-100">
              <Info className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-[11px] text-blue-700 leading-relaxed">
                Saving reloads the live SMTP connection immediately — every report, alert and notification email
                across the app switches over right away, no restart needed. Any field left as-is here falls back
                to the server's <code className="font-mono">.env</code> value.
              </p>
            </div>
          </div>
        )}
      </div>

      {showConfirmReset && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowConfirmReset(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 flex flex-col items-center text-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-50">
                <RotateCcw className="w-7 h-7 text-amber-600" />
              </div>
              <h2 className="text-base font-bold text-gray-900">Reset to .env defaults?</h2>
              <p className="text-sm text-gray-500">
                This clears the saved host, port, username and password override. The mail server will immediately
                switch back to whatever's in the backend's <code className="font-mono">.env</code> file.
              </p>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
              <button onClick={() => setShowConfirmReset(false)} className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100">
                Cancel
              </button>
              <button onClick={handleReset} disabled={resetting} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-sm shadow-amber-200 disabled:opacity-50">
                {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
