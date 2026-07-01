import { useMemo } from "react";
import Fuse from "fuse.js";

// Builds a Fuse.js index over the full searchable surface of a template list
// — name/description/category/version/models plus a recursive walk of
// defaultSections (sectionName/stageName/checkPoint/method/specification) —
// and returns the filtered+ranked subset matching `query`. Shared by
// TemplateList.jsx and TemplateApproval.jsx, which previously each had their
// own near-identical substring filter limited to name/description/category.
export const useTemplateSearch = (templates, query) => {
  const indexed = useMemo(() => {
    return (templates || []).map((t) => {
      const sectionText = (t.defaultSections || [])
        .flatMap((sec) => [
          sec.sectionName,
          ...(sec.stages || []).flatMap((st) => [
            st.stageName,
            ...(st.checkPoints || []).flatMap((cp) => [cp.checkPoint, cp.method, cp.specification]),
          ]),
        ])
        .filter(Boolean)
        .join(" ");
      const modelsText = Array.isArray(t.models) ? t.models.join(" ") : "";
      return { ...t, _searchBlob: sectionText, _modelsBlob: modelsText };
    });
  }, [templates]);

  const fuse = useMemo(
    () =>
      new Fuse(indexed, {
        keys: [
          { name: "name", weight: 0.35 },
          { name: "description", weight: 0.15 },
          { name: "category", weight: 0.1 },
          { name: "version", weight: 0.05 },
          { name: "_modelsBlob", weight: 0.15 },
          { name: "_searchBlob", weight: 0.2 },
        ],
        threshold: 0.35,
        ignoreLocation: true,
        minMatchCharLength: 2,
      }),
    [indexed],
  );

  return useMemo(() => {
    const q = (query || "").trim();
    if (!q) return templates || [];
    return fuse.search(q).map((r) => r.item);
  }, [fuse, query, templates]);
};

export default useTemplateSearch;
