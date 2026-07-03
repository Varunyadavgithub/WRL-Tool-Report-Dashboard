// ──────────────────────────────────────────────────────────────────────────
// Backward-compatible re-export.
//
// This file used to contain the actual component definitions. They've now
// moved to components/common/* as part of the module-wide restructuring
// (see components/common/index.js for the full shared UI library — Modal,
// StatusBadge, KpiCard, table primitives, empty states, skeletons, etc).
//
// This barrel is kept in place, unchanged in behavior, purely so that
// TemplateList.jsx / TemplateApproval.jsx (not yet migrated in this pass)
// keep working without modification. Once every page has been moved over to
// importing from "./components/common" directly, this file can be deleted.
// ──────────────────────────────────────────────────────────────────────────

export { Modal, ConfirmModal, ModalCloseBtn } from "./components/common/Modal";
export { TH, TD } from "./components/common/Table";
export { StatusBadge } from "./components/common/StatusBadge";
