// ──────────────────────────────────────────────────────────────────────────
// Barrel export for the module's shared UI primitives. Lets pages write:
//   import { Modal, StatusBadge, KpiCard, TH, TD } from "../components/common";
// instead of one import line per file.
// ──────────────────────────────────────────────────────────────────────────

export { Modal, ConfirmModal, ModalCloseBtn } from "./Modal";
export { TableContainer, TH, TD, TableEmptyRow, ClickableRow } from "./Table";
export { StatusBadge } from "./StatusBadge";
export { KpiCard, ProgressBar, StackedBar } from "./KpiCard";
export { EmptyState, SkeletonBlock, KpiSkeletonRow, CardSkeleton, TableSkeleton } from "./Feedback";
export { PageHeader } from "./PageHeader";
export { SecondaryButton } from "./SecondaryButton";
