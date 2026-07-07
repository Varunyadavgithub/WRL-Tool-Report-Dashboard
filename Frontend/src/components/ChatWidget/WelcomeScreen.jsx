import { FiBox, FiActivity, FiClipboard, FiCheckCircle, FiTruck, FiTool, FiUsers } from "react-icons/fi";

// Grounded in the tools that actually exist today — don't advertise coverage
// (CPT, BEE, Planning, etc.) the assistant can't back up yet. Each group maps
// to real backend tools so "ask what he wants" starts from an accurate menu
// instead of a vague "ask me anything". Colors match the same blue/violet/
// emerald/orange/rose/cyan family the dashboard's own sidebar uses per module.
const GROUPS = [
  {
    icon: FiBox,
    label: "Production",
    hint: "Plant-wide (Final FG / Post-Foaming / Final Loading), or a specific line — Freezer, Chocolate, VISI Cooler, SUS. Ask for two lines together and I'll combine them.",
    prompts: ["Final FG production today", "Freezer + Chocolate Line FG Label today"],
    accent: { icon: "text-blue-600", chip: "border-blue-200 hover:border-blue-400 hover:text-blue-700 hover:bg-blue-50" },
  },
  {
    icon: FiActivity,
    label: "OEE & downtime",
    hint: "A separate tracking line — availability, performance, quality, and downtime reasons",
    prompts: ["Today's OEE and downtime", "Compare this week vs last week"],
    accent: { icon: "text-violet-600", chip: "border-violet-200 hover:border-violet-400 hover:text-violet-700 hover:bg-violet-50" },
  },
  {
    icon: FiCheckCircle,
    label: "Quality",
    hint: "FPA, LPT, EST, Gas Charging, or Rework — I'll ask which test if it's not clear",
    prompts: ["FPA defect summary today", "EST pass rate this week", "Gas charging pass rate today"],
    accent: { icon: "text-orange-600", chip: "border-orange-200 hover:border-orange-400 hover:text-orange-700 hover:bg-orange-50" },
  },
  {
    icon: FiTruck,
    label: "Dispatch",
    hint: "Units dispatched per model (depends on the WWMS server being reachable)",
    prompts: ["Dispatch summary today"],
    accent: { icon: "text-rose-600", chip: "border-rose-200 hover:border-rose-400 hover:text-rose-700 hover:bg-rose-50" },
  },
  {
    icon: FiTool,
    label: "Compliance",
    hint: "Instrument calibration status — overdue and due-soon counts",
    prompts: ["Calibration status"],
    accent: { icon: "text-cyan-600", chip: "border-cyan-200 hover:border-cyan-400 hover:text-cyan-700 hover:bg-cyan-50" },
  },
  {
    icon: FiUsers,
    label: "Visitors",
    hint: "Visitor counts and department breakdown",
    prompts: ["How many visitors today?"],
    accent: { icon: "text-amber-600", chip: "border-amber-200 hover:border-amber-400 hover:text-amber-700 hover:bg-amber-50" },
  },
  {
    icon: FiClipboard,
    label: "Audits",
    hint: "Submission/approval stats and per-template breakdown",
    prompts: ["Summarize this month's audits"],
    accent: { icon: "text-emerald-600", chip: "border-emerald-200 hover:border-emerald-400 hover:text-emerald-700 hover:bg-emerald-50" },
  },
];

const WelcomeScreen = ({ onPick }) => (
  <div className="flex-1 overflow-y-auto px-6 py-8">
    <h3 className="text-base font-semibold text-gray-800 mb-1">What would you like to know?</h3>
    <p className="text-sm text-gray-400 mb-6 max-w-md">
      There's more than one "production" data source in this app, several lines, and several quality tests — pick a
      section below, or ask in your own words and I'll check with you if it's not clear which one you mean.
    </p>

    <div className="flex flex-col gap-5">
      {GROUPS.map((group) => (
        <div key={group.label}>
          <div className="flex items-center gap-2 mb-1.5">
            <group.icon size={14} className={group.accent.icon} />
            <span className="text-sm font-medium text-gray-700">{group.label}</span>
          </div>
          <p className="text-xs text-gray-400 mb-2 ml-5">{group.hint}</p>
          <div className="flex flex-wrap gap-2 ml-5">
            {group.prompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => onPick(prompt)}
                className={`text-xs px-3 py-1.5 rounded-full border text-gray-600 transition-colors ${group.accent.chip}`}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default WelcomeScreen;
