import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FaFileAlt,
  FaPlus,
  FaTrash,
  FaSave,
  FaArrowUp,
  FaArrowDown,
  FaEye,
  FaEyeSlash,
  FaColumns,
  FaTimes,
  FaCopy,
  FaGripVertical,
  FaInfoCircle,
  FaImage,
} from "react-icons/fa";
import { MdAddCircle, MdOutlineFactCheck } from "react-icons/md";
import { HiClipboardDocumentCheck } from "react-icons/hi2";
import useAuditData from "../../hooks/useAuditData";
import toast from "react-hot-toast";

const TemplateBuilder = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { createTemplate, updateTemplate, getTemplateById, loading, error } =
    useAuditData();

  const [showColumnManager, setShowColumnManager] = useState(false);
  const [showInfoFieldManager, setShowInfoFieldManager] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [newColumn, setNewColumn] = useState({ name: "" });

  // Template metadata
  const [templateMeta, setTemplateMeta] = useState({
    name: "",
    description: "",
    category: "",
    version: "1.0",
    isActive: true,
  });

  // Header configuration
  const [headerConfig, setHeaderConfig] = useState({
    showFormatNo: true,
    showRevNo: true,
    showRevDate: true,
    defaultFormatNo: "",
    defaultRevNo: "",
  });

  // Info fields configuration
  const [infoFields, setInfoFields] = useState([
    {
      id: "modelName",
      name: "Model Name",
      type: "text",
      required: true,
      visible: true,
    },
    {
      id: "date",
      name: "Date",
      type: "date",
      required: true,
      visible: true,
    },
    {
      id: "shift",
      name: "Shift",
      type: "select",
      required: true,
      visible: true,
      options: ["Day Shift", "Night Shift"],
    },
    {
      id: "serial",
      name: "Serial No.",
      type: "text",
      required: true,
      visible: true,
    },
  ]);

  // Dynamic columns configuration — Includes default Image column
  const [columns, setColumns] = useState([
    {
      id: "section",
      name: "Section",
      visible: true,
      required: true,
      width: "w-32",
      type: "text",
      isGroupColumn: true,
    },
    {
      id: "stage",
      name: "Stage",
      visible: true,
      required: true,
      width: "w-32",
      type: "text",
      isGroupColumn: true,
    },
    {
      id: "checkPoint",
      name: "Check Points",
      visible: true,
      required: false,
      width: "w-40",
      type: "text",
    },
    {
      id: "method",
      name: "Method of Inspection",
      visible: true,
      required: false,
      width: "w-40",
      type: "text",
    },
    {
      id: "specification",
      name: "Specifications",
      visible: true,
      required: false,
      width: "w-48",
      type: "text",
    },
    {
      id: "observation",
      name: "Observations",
      visible: true,
      required: false,
      width: "w-40",
      type: "text",
      entryField: true,
    },
    {
      id: "image",
      name: "Image",
      visible: true,
      required: false,
      width: "w-36",
      type: "image",
      entryField: true,
    },
    {
      id: "remark",
      name: "Remark",
      visible: true,
      required: false,
      width: "w-40",
      type: "text",
      entryField: true,
    },
    {
      id: "status",
      name: "Status",
      visible: true,
      required: false,
      width: "w-28",
      type: "status",
      entryField: true,
    },
  ]);

  // Section -> Multiple Stages -> Multiple Checkpoints
  const [defaultSections, setDefaultSections] = useState([
    {
      id: Date.now(),
      sectionName: "",
      stages: [
        {
          id: Date.now() + 1,
          stageName: "",
          checkPoints: [
            {
              id: Date.now() + 2,
              checkPoint: "",
              method: "",
              specification: "",
            },
          ],
        },
      ],
    },
  ]);

  // Load template if editing
  useEffect(() => {
    const loadTemplate = async () => {
      if (id) {
        setInitialLoading(true);
        try {
          const template = await getTemplateById(id);
          if (template) {
            setTemplateMeta({
              name: template.name || "",
              description: template.description || "",
              category: template.category || "",
              version: template.version || "1.0",
              isActive: template.isActive !== false,
            });
            if (template.headerConfig) setHeaderConfig(template.headerConfig);
            if (template.infoFields) setInfoFields(template.infoFields);
            if (template.columns) setColumns(template.columns);
            if (template.defaultSections) {
              const migratedSections = template.defaultSections.map(
                (section) => {
                  if (section.stages) {
                    return section;
                  }
                  return {
                    id: section.id,
                    sectionName: section.sectionName,
                    stages: [
                      {
                        id: Date.now() + Math.random(),
                        stageName: section.stageName || "",
                        checkPoints: section.checkPoints || [],
                      },
                    ],
                  };
                },
              );
              setDefaultSections(migratedSections);
            }
          }
        } catch (err) {
          toast.error("Failed to load template: " + err.message);
          navigate("/auditreport/templates");
        } finally {
          setInitialLoading(false);
        }
      }
    };

    loadTemplate();
  }, [id]);

  // Handle template meta change
  const handleMetaChange = (field, value) => {
    setTemplateMeta((prev) => ({ ...prev, [field]: value }));
  };

  // Handle section name change
  const handleSectionNameChange = (sectionId, value) => {
    setDefaultSections((prev) =>
      prev.map((section) =>
        section.id === sectionId ? { ...section, sectionName: value } : section,
      ),
    );
  };

  // Handle stage name change
  const handleStageNameChange = (sectionId, stageId, value) => {
    setDefaultSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              stages: section.stages.map((stage) =>
                stage.id === stageId ? { ...stage, stageName: value } : stage,
              ),
            }
          : section,
      ),
    );
  };

  // Handle checkpoint field change
  const handleCheckpointChange = (
    sectionId,
    stageId,
    checkpointId,
    field,
    value,
  ) => {
    setDefaultSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              stages: section.stages.map((stage) =>
                stage.id === stageId
                  ? {
                      ...stage,
                      checkPoints: stage.checkPoints.map((cp) =>
                        cp.id === checkpointId ? { ...cp, [field]: value } : cp,
                      ),
                    }
                  : stage,
              ),
            }
          : section,
      ),
    );
  };

  // Add new section
  const addSection = () => {
    const newSection = {
      id: Date.now(),
      sectionName: "",
      stages: [
        {
          id: Date.now() + 1,
          stageName: "",
          checkPoints: [
            {
              id: Date.now() + 2,
              checkPoint: "",
              method: "",
              specification: "",
            },
          ],
        },
      ],
    };
    setDefaultSections((prev) => [...prev, newSection]);
  };

  // Delete section
  const deleteSection = (sectionId) => {
    if (defaultSections.length > 1) {
      setDefaultSections((prev) =>
        prev.filter((section) => section.id !== sectionId),
      );
    }
  };

  // Duplicate section
  const duplicateSection = (sectionId) => {
    const sectionToDuplicate = defaultSections.find((s) => s.id === sectionId);
    if (sectionToDuplicate) {
      const newSection = {
        ...sectionToDuplicate,
        id: Date.now(),
        sectionName: `${sectionToDuplicate.sectionName} (Copy)`,
        stages: sectionToDuplicate.stages.map((stage) => ({
          ...stage,
          id: Date.now() + Math.random(),
          stageName: `${stage.stageName}`,
          checkPoints: stage.checkPoints.map((cp) => ({
            ...cp,
            id: Date.now() + Math.random(),
          })),
        })),
      };
      setDefaultSections((prev) => [...prev, newSection]);
    }
  };

  // Move section up/down
  const moveSection = (index, direction) => {
    const newSections = [...defaultSections];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex >= 0 && newIndex < defaultSections.length) {
      [newSections[index], newSections[newIndex]] = [
        newSections[newIndex],
        newSections[index],
      ];
      setDefaultSections(newSections);
    }
  };

  // Add new stage to section
  const addStage = (sectionId) => {
    const newStage = {
      id: Date.now(),
      stageName: "",
      checkPoints: [
        {
          id: Date.now() + 1,
          checkPoint: "",
          method: "",
          specification: "",
        },
      ],
    };
    setDefaultSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? { ...section, stages: [...section.stages, newStage] }
          : section,
      ),
    );
  };

  // Delete stage from section
  const deleteStage = (sectionId, stageId) => {
    setDefaultSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              stages:
                section.stages.length > 1
                  ? section.stages.filter((stage) => stage.id !== stageId)
                  : section.stages,
            }
          : section,
      ),
    );
  };

  // Duplicate stage
  const duplicateStage = (sectionId, stageId) => {
    setDefaultSections((prev) =>
      prev.map((section) => {
        if (section.id === sectionId) {
          const stageToDuplicate = section.stages.find((s) => s.id === stageId);
          if (stageToDuplicate) {
            const newStage = {
              ...stageToDuplicate,
              id: Date.now(),
              stageName: `${stageToDuplicate.stageName} (Copy)`,
              checkPoints: stageToDuplicate.checkPoints.map((cp) => ({
                ...cp,
                id: Date.now() + Math.random(),
              })),
            };
            return { ...section, stages: [...section.stages, newStage] };
          }
        }
        return section;
      }),
    );
  };

  // Move stage up/down within section
  const moveStage = (sectionId, stageIndex, direction) => {
    setDefaultSections((prev) =>
      prev.map((section) => {
        if (section.id === sectionId) {
          const newStages = [...section.stages];
          const newIndex = direction === "up" ? stageIndex - 1 : stageIndex + 1;
          if (newIndex >= 0 && newIndex < newStages.length) {
            [newStages[stageIndex], newStages[newIndex]] = [
              newStages[newIndex],
              newStages[stageIndex],
            ];
          }
          return { ...section, stages: newStages };
        }
        return section;
      }),
    );
  };

  // Add checkpoint to stage
  const addCheckpoint = (sectionId, stageId) => {
    setDefaultSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              stages: section.stages.map((stage) =>
                stage.id === stageId
                  ? {
                      ...stage,
                      checkPoints: [
                        ...stage.checkPoints,
                        {
                          id: Date.now(),
                          checkPoint: "",
                          method: "",
                          specification: "",
                        },
                      ],
                    }
                  : stage,
              ),
            }
          : section,
      ),
    );
  };

  // Delete checkpoint
  const deleteCheckpoint = (sectionId, stageId, checkpointId) => {
    setDefaultSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              stages: section.stages.map((stage) =>
                stage.id === stageId
                  ? {
                      ...stage,
                      checkPoints:
                        stage.checkPoints.length > 1
                          ? stage.checkPoints.filter(
                              (cp) => cp.id !== checkpointId,
                            )
                          : stage.checkPoints,
                    }
                  : stage,
              ),
            }
          : section,
      ),
    );
  };

  // Move checkpoint up/down
  const moveCheckpoint = (sectionId, stageId, index, direction) => {
    setDefaultSections((prev) =>
      prev.map((section) => {
        if (section.id === sectionId) {
          return {
            ...section,
            stages: section.stages.map((stage) => {
              if (stage.id === stageId) {
                const newCheckpoints = [...stage.checkPoints];
                const newIndex = direction === "up" ? index - 1 : index + 1;
                if (newIndex >= 0 && newIndex < newCheckpoints.length) {
                  [newCheckpoints[index], newCheckpoints[newIndex]] = [
                    newCheckpoints[newIndex],
                    newCheckpoints[index],
                  ];
                }
                return { ...stage, checkPoints: newCheckpoints };
              }
              return stage;
            }),
          };
        }
        return section;
      }),
    );
  };

  // Column management functions
  const addColumn = () => {
    if (newColumn.name.trim()) {
      const columnId =
        newColumn.name.toLowerCase().replace(/\s+/g, "_") + "_" + Date.now();
      setColumns((prev) => [
        ...prev,
        {
          id: columnId,
          name: newColumn.name,
          visible: true,
          required: false,
          width: "w-40",
          type: "text",
          entryField: false,
        },
      ]);
      setNewColumn({ name: "" });
    }
  };

  const toggleColumnVisibility = (columnId) => {
    setColumns((prev) =>
      prev.map((col) =>
        col.id === columnId && !col.required
          ? { ...col, visible: !col.visible }
          : col,
      ),
    );
  };

  const toggleColumnEntryField = (columnId) => {
    setColumns((prev) =>
      prev.map((col) =>
        col.id === columnId ? { ...col, entryField: !col.entryField } : col,
      ),
    );
  };

  const deleteColumn = (columnId) => {
    const column = columns.find((col) => col.id === columnId);
    if (column && !column.required) {
      setColumns((prev) => prev.filter((col) => col.id !== columnId));
    }
  };

  const moveColumn = (index, direction) => {
    const newColumns = [...columns];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex >= 0 && newIndex < columns.length) {
      [newColumns[index], newColumns[newIndex]] = [
        newColumns[newIndex],
        newColumns[index],
      ];
      setColumns(newColumns);
    }
  };

  const updateColumnName = (columnId, newName) => {
    setColumns((prev) =>
      prev.map((col) =>
        col.id === columnId ? { ...col, name: newName } : col,
      ),
    );
  };

  // Info field management
  const addInfoField = () => {
    const newField = {
      id: `field_${Date.now()}`,
      name: "New Field",
      type: "text",
      required: false,
      visible: true,
    };
    setInfoFields((prev) => [...prev, newField]);
  };

  const updateInfoField = (fieldId, updates) => {
    setInfoFields((prev) =>
      prev.map((field) =>
        field.id === fieldId ? { ...field, ...updates } : field,
      ),
    );
  };

  const deleteInfoField = (fieldId) => {
    setInfoFields((prev) => prev.filter((field) => field.id !== fieldId));
  };

  // Get visible columns
  const visibleColumns = columns.filter((col) => col.visible);

  // Calculate total checkpoints in a section
  const getSectionTotalCheckpoints = (section) => {
    return section.stages.reduce(
      (total, stage) => total + stage.checkPoints.length,
      0,
    );
  };

  // Save template
  const handleSave = async () => {
    if (!templateMeta.name.trim()) {
      toast.error("Please enter a template name");
      return;
    }

    setSaving(true);
    try {
      const templateData = {
        name: templateMeta.name,
        description: templateMeta.description,
        category: templateMeta.category,
        version: templateMeta.version,
        isActive: templateMeta.isActive,
        headerConfig,
        infoFields,
        columns,
        defaultSections,
      };

      if (id) {
        await updateTemplate(id, templateData);
        toast.success("Template updated successfully!");
      } else {
        await createTemplate(templateData);
        toast.success("Template created successfully!");
      }

      navigate("/auditreport/templates");
    } catch (error) {
      toast.error("Error saving template: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Loading state
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading template...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6 px-4">
      <div className="mx-auto">
        {/* Sticky Header */}
        <div className="sticky top-0 z-40 bg-gray-100/90 backdrop-blur border-b border-gray-200 shadow-sm p-4">
          <div className="mb-6 flex flex-wrap justify-between items-center gap-4">
            <div className="mb-6 flex flex-wrap justify-between items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <MdOutlineFactCheck className="text-green-600" />
                  {id ? "Edit Template" : "Create New Template"}
                </h1>
                <p className="text-gray-600 mt-1">
                  Build and customize audit templates with multiple stages per
                  section
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowInfoFieldManager(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-all text-sm"
              >
                <FaInfoCircle /> Info Fields
              </button>

              <button
                onClick={() => setShowColumnManager(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-all text-sm"
              >
                <FaColumns /> Table Columns
              </button>

              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <FaSave /> Save Template
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch py-6">
          {/* Template Meta Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col h-full hover:shadow-md transition">
            <h2 className="text-lg font-semibold text-gray-800 mb-5 flex items-center gap-2">
              <FaFileAlt className="text-blue-600" />
              Template Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={templateMeta.name}
                  onChange={(e) => handleMetaChange("name", e.target.value)}
                  placeholder="Enter template name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={templateMeta.category}
                  onChange={(e) => handleMetaChange("category", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Category</option>
                  <option value="process">Process Audit</option>
                  <option value="quality">Quality Audit</option>
                  <option value="safety">Safety Audit</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Version
                </label>
                <input
                  type="text"
                  value={templateMeta.version}
                  onChange={(e) => handleMetaChange("version", e.target.value)}
                  placeholder="1.0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={templateMeta.isActive}
                    onChange={(e) =>
                      handleMetaChange("isActive", e.target.checked)
                    }
                    className="w-5 h-5 text-blue-600 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Active Template
                  </span>
                </label>
              </div>

              <div className="md:col-span-2 lg:col-span-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={templateMeta.description}
                  onChange={(e) =>
                    handleMetaChange("description", e.target.value)
                  }
                  rows={3}
                  placeholder="Enter template description"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Header Config */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col h-full hover:shadow-md transition">
            <h2 className="text-lg font-semibold text-gray-800 mb-5 flex items-center gap-2">
              <FaFileAlt className="text-blue-600" />
              Header Configuration
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 flex-1">
              {[
                { label: "Show Format No", key: "showFormatNo" },
                { label: "Show Rev No", key: "showRevNo" },
                { label: "Show Rev Date", key: "showRevDate" },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-center gap-2 p-3 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={headerConfig[item.key]}
                    onChange={(e) =>
                      setHeaderConfig((prev) => ({
                        ...prev,
                        [item.key]: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">{item.label}</span>
                </label>
              ))}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Format No
                </label>
                <input
                  type="text"
                  value={headerConfig.defaultFormatNo}
                  onChange={(e) =>
                    setHeaderConfig((prev) => ({
                      ...prev,
                      defaultFormatNo: e.target.value,
                    }))
                  }
                  placeholder="QA-001"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Rev No
                </label>
                <input
                  type="text"
                  value={headerConfig.defaultRevNo}
                  onChange={(e) =>
                    setHeaderConfig((prev) => ({
                      ...prev,
                      defaultRevNo: e.target.value,
                    }))
                  }
                  placeholder="01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Info Fields Manager Modal */}
        {showInfoFieldManager && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
              <div className="p-4 bg-purple-600 text-white flex justify-between items-center">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <FaInfoCircle /> Manage Info Fields
                </h3>
                <button
                  onClick={() => setShowInfoFieldManager(false)}
                  className="p-1 hover:bg-purple-700 rounded"
                >
                  <FaTimes />
                </button>
              </div>
              <div className="p-4 max-h-[60vh] overflow-y-auto">
                <p className="text-sm text-gray-600 mb-4">
                  Configure the fields that appear in the header section (Model
                  Name, Date, Shift, Serial No., etc.)
                </p>
                <div className="space-y-3">
                  {infoFields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50"
                    >
                      <input
                        type="text"
                        value={field.name}
                        onChange={(e) =>
                          updateInfoField(field.id, {
                            name: e.target.value,
                          })
                        }
                        className="flex-1 px-2 py-1 border rounded text-sm"
                        placeholder="Field Name"
                      />
                      <select
                        value={field.type}
                        onChange={(e) =>
                          updateInfoField(field.id, {
                            type: e.target.value,
                          })
                        }
                        className="px-2 py-1 border rounded text-sm"
                      >
                        <option value="text">Text</option>
                        <option value="date">Date</option>
                        <option value="select">Select</option>
                        <option value="number">Number</option>
                        <option value="time">Time</option>
                      </select>
                      <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) =>
                            updateInfoField(field.id, {
                              required: e.target.checked,
                            })
                          }
                        />
                        Required
                      </label>
                      <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={field.visible}
                          onChange={(e) =>
                            updateInfoField(field.id, {
                              visible: e.target.checked,
                            })
                          }
                        />
                        Visible
                      </label>
                      <button
                        onClick={() => deleteInfoField(field.id)}
                        className="p-1 text-red-500 hover:text-red-700"
                      >
                        <FaTrash size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={addInfoField}
                  className="mt-4 flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm"
                >
                  <FaPlus /> Add Field
                </button>
              </div>
              <div className="p-4 bg-gray-50 border-t">
                <button
                  onClick={() => setShowInfoFieldManager(false)}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Column Manager Modal */}
        {showColumnManager && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
              <div className="p-4 bg-indigo-600 text-white flex justify-between items-center">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <FaColumns /> Manage Table Columns
                </h3>
                <button
                  onClick={() => setShowColumnManager(false)}
                  className="p-1 hover:bg-indigo-700 rounded"
                >
                  <FaTimes />
                </button>
              </div>
              <div className="p-4 max-h-[60vh] overflow-y-auto">
                {/* Add new column */}
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-700 mb-2">
                    Add New Column
                  </h4>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Column Name"
                      value={newColumn.name}
                      onChange={(e) =>
                        setNewColumn({
                          ...newColumn,
                          name: e.target.value,
                        })
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <button
                      onClick={addColumn}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium"
                    >
                      <FaPlus />
                    </button>
                  </div>
                </div>

                <p className="text-sm text-gray-600 mb-3">
                  <strong>Entry Field:</strong> Columns marked as "Entry Field"
                  will be filled during audit entry (e.g., Observations,
                  Remarks, Status, Image)
                </p>

                {/* Column list */}
                <div className="space-y-2">
                  {columns.map((column, index) => (
                    <div
                      key={column.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        column.visible
                          ? "bg-white border-gray-200"
                          : "bg-gray-100 border-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <FaGripVertical className="text-gray-400" />
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => moveColumn(index, "up")}
                            disabled={index === 0}
                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          >
                            <FaArrowUp size={10} />
                          </button>
                          <button
                            onClick={() => moveColumn(index, "down")}
                            disabled={index === columns.length - 1}
                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          >
                            <FaArrowDown size={10} />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={column.name}
                          onChange={(e) =>
                            updateColumnName(column.id, e.target.value)
                          }
                          disabled={column.required}
                          className={`font-medium bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none ${
                            column.visible ? "text-gray-800" : "text-gray-500"
                          } disabled:cursor-not-allowed`}
                        />
                        {column.required && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            Required
                          </span>
                        )}
                        {column.isGroupColumn && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                            Group
                          </span>
                        )}
                        {column.entryField && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                            Entry Field
                          </span>
                        )}
                        {column.type === "image" && (
                          <span className="text-xs bg-pink-100 text-pink-700 px-2 py-0.5 rounded flex items-center gap-1">
                            <FaImage size={10} /> Image
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={column.type || "text"}
                          onChange={(e) =>
                            setColumns((prev) =>
                              prev.map((col) =>
                                col.id === column.id
                                  ? { ...col, type: e.target.value }
                                  : col,
                              ),
                            )
                          }
                          className="text-xs px-2 py-1 border rounded"
                        >
                          <option value="text">Text</option>
                          <option value="number">Number</option>
                          <option value="status">Status</option>
                          <option value="date">Date</option>
                          <option value="image">Image</option>
                        </select>
                        <button
                          onClick={() => toggleColumnEntryField(column.id)}
                          className={`px-2 py-1 rounded text-xs ${
                            column.entryField
                              ? "bg-orange-100 text-orange-600"
                              : "bg-gray-100 text-gray-600"
                          }`}
                          title="Toggle Entry Field"
                        >
                          Entry
                        </button>
                        <button
                          onClick={() => toggleColumnVisibility(column.id)}
                          disabled={column.required}
                          className={`p-2 rounded ${
                            column.visible
                              ? "bg-green-100 text-green-600 hover:bg-green-200"
                              : "bg-gray-200 text-gray-500 hover:bg-gray-300"
                          } disabled:opacity-50`}
                        >
                          {column.visible ? (
                            <FaEye size={14} />
                          ) : (
                            <FaEyeSlash size={14} />
                          )}
                        </button>
                        {!column.required && (
                          <button
                            onClick={() => deleteColumn(column.id)}
                            className="p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded"
                          >
                            <FaTrash size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 bg-gray-50 border-t">
                <button
                  onClick={() => setShowColumnManager(false)}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Template Preview */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-800 text-white">
            <div className="flex items-center justify-center gap-3">
              <HiClipboardDocumentCheck className="text-3xl" />
              <h2 className="text-xl font-bold">
                {templateMeta.name || "Template Preview"}
              </h2>
            </div>
          </div>

          {/* Info about sections */}
          <div className="p-4 bg-blue-50 border-b flex items-start gap-2">
            <FaInfoCircle className="text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">
                Define your audit sections, stages, and checkpoints below.
              </p>
              <p>
                Each section can have multiple stages, and each stage can have
                multiple checkpoints. Fields marked as "Entry Field" will be
                filled by auditors during audit entry. Image columns allow
                uploading photos per checkpoint.
              </p>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-700 text-white">
                  {visibleColumns.map((column) => (
                    <th
                      key={column.id}
                      className={`px-3 py-3 text-left font-semibold border-r border-gray-600 text-sm ${
                        column.entryField ? "bg-gray-600" : ""
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        {/* Show image icon for image type columns */}
                        {column.type === "image" && (
                          <FaImage size={12} className="text-pink-300" />
                        )}
                        {column.name}
                        {column.entryField && (
                          <span className="text-xs text-orange-300">
                            (Entry)
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center font-semibold text-sm w-32">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {defaultSections.map((section, sectionIndex) => {
                  const sectionTotalRows = getSectionTotalCheckpoints(section);
                  let sectionRowRendered = false;

                  return section.stages.map((stage, stageIndex) => {
                    let stageRowRendered = false;

                    return stage.checkPoints.map(
                      (checkpoint, checkpointIndex) => {
                        const showSectionCell =
                          !sectionRowRendered && checkpointIndex === 0;
                        const showStageCell =
                          !stageRowRendered && checkpointIndex === 0;

                        if (showSectionCell) sectionRowRendered = true;
                        if (showStageCell) stageRowRendered = true;

                        return (
                          <tr
                            key={`${section.id}-${stage.id}-${checkpoint.id}`}
                            className="border-b border-gray-200 hover:bg-blue-50 transition-colors"
                          >
                            {visibleColumns.map((column) => {
                              // Section column
                              if (column.id === "section") {
                                if (showSectionCell) {
                                  return (
                                    <td
                                      key={column.id}
                                      className="px-3 py-2 font-bold bg-gray-100 border-r border-gray-300 align-top"
                                      rowSpan={sectionTotalRows}
                                    >
                                      <div className="flex flex-col gap-2">
                                        <input
                                          type="text"
                                          placeholder="Section Name"
                                          value={section.sectionName}
                                          onChange={(e) =>
                                            handleSectionNameChange(
                                              section.id,
                                              e.target.value,
                                            )
                                          }
                                          className="w-full text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded px-2 py-1 focus:border-blue-500 outline-none"
                                        />
                                        <div className="flex flex-wrap gap-1">
                                          <button
                                            onClick={() => addStage(section.id)}
                                            className="p-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded text-xs flex items-center gap-1"
                                            title="Add Stage"
                                          >
                                            <FaPlus size={10} />
                                            <span className="text-xs">
                                              Stage
                                            </span>
                                          </button>
                                          <button
                                            onClick={() =>
                                              duplicateSection(section.id)
                                            }
                                            className="p-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded text-xs"
                                            title="Duplicate Section"
                                          >
                                            <FaCopy size={10} />
                                          </button>
                                          <button
                                            onClick={() =>
                                              moveSection(sectionIndex, "up")
                                            }
                                            disabled={sectionIndex === 0}
                                            className="p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs disabled:opacity-50"
                                            title="Move Section Up"
                                          >
                                            <FaArrowUp size={10} />
                                          </button>
                                          <button
                                            onClick={() =>
                                              moveSection(sectionIndex, "down")
                                            }
                                            disabled={
                                              sectionIndex ===
                                              defaultSections.length - 1
                                            }
                                            className="p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs disabled:opacity-50"
                                            title="Move Section Down"
                                          >
                                            <FaArrowDown size={10} />
                                          </button>
                                          <button
                                            onClick={() =>
                                              deleteSection(section.id)
                                            }
                                            disabled={
                                              defaultSections.length <= 1
                                            }
                                            className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded text-xs disabled:opacity-50"
                                            title="Delete Section"
                                          >
                                            <FaTrash size={10} />
                                          </button>
                                        </div>
                                      </div>
                                    </td>
                                  );
                                }
                                return null;
                              }

                              // Stage column
                              if (column.id === "stage") {
                                if (showStageCell) {
                                  return (
                                    <td
                                      key={column.id}
                                      className="px-3 py-2 font-bold bg-indigo-50 border-r border-gray-300 align-top"
                                      rowSpan={stage.checkPoints.length}
                                    >
                                      <div className="flex flex-col gap-2">
                                        <input
                                          type="text"
                                          placeholder="Stage Name"
                                          value={stage.stageName || ""}
                                          onChange={(e) =>
                                            handleStageNameChange(
                                              section.id,
                                              stage.id,
                                              e.target.value,
                                            )
                                          }
                                          className="w-full text-sm font-bold text-indigo-700 bg-white border border-indigo-300 rounded px-2 py-1 focus:border-indigo-500 outline-none"
                                        />
                                        <div className="flex flex-wrap gap-1">
                                          <button
                                            onClick={() =>
                                              addCheckpoint(
                                                section.id,
                                                stage.id,
                                              )
                                            }
                                            className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded text-xs"
                                            title="Add Checkpoint"
                                          >
                                            <FaPlus size={10} />
                                          </button>
                                          <button
                                            onClick={() =>
                                              duplicateStage(
                                                section.id,
                                                stage.id,
                                              )
                                            }
                                            className="p-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded text-xs"
                                            title="Duplicate Stage"
                                          >
                                            <FaCopy size={10} />
                                          </button>
                                          <button
                                            onClick={() =>
                                              moveStage(
                                                section.id,
                                                stageIndex,
                                                "up",
                                              )
                                            }
                                            disabled={stageIndex === 0}
                                            className="p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs disabled:opacity-50"
                                            title="Move Stage Up"
                                          >
                                            <FaArrowUp size={10} />
                                          </button>
                                          <button
                                            onClick={() =>
                                              moveStage(
                                                section.id,
                                                stageIndex,
                                                "down",
                                              )
                                            }
                                            disabled={
                                              stageIndex ===
                                              section.stages.length - 1
                                            }
                                            className="p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs disabled:opacity-50"
                                            title="Move Stage Down"
                                          >
                                            <FaArrowDown size={10} />
                                          </button>
                                          <button
                                            onClick={() =>
                                              deleteStage(section.id, stage.id)
                                            }
                                            disabled={
                                              section.stages.length <= 1
                                            }
                                            className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded text-xs disabled:opacity-50"
                                            title="Delete Stage"
                                          >
                                            <FaTrash size={10} />
                                          </button>
                                        </div>
                                      </div>
                                    </td>
                                  );
                                }
                                return null;
                              }

                              // Image entry field — show image placeholder
                              if (
                                column.type === "image" &&
                                column.entryField
                              ) {
                                return (
                                  <td
                                    key={column.id}
                                    className="px-3 py-2 border-r border-gray-200 bg-orange-50"
                                  >
                                    <div className="flex flex-col items-center justify-center py-1">
                                      <FaImage
                                        className="text-gray-400 mb-1"
                                        size={16}
                                      />
                                      <span className="text-xs text-gray-400 italic">
                                        (Upload during audit)
                                      </span>
                                    </div>
                                  </td>
                                );
                              }

                              // Other entry fields — show placeholder
                              if (column.entryField) {
                                return (
                                  <td
                                    key={column.id}
                                    className="px-3 py-2 border-r border-gray-200 bg-orange-50"
                                  >
                                    <span className="text-xs text-gray-400 italic">
                                      (Filled during audit)
                                    </span>
                                  </td>
                                );
                              }

                              // Editable columns for template
                              return (
                                <td
                                  key={column.id}
                                  className="px-3 py-2 border-r border-gray-200"
                                >
                                  <input
                                    type="text"
                                    placeholder={column.name}
                                    value={checkpoint[column.id] || ""}
                                    onChange={(e) =>
                                      handleCheckpointChange(
                                        section.id,
                                        stage.id,
                                        checkpoint.id,
                                        column.id,
                                        e.target.value,
                                      )
                                    }
                                    className="w-full text-sm text-gray-700 bg-white border border-gray-300 rounded px-2 py-1 focus:border-blue-500 outline-none"
                                  />
                                </td>
                              );
                            })}

                            {/* Actions column */}
                            <td className="px-3 py-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() =>
                                    moveCheckpoint(
                                      section.id,
                                      stage.id,
                                      checkpointIndex,
                                      "up",
                                    )
                                  }
                                  disabled={checkpointIndex === 0}
                                  className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded text-xs disabled:opacity-50"
                                  title="Move Up"
                                >
                                  <FaArrowUp size={10} />
                                </button>
                                <button
                                  onClick={() =>
                                    moveCheckpoint(
                                      section.id,
                                      stage.id,
                                      checkpointIndex,
                                      "down",
                                    )
                                  }
                                  disabled={
                                    checkpointIndex ===
                                    stage.checkPoints.length - 1
                                  }
                                  className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded text-xs disabled:opacity-50"
                                  title="Move Down"
                                >
                                  <FaArrowDown size={10} />
                                </button>
                                <button
                                  onClick={() =>
                                    deleteCheckpoint(
                                      section.id,
                                      stage.id,
                                      checkpoint.id,
                                    )
                                  }
                                  disabled={stage.checkPoints.length <= 1}
                                  className="p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded text-xs disabled:opacity-50"
                                  title="Delete Row"
                                >
                                  <FaTrash size={10} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      },
                    );
                  });
                })}
              </tbody>
            </table>
          </div>

          {/* Add Section Button */}
          <div className="p-4 bg-gray-50 border-t border-gray-300">
            <button
              onClick={addSection}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all text-sm"
            >
              <MdAddCircle /> Add New Section
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateBuilder;
