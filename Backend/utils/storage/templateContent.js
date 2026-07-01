import { computeTemplateHash, computeTemplateStats } from "./templateIntegrity.js";

// SQL row (AuditTemplateContent) -> the {headerConfig, infoFields, columns,
// defaultSections} shape every other part of the app (diff engine, schema
// validator, builder UI, audit snapshot) already expects.
export const assembleContent = (contentRow) => ({
  headerConfig: JSON.parse(contentRow.HeaderConfig || "{}"),
  infoFields: JSON.parse(contentRow.InfoFields || "[]"),
  columns: JSON.parse(contentRow.Columns || "[]"),
  defaultSections: JSON.parse(contentRow.DefaultSections || "[]"),
});

// Payload -> canonical JSON strings + hash + stats, ready to INSERT into
// AuditTemplateContent. Hash/stats are computed over the canonical
// serialization itself (never re-read back from SQL), same "compute once at
// write time" discipline saveNewTemplateVersion used for JSON files.
export const disassembleContent = ({ headerConfig, infoFields, columns, defaultSections }) => {
  const safeHeaderConfig = headerConfig ?? {};
  const safeInfoFields = infoFields ?? [];
  const safeColumns = columns ?? [];
  const safeDefaultSections = defaultSections ?? [];

  const canonical = JSON.stringify(
    {
      headerConfig: safeHeaderConfig,
      infoFields: safeInfoFields,
      columns: safeColumns,
      defaultSections: safeDefaultSections,
    },
    null,
    2,
  );

  return {
    headerConfigJson: JSON.stringify(safeHeaderConfig),
    infoFieldsJson: JSON.stringify(safeInfoFields),
    columnsJson: JSON.stringify(safeColumns),
    defaultSectionsJson: JSON.stringify(safeDefaultSections),
    hash: computeTemplateHash(canonical),
    sizeBytes: Buffer.byteLength(canonical, "utf8"),
    stats: computeTemplateStats({ defaultSections: safeDefaultSections }),
  };
};
