import { useNavigate } from "react-router-dom";
import {
  Package2, Clock, TimerOff, ShieldCheck, Cpu, CalendarRange,
  Mail, Users, FileText, Plug, BarChart2, ChevronRight,
  CheckCircle2, AlertCircle, Settings2,
} from "lucide-react";

// ── Section card definitions ───────────────────────────────────────────────────
const SECTIONS = [
  {
    key: "material",
    icon: Package2,
    title: "Material Configuration",
    desc: "SAP codes, part masters, cycle times, drawing revisions & version control",
    path: "/master-config/material",
    count: 0,
    countLabel: "Materials",
    color: { bg: "bg-blue-50", icon: "text-blue-600", border: "border-blue-200", badge: "bg-blue-100 text-blue-700" },
    tags: ["SAP Code", "Cycle Time", "Drawing", "UOM"],
    status: "configured",
  },
  {
    key: "shift",
    icon: Clock,
    title: "Shift Configuration",
    desc: "Shift timings, breaks, weekly offs, holiday calendar & rotational scheduling",
    path: "/master-config/shift",
    count: 0,
    countLabel: "Shifts",
    color: { bg: "bg-emerald-50", icon: "text-emerald-600", border: "border-emerald-200", badge: "bg-emerald-100 text-emerald-700" },
    tags: ["Timings", "Breaks", "Holiday", "OEE"],
    status: "configured",
  },
  {
    key: "downtime",
    icon: TimerOff,
    title: "Downtime Configuration",
    desc: "Downtime categories, reason codes, escalation rules & Pareto tracking",
    path: "/master-config/downtime",
    count: 0,
    countLabel: "Reason Codes",
    color: { bg: "bg-rose-50", icon: "text-rose-600", border: "border-rose-200", badge: "bg-rose-100 text-rose-700" },
    tags: ["Categories", "Escalation", "Pareto", "Planned"],
    status: "configured",
  },
  {
    key: "quality",
    icon: ShieldCheck,
    title: "Quality Configuration",
    desc: "Defect codes, categories, severity levels, CAPA tracking & inspection stages",
    path: "/master-config/quality",
    count: 0,
    countLabel: "Defect Codes",
    color: { bg: "bg-violet-50", icon: "text-violet-600", border: "border-violet-200", badge: "bg-violet-100 text-violet-700" },
    tags: ["Defect Codes", "CAPA", "Severity", "Rework"],
    status: "configured",
  },
  {
    key: "machine",
    icon: Cpu,
    title: "Machine Configuration",
    desc: "Machine masters, IP addresses, controller types, API endpoints & health monitoring",
    path: "/master-config/machine",
    count: 0,
    countLabel: "Machines",
    color: { bg: "bg-cyan-50", icon: "text-cyan-600", border: "border-cyan-200", badge: "bg-cyan-100 text-cyan-700" },
    tags: ["FANUC", "PLC", "IP Address", "API"],
    status: "configured",
  },
  {
    key: "planning",
    icon: CalendarRange,
    title: "Planning Configuration",
    desc: "Production plan upload, shift-wise targets, plan vs actual & backlog tracking",
    path: "/master-config/planning",
    count: 0,
    countLabel: "Plans",
    color: { bg: "bg-amber-50", icon: "text-amber-600", border: "border-amber-200", badge: "bg-amber-100 text-amber-700" },
    tags: ["Target", "Plan Upload", "Backlog", "Shift-wise"],
    status: "configured",
  },
  {
    key: "mail",
    icon: Mail,
    title: "Mail & Notifications",
    desc: "Email subscriptions, report scheduling, WhatsApp/SMS alerts & mailing groups",
    path: "/master-config/mail",
    count: 0,
    countLabel: "Subscribers",
    color: { bg: "bg-sky-50", icon: "text-sky-600", border: "border-sky-200", badge: "bg-sky-100 text-sky-700" },
    tags: ["Email", "WhatsApp", "Schedule", "Groups"],
    status: "configured",
  },
  {
    key: "audit",
    icon: FileText,
    title: "Audit Trail",
    desc: "Complete configuration change history, rollback options & user activity logs",
    path: "/master-config/audit",
    count: 0,
    countLabel: "Log Entries",
    color: { bg: "bg-slate-50", icon: "text-slate-600", border: "border-slate-300", badge: "bg-slate-100 text-slate-700" },
    tags: ["Change Log", "Rollback", "Activity", "History"],
    status: "configured",
  },
];

