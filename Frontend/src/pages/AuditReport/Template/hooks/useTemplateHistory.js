// ──────────────────────────────────────────────────────────────────────────
// useTemplateHistory — fetches the full history/audit-trail for a template.
// Same underlying call as TemplateHistoryPanel (getTemplateHistory), but
// without the "only fetch once expanded" gating that panel needs — a
// standalone page always wants its data.
// ──────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import useAuditData from "../../../../hooks/useAuditData";

export default function useTemplateHistory(templateId) {
  const { getTemplateHistory } = useAuditData();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    return getTemplateHistory(templateId)
      .then((rows) => setHistory(rows || []))
      .catch((err) => toast.error("Failed to load change log: " + err.message))
      .finally(() => setLoading(false));
  }, [templateId, getTemplateHistory]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  return { history, loading, refresh: load };
}
