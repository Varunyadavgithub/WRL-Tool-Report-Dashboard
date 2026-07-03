// ──────────────────────────────────────────────────────────────────────────
// History action/status tokens — extracted out of TemplateHistoryPanel.jsx
// so both the compact inline panel (TemplateList/TemplateApproval/
// TemplateBuilder) and the new standalone TemplateChangeLog page render the
// exact same labels/colors for the same action. Values are unchanged from
// the original inline definitions — this is a relocation, not a redesign.
// ──────────────────────────────────────────────────────────────────────────

export const ACTION_CFG = {
  created: { label: "Created", color: "text-indigo-600", dot: "bg-indigo-400", type: "new" },
  updated: { label: "Updated", color: "text-blue-600", dot: "bg-blue-400", type: "edit" },
  submitted_for_approval: { label: "Submitted for Approval", color: "text-amber-600", dot: "bg-amber-400", type: "edit" },
  status_changed: { label: "Status Changed", color: "text-violet-600", dot: "bg-violet-400", type: "edit" },
  approved: { label: "Approved", color: "text-green-600", dot: "bg-green-500", type: "edit" },
  rejected: { label: "Rejected", color: "text-red-600", dot: "bg-red-500", type: "edit" },
  deleted: { label: "Deleted", color: "text-gray-500", dot: "bg-gray-400", type: "edit" },
  re_drafted: { label: "Re-drafted (was Approved)", color: "text-orange-600", dot: "bg-orange-400", type: "edit" },
  version_created: { label: "New Version Created", color: "text-blue-600", dot: "bg-blue-400", type: "edit" },
  duplicated_as_new: { label: "Duplicated as New Template", color: "text-indigo-600", dot: "bg-indigo-400", type: "new" },
  duplicated_as_version: { label: "Version Created via Duplicate", color: "text-blue-600", dot: "bg-blue-400", type: "edit" },
};

export const DEFAULT_ACTION_CFG = ACTION_CFG.updated;
export const getActionConfig = (action) => ACTION_CFG[action?.toLowerCase()] || DEFAULT_ACTION_CFG;

export const STATUS_LABELS = {
  draft: { label: "Draft", cls: "bg-gray-100 text-gray-700 border-gray-300" },
  pending_approval: { label: "Pending", cls: "bg-amber-100 text-amber-700 border-amber-300" },
  approved: { label: "Approved", cls: "bg-green-100 text-green-700 border-green-300" },
  rejected: { label: "Rejected", cls: "bg-red-100 text-red-700 border-red-300" },
};

export const DEFAULT_STATUS_LABEL = { label: "Not Set", cls: "bg-slate-100 text-slate-600 border-slate-200" };
export const getHistoryStatusConfig = (status) => STATUS_LABELS[status] || DEFAULT_STATUS_LABEL;

/** The distinct action "families" used to power a filter control on the full Change Log page. */
export const ACTION_FILTERS = [
  { value: "all", label: "All activity" },
  { value: "created", label: "Created" },
  { value: "updated", label: "Updated" },
  { value: "submitted_for_approval", label: "Submitted for approval" },
  { value: "status_changed", label: "Status changed" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "version_created", label: "New version" },
];