const STATS = [
  { label: "Total Materials",    value: 0,  color: "text-blue-600",   bg: "bg-blue-50"    },
  { label: "Active Machines",    value: 0,  color: "text-cyan-600",   bg: "bg-cyan-50"    },
  { label: "Shifts Configured",  value: 0,  color: "text-emerald-600",bg: "bg-emerald-50" },
  { label: "Downtime Reasons",   value: 0,  color: "text-rose-600",   bg: "bg-rose-50"    },
  { label: "Quality Defect Codes",value: 0, color: "text-violet-600", bg: "bg-violet-50"  },
  { label: "Mail Subscribers",   value: 0,  color: "text-sky-600",    bg: "bg-sky-50"     },
];

// ── Main ──────────────────────────────────────────────────────────────────────
const MasterConfigOverview = () => {
  const navigate = useNavigate();

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* HEADER */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm shrink-0">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 shadow-sm shadow-blue-300">
              <Settings2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 leading-none">Master Configuration</h1>
              <p className="text-[11px] text-slate-400 mt-0.5">Production Monitoring System — Configuration Center</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
              <CheckCircle2 className="w-3 h-3" /> System Active
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 px-6 pb-3 overflow-x-auto">
          {STATS.map((s) => (
            <div key={s.label} className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg ${s.bg} shrink-0`}>
              <span className={`text-lg font-bold font-mono ${s.color}`}>{s.value}</span>
              <span className="text-[10px] text-slate-500 font-medium leading-tight max-w-[70px]">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-auto p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const c = sec.color;
            return (
              <div
                key={sec.key}
                className={`bg-white rounded-2xl border ${c.border} shadow-sm hover:shadow-md transition-all duration-200 group cursor-pointer flex flex-col`}
                onClick={() => navigate(sec.path)}
              >
                {/* Card header */}
                <div className="p-5 pb-3 flex items-start justify-between">
                  <div className={`p-2.5 rounded-xl ${c.bg}`}>
                    <Icon className={`w-5 h-5 ${c.icon}`} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.badge}`}>
                      {sec.count} {sec.countLabel}
                    </span>
                  </div>
                </div>

                {/* Card body */}
                <div className="px-5 pb-4 flex-1">
                  <h3 className="text-sm font-bold text-slate-800 mb-1 group-hover:text-blue-600 transition-colors">
                    {sec.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{sec.desc}</p>
                </div>

                {/* Tags */}
                <div className="px-5 pb-4 flex flex-wrap gap-1.5">
                  {sec.tags.map((tag) => (
                    <span key={tag} className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Card footer */}
                <div className={`border-t ${c.border} px-5 py-3 flex items-center justify-between`}>
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                    <CheckCircle2 className="w-3 h-3" /> Ready to configure
                  </span>
                  <span className={`flex items-center gap-1 text-[11px] font-semibold ${c.icon} group-hover:gap-2 transition-all`}>
                    Open <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}

          {/* Future Enhancements Card */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700 shadow-sm flex flex-col justify-between p-5 col-span-1">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Upcoming</span>
              </div>
              <h3 className="text-sm font-bold text-white mb-2">Future Enhancements</h3>
              <div className="flex flex-col gap-1.5 mt-3">
                {[
                  "AI-based Production Forecasting",
                  "Predictive Maintenance",
                  "Vision Camera Integration",
                  "Digital Andon System",
                  "Power BI Integration",
                  "Multi-Plant Monitoring",
                  "SPC (Statistical Process Control)",
                ].map((item) => (
                  <span key={item} className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="w-1 h-1 rounded-full bg-slate-600 shrink-0" /> {item}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-700">
              <span className="text-[10px] text-slate-500">Planned for future releases</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MasterConfigOverview;
