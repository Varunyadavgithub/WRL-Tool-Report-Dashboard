import { useState } from "react";
import { FaExclamationTriangle, FaFileAlt } from "react-icons/fa";
import { Modal, ConfirmModal, ModalCloseBtn } from "../../_shared.jsx";

// Two-step name-collision dialog, reused for both "New Template" (mode:
// create -> "Edit Existing" on collision) and "Duplicate" (mode: duplicate
// -> "Create Version" on collision). Deliberately dumb about what a
// collision actually means — the parent supplies onCheck/onUnique/
// onConfirmExisting so each call site can wire up its own API calls and
// post-success navigation without this component knowing about routes.
//
// Step 1: enter a name, onCheck(name) decides unique vs. exists.
//   - unique  -> onUnique(name)
//   - exists  -> advance to step 2, showing existingActionLabel vs Cancel
// Step 2: onConfirmExisting(existingData) runs when the user confirms.
const NewTemplateNamePrompt = ({
  title,
  inputLabel = "Template Name",
  placeholder = "Enter template name",
  initialValue = "",
  onClose,
  onCheck,
  onUnique,
  onConfirmExisting,
  existingActionLabel = "Edit Existing",
}) => {
  const [name, setName] = useState(initialValue);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [collision, setCollision] = useState(null); // existing template data, or null
  const [confirming, setConfirming] = useState(false);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }
    setChecking(true);
    setError("");
    try {
      const result = await onCheck(trimmed);
      if (result.exists) {
        setCollision(result.data);
      } else {
        await onUnique(trimmed);
      }
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setChecking(false);
    }
  };

  const handleConfirmExisting = async () => {
    setConfirming(true);
    try {
      await onConfirmExisting(collision);
    } catch (err) {
      setError(err.message || "Something went wrong");
      setConfirming(false);
    }
  };

  if (collision) {
    return (
      <ConfirmModal
        onClose={onClose}
        onConfirm={handleConfirmExisting}
        confirming={confirming}
        icon={FaExclamationTriangle}
        tone="warning"
        title="Template Already Exists"
        subtitle={`An active template named "${name.trim()}" already exists.`}
        confirmLabel={existingActionLabel}
        confirmingLabel="Working…"
      >
        <p className="text-sm text-gray-600">
          Choose <strong>{existingActionLabel}</strong> to create a new version of the
          existing template, or Cancel to pick a different name.
        </p>
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </ConfirmModal>
    );
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-md">
      <div className="px-5 py-4 text-white bg-gradient-to-r from-indigo-600 to-indigo-700 flex items-center justify-between">
        <h3 className="text-base font-black flex items-center gap-2">
          <FaFileAlt size={13} /> {title}
        </h3>
        <ModalCloseBtn onClick={onClose} />
      </div>
      <form onSubmit={handleSubmit} className="p-6">
        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
          {inputLabel}
        </label>
        <input
          type="text"
          autoFocus
          value={name}
          onChange={(e) => { setName(e.target.value); setError(""); }}
          placeholder={placeholder}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </form>
      <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
        <button
          onClick={onClose}
          disabled={checking}
          className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={checking || !name.trim()}
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-all shadow-md shadow-indigo-200"
        >
          {checking ? "Checking…" : "Continue"}
        </button>
      </div>
    </Modal>
  );
};

export default NewTemplateNamePrompt;
