import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  FaCalendarAlt,
  FaClock,
  FaIdBadge,
  FaStickyNote,
  FaClipboardCheck,
  FaPlus,
  FaTrash,
  FaPrint,
  FaSave,
  FaCheckCircle,
  FaTimesCircle,
  FaExclamationTriangle,
  FaArrowLeft,
  FaArrowUp,
  FaArrowDown,
  FaPaperPlane,
  FaEye,
  FaEdit,
} from "react-icons/fa";
import {
  MdFormatListNumbered,
  MdUpdate,
  MdDateRange,
  MdAddCircle,
} from "react-icons/md";
import { HiClipboardDocumentCheck } from "react-icons/hi2";
import { BiSolidFactory } from "react-icons/bi";
import useAuditData from "../../hooks/useAuditData";

const AuditEntry = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get("template");

  const { getTemplateById, getAuditById, createAudit, updateAudit } =
    useAuditData();

  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // Audit header data
  const [auditData, setAuditData] = useState({
    templateId: "",
    templateName: "",
    reportName: "",
    formatNo: "",
    revNo: "",
    revDate: "",
    notes: "",
    status: "draft",
  });

  // Info fields data
  const [infoData, setInfoData] = useState({});

  // Sections data with checkpoints
  const [sections, setSections] = useState([]);

  // Load template or existing audit
  useEffect(() => {
    if (id) {
      // Editing existing audit
      const audit = getAuditById(id);
      if (audit) {
        setAuditData({
          templateId: audit.templateId || "",
          templateName: audit.templateName || "",
          reportName: audit.reportName || "",
          formatNo: audit.formatNo || "",
          revNo: audit.revNo || "",
          revDate: audit.revDate || "",
          notes: audit.notes || "",
          status: audit.status || "draft",
        });
        setInfoData(audit.infoData || {});
        setSections(audit.sections || []);

        // Load template for column config
        if (audit.templateId) {
          const tmpl = getTemplateById(audit.templateId);
          if (tmpl) {
            setTemplate(tmpl);
          } else {
            // Use stored config from audit if template not found
            setTemplate({
              columns: audit.columns,
              infoFields: audit.infoFields,
              headerConfig: audit.headerConfig,
            });
          }
        }
      }
    } else if (templateId) {
      // Creating new audit from template
      const tmpl = getTemplateById(templateId);
      if (tmpl) {
        setTemplate(tmpl);
        setAuditData({
          templateId: tmpl.id,
          templateName: tmpl.name,
          reportName: tmpl.name,
          formatNo: tmpl.headerConfig?.defaultFormatNo || "",
          revNo: tmpl.headerConfig?.defaultRevNo || "",
          revDate: new Date().toISOString().split("T")[0],
          notes: "",
          status: "draft",
        });

        // Initialize info fields
        const initialInfoData = {};
        tmpl.infoFields?.forEach((field) => {
          if (field.id === "date") {
            initialInfoData[field.id] = new Date().toISOString().split("T")[0];
          } else {
            initialInfoData[field.id] = "";
          }
        });
        setInfoData(initialInfoData);

        // Initialize sections from template
        const initialSections =
          tmpl.defaultSections?.map((section) => ({
            ...section,
            id: Date.now() + Math.random(),
            checkPoints: section.checkPoints.map((cp) => ({
              ...cp,
              id: Date.now() + Math.random(),
              observation: "",
              remark: "",
              status: "pending",
            })),
          })) || [];
        setSections(initialSections);
      }
    }
  }, [id, templateId, getTemplateById, getAuditById]);

  // Handle audit data change
  const handleAuditDataChange = (field, value) => {
    setAuditData((prev) => ({ ...prev, [field]: value }));
  };

  // Handle info field change
  const handleInfoChange = (fieldId, value) => {
    setInfoData((prev) => ({ ...prev, [fieldId]: value }));
  };

  // Handle section name change
  const handleSectionNameChange = (sectionId, value) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId ? { ...section, sectionName: value } : section,
      ),
    );
  };

  // Handle checkpoint field change
  const handleCheckpointChange = (sectionId, checkpointId, field, value) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              checkPoints: section.checkPoints.map((cp) =>
                cp.id === checkpointId ? { ...cp, [field]: value } : cp,
              ),
            }
          : section,
      ),
    );
  };

  // Add checkpoint to section
  const addCheckpoint = (sectionId) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              checkPoints: [
                ...section.checkPoints,
                {
                  id: Date.now(),
                  checkPoint: "",
                  method: "",
                  specification: "",
                  observation: "",
                  remark: "",
                  status: "pending",
                },
              ],
            }
          : section,
      ),
    );
  };

  // Delete checkpoint
  const deleteCheckpoint = (sectionId, checkpointId) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              checkPoints:
                section.checkPoints.length > 1
                  ? section.checkPoints.filter((cp) => cp.id !== checkpointId)
                  : section.checkPoints,
            }
          : section,
      ),
    );
  };

  // Move checkpoint
  const moveCheckpoint = (sectionId, index, direction) => {
    setSections((prev) =>
      prev.map((section) => {
        if (section.id === sectionId) {
          const newCheckpoints = [...section.checkPoints];
          const newIndex = direction === "up" ? index - 1 : index + 1;
          if (newIndex >= 0 && newIndex < newCheckpoints.length) {
            [newCheckpoints[index], newCheckpoints[newIndex]] = [
              newCheckpoints[newIndex],
              newCheckpoints[index],
            ];
          }
          return { ...section, checkPoints: newCheckpoints };
        }
        return section;
      }),
    );
  };

  // Add new section
  const addSection = () => {
    const newSection = {
      id: Date.now(),
      sectionName: "New Section",
      checkPoints: [
        {
          id: Date.now(),
          checkPoint: "",
          method: "",
          specification: "",
          observation: "",
          remark: "",
          status: "pending",
        },
      ],
    };
    setSections((prev) => [...prev, newSection]);
  };

  // Delete section
  const deleteSection = (sectionId) => {
    if (sections.length > 1) {
      setSections((prev) => prev.filter((section) => section.id !== sectionId));
    }
  };

  // Move section
  const moveSection = (index, direction) => {
    const newSections = [...sections];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex >= 0 && newIndex < sections.length) {
      [newSections[index], newSections[newIndex]] = [
        newSections[newIndex],
        newSections[index],
      ];
      setSections(newSections);
    }
  };

  // Get visible columns from template
  const visibleColumns = template?.columns?.filter((col) => col.visible) || [];

  // Get status badge
  const getStatusBadge = (status) => {
    switch (status) {
      case "pass":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
            <FaCheckCircle /> Pass
          </span>
        );
      case "fail":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
            <FaTimesCircle /> Fail
          </span>
        );
      case "warning":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
            <FaExclamationTriangle /> Warning
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
            Pending
          </span>
        );
    }
  };

  // Calculate summary
  const getSummary = () => {
    let pass = 0,
      fail = 0,
      warning = 0,
      pending = 0;
    sections.forEach((section) => {
      section.checkPoints?.forEach((cp) => {
        if (cp.status === "pass") pass++;
        else if (cp.status === "fail") fail++;
        else if (cp.status === "warning") warning++;
        else pending++;
      });
    });
    return {
      pass,
      fail,
      warning,
      pending,
      total: pass + fail + warning + pending,
    };
  };

  const summary = getSummary();

  // Save audit
  const handleSave = (asDraft = true) => {
    setSaving(true);
    try {
      const auditPayload = {
        ...auditData,
        infoData,
        sections,
        status: asDraft ? "draft" : "submitted",
        columns: template?.columns,
        infoFields: template?.infoFields,
        headerConfig: template?.headerConfig,
      };

      if (id) {
        updateAudit(id, auditPayload);
      } else {
        createAudit(auditPayload);
      }

      alert(
        asDraft ? "Audit saved as draft!" : "Audit submitted successfully!",
      );
      navigate("/auditreport/audits");
    } catch (error) {
      alert("Error saving audit: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // Get field icon
  const getFieldIcon = (fieldId) => {
    switch (fieldId) {
      case "modelName":
        return <BiSolidFactory className="text-lg text-indigo-600" />;
      case "date":
        return <FaCalendarAlt className="text-lg text-red-500" />;
      case "shift":
        return <FaClock className="text-lg text-orange-500" />;
      case "eid":
        return <FaIdBadge className="text-lg text-teal-600" />;
      default:
        return <FaClipboardCheck className="text-lg text-gray-500" />;
    }
  };

  // Render info field input
  const renderInfoFieldInput = (field) => {
    const value = infoData[field.id] || "";

    if (showPreview) {
      return (
        <span className="font-semibold text-gray-800">{value || "-"}</span>
      );
    }

    switch (field.type) {
      case "date":
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleInfoChange(field.id, e.target.value)}
            className="w-full font-semibold text-gray-800 bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none"
          />
        );
      case "select":
        return (
          <select
            value={value}
            onChange={(e) => handleInfoChange(field.id, e.target.value)}
            className="w-full font-semibold text-gray-800 bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none"
          >
            <option value="">Select {field.name}</option>
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
      case "number":
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleInfoChange(field.id, e.target.value)}
            placeholder={`Enter ${field.name}`}
            className="w-full font-semibold text-gray-800 bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none"
          />
        );
      case "time":
        return (
          <input
            type="time"
            value={value}
            onChange={(e) => handleInfoChange(field.id, e.target.value)}
            className="w-full font-semibold text-gray-800 bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none"
          />
        );
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleInfoChange(field.id, e.target.value)}
            placeholder={`Enter ${field.name}`}
            className="w-full font-semibold text-gray-800 bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none"
          />
        );
    }
  };

  if (!template && !id) {
    return (
      <div className="min-h-screen bg-gray-100 py-6 px-4 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            No Template Selected
          </h2>
          <button
            onClick={() => navigate("/auditreport/templates")}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Select a Template
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6 px-4 print:bg-white print:p-0">
      <div className="max-w-7xl mx-auto">
        {/* Action Buttons */}
        <div className="mb-4 flex flex-wrap justify-between items-center gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/auditreport/audits")}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-all"
            >
              <FaArrowLeft /> Back
            </button>
            <h1 className="text-xl font-bold text-gray-800">
              {id ? "Edit Audit" : "New Audit Entry"}
            </h1>
            {auditData.status && (
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  auditData.status === "draft"
                    ? "bg-gray-200 text-gray-700"
                    : auditData.status === "submitted"
                      ? "bg-blue-100 text-blue-700"
                      : auditData.status === "approved"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                }`}
              >
                {auditData.status.charAt(0).toUpperCase() +
                  auditData.status.slice(1)}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                showPreview
                  ? "bg-orange-600 hover:bg-orange-700 text-white"
                  : "bg-gray-600 hover:bg-gray-700 text-white"
              }`}
            >
              {showPreview ? <FaEdit /> : <FaEye />}
              {showPreview ? "Edit Mode" : "Preview"}
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-all text-sm"
            >
              <FaPrint /> Print
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all text-sm disabled:opacity-50"
            >
              <FaSave /> Save Draft
            </button>
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all text-sm disabled:opacity-50"
            >
              <FaPaperPlane /> Submit
            </button>
          </div>
        </div>

        {/* Main Report Container */}
        <div className="bg-white shadow-xl rounded-lg overflow-hidden border-2 border-gray-300 print:shadow-none print:border print:rounded-none">
          {/* Header Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 border-b-2 border-gray-300">
            {/* Left - Report Name */}
            <div className="md:col-span-2 bg-gradient-to-r from-blue-600 to-blue-800 p-6 print:bg-blue-700">
              <div className="text-center">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <HiClipboardDocumentCheck className="text-4xl text-white" />
                </div>
                {showPreview ? (
                  <h1 className="text-2xl md:text-3xl font-bold text-white">
                    {auditData.reportName || "Audit Report"}
                  </h1>
                ) : (
                  <input
                    type="text"
                    placeholder="Enter Report Name"
                    value={auditData.reportName}
                    onChange={(e) =>
                      handleAuditDataChange("reportName", e.target.value)
                    }
                    className="w-full text-2xl md:text-3xl font-bold text-white bg-transparent border-b-2 border-white/50 focus:border-white outline-none text-center placeholder-white/70"
                  />
                )}
                <p className="text-blue-200 text-sm mt-2">
                  Template: {auditData.templateName}
                </p>
              </div>
            </div>

            {/* Right - Format Info */}
            <div className="bg-gray-50 divide-y divide-gray-300">
              {template?.headerConfig?.showFormatNo !== false && (
                <div className="p-3 flex items-center gap-3">
                  <MdFormatListNumbered className="text-xl text-blue-600 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-xs text-gray-500 block">
                      Format No
                    </span>
                    {showPreview ? (
                      <span className="font-semibold text-gray-800">
                        {auditData.formatNo || "-"}
                      </span>
                    ) : (
                      <input
                        type="text"
                        placeholder="XXX"
                        value={auditData.formatNo}
                        onChange={(e) =>
                          handleAuditDataChange("formatNo", e.target.value)
                        }
                        className="w-full font-semibold text-gray-800 bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none"
                      />
                    )}
                  </div>
                </div>
              )}
              {template?.headerConfig?.showRevNo !== false && (
                <div className="p-3 flex items-center gap-3">
                  <MdUpdate className="text-xl text-green-600 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-xs text-gray-500 block">Rev. No</span>
                    {showPreview ? (
                      <span className="font-semibold text-gray-800">
                        {auditData.revNo || "-"}
                      </span>
                    ) : (
                      <input
                        type="text"
                        placeholder="XX"
                        value={auditData.revNo}
                        onChange={(e) =>
                          handleAuditDataChange("revNo", e.target.value)
                        }
                        className="w-full font-semibold text-gray-800 bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none"
                      />
                    )}
                  </div>
                </div>
              )}
              {template?.headerConfig?.showRevDate !== false && (
                <div className="p-3 flex items-center gap-3">
                  <MdDateRange className="text-xl text-purple-600 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-xs text-gray-500 block">
                      Rev. Date
                    </span>
                    {showPreview ? (
                      <span className="font-semibold text-gray-800">
                        {auditData.revDate || "-"}
                      </span>
                    ) : (
                      <input
                        type="date"
                        value={auditData.revDate}
                        onChange={(e) =>
                          handleAuditDataChange("revDate", e.target.value)
                        }
                        className="w-full font-semibold text-gray-800 bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Info Section - Dynamic Fields */}
          <div className="grid grid-cols-2 md:grid-cols-4 border-b-2 border-gray-300 bg-gray-50">
            {template?.infoFields
              ?.filter((field) => field.visible)
              .map((field, index) => (
                <div
                  key={field.id}
                  className={`p-4 ${
                    index <
                    template.infoFields.filter((f) => f.visible).length - 1
                      ? "border-r border-b md:border-b-0"
                      : ""
                  } border-gray-300`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {getFieldIcon(field.id)}
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {field.name}
                      {field.required && (
                        <span className="text-red-500">*</span>
                      )}
                    </span>
                  </div>
                  {renderInfoFieldInput(field)}
                </div>
              ))}
          </div>

          {/* Notes Section */}
          <div className="p-4 border-b-2 border-gray-300 bg-yellow-50">
            <div className="flex items-center gap-2 mb-2">
              <FaStickyNote className="text-lg text-yellow-600" />
              <span className="font-semibold text-gray-700">Notes:</span>
            </div>
            {showPreview ? (
              <p className="text-gray-700 leading-relaxed pl-6">
                {auditData.notes || "No notes added."}
              </p>
            ) : (
              <textarea
                placeholder="Enter notes here..."
                value={auditData.notes}
                onChange={(e) => handleAuditDataChange("notes", e.target.value)}
                rows={3}
                className="w-full text-gray-700 bg-transparent border border-gray-300 rounded-lg p-2 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none resize-none"
              />
            )}
          </div>

          {/* Main Table Section */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-700 to-gray-800 text-white print:bg-gray-700">
                  {visibleColumns.map((column) => (
                    <th
                      key={column.id}
                      className={`px-3 py-3 text-left font-semibold border-r border-gray-600 text-sm ${column.width}`}
                    >
                      {column.name}
                    </th>
                  ))}
                  {!showPreview && (
                    <th className="px-3 py-3 text-center font-semibold text-sm w-24 print:hidden">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {sections.map((section, sectionIndex) =>
                  section.checkPoints.map((checkpoint, checkpointIndex) => (
                    <tr
                      key={`${section.id}-${checkpoint.id}`}
                      className={`border-b border-gray-200 hover:bg-blue-50 transition-colors ${
                        checkpoint.status === "pass"
                          ? "bg-green-50"
                          : checkpoint.status === "fail"
                            ? "bg-red-50"
                            : checkpoint.status === "warning"
                              ? "bg-yellow-50"
                              : ""
                      }`}
                    >
                      {visibleColumns.map((column) => {
                        // Section column with rowSpan
                        if (column.id === "section") {
                          if (checkpointIndex === 0) {
                            return (
                              <td
                                key={column.id}
                                className="px-3 py-2 font-bold bg-gray-100 border-r border-gray-300 align-top"
                                rowSpan={section.checkPoints.length}
                              >
                                <div className="flex flex-col gap-2">
                                  {showPreview ? (
                                    <span className="text-gray-700 text-sm">
                                      {section.sectionName || "-"}
                                    </span>
                                  ) : (
                                    <>
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
                                      <div className="flex flex-wrap gap-1 print:hidden">
                                        <button
                                          onClick={() =>
                                            addCheckpoint(section.id)
                                          }
                                          className="p-1 bg-green-500 hover:bg-green-600 text-white rounded text-xs"
                                          title="Add Row"
                                        >
                                          <FaPlus size={10} />
                                        </button>
                                        <button
                                          onClick={() =>
                                            moveSection(sectionIndex, "up")
                                          }
                                          disabled={sectionIndex === 0}
                                          className="p-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs disabled:opacity-50"
                                          title="Move Up"
                                        >
                                          <FaArrowUp size={10} />
                                        </button>
                                        <button
                                          onClick={() =>
                                            moveSection(sectionIndex, "down")
                                          }
                                          disabled={
                                            sectionIndex === sections.length - 1
                                          }
                                          className="p-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs disabled:opacity-50"
                                          title="Move Down"
                                        >
                                          <FaArrowDown size={10} />
                                        </button>
                                        <button
                                          onClick={() =>
                                            deleteSection(section.id)
                                          }
                                          disabled={sections.length <= 1}
                                          className="p-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs disabled:opacity-50"
                                          title="Delete Section"
                                        >
                                          <FaTrash size={10} />
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </td>
                            );
                          }
                          return null;
                        }

                        // Status column
                        if (column.id === "status") {
                          return (
                            <td
                              key={column.id}
                              className="px-3 py-2 border-r border-gray-200"
                            >
                              {showPreview ? (
                                getStatusBadge(checkpoint.status)
                              ) : (
                                <select
                                  value={checkpoint.status || "pending"}
                                  onChange={(e) =>
                                    handleCheckpointChange(
                                      section.id,
                                      checkpoint.id,
                                      "status",
                                      e.target.value,
                                    )
                                  }
                                  className={`w-full text-xs px-2 py-1 rounded border focus:outline-none focus:ring-1 ${
                                    checkpoint.status === "pass"
                                      ? "bg-green-100 border-green-300 text-green-700 focus:ring-green-500"
                                      : checkpoint.status === "fail"
                                        ? "bg-red-100 border-red-300 text-red-700 focus:ring-red-500"
                                        : checkpoint.status === "warning"
                                          ? "bg-yellow-100 border-yellow-300 text-yellow-700 focus:ring-yellow-500"
                                          : "bg-gray-100 border-gray-300 text-gray-700 focus:ring-gray-500"
                                  }`}
                                >
                                  <option value="pending">Pending</option>
                                  <option value="pass">Pass</option>
                                  <option value="fail">Fail</option>
                                  <option value="warning">Warning</option>
                                </select>
                              )}
                            </td>
                          );
                        }

                        // Entry fields (observation, remark, etc.)
                        if (column.entryField) {
                          return (
                            <td
                              key={column.id}
                              className="px-3 py-2 border-r border-gray-200"
                            >
                              {showPreview ? (
                                <span className="text-gray-700 text-sm">
                                  {checkpoint[column.id] || "-"}
                                </span>
                              ) : (
                                <input
                                  type={
                                    column.type === "number" ? "number" : "text"
                                  }
                                  placeholder={column.name}
                                  value={checkpoint[column.id] || ""}
                                  onChange={(e) =>
                                    handleCheckpointChange(
                                      section.id,
                                      checkpoint.id,
                                      column.id,
                                      e.target.value,
                                    )
                                  }
                                  className="w-full text-sm text-gray-700 bg-white border border-gray-300 rounded px-2 py-1 focus:border-blue-500 outline-none"
                                />
                              )}
                            </td>
                          );
                        }

                        // Template fields (readonly from template)
                        return (
                          <td
                            key={column.id}
                            className="px-3 py-2 border-r border-gray-200"
                          >
                            {showPreview ? (
                              <span className="text-gray-700 text-sm">
                                {checkpoint[column.id] || "-"}
                              </span>
                            ) : (
                              <input
                                type="text"
                                placeholder={column.name}
                                value={checkpoint[column.id] || ""}
                                onChange={(e) =>
                                  handleCheckpointChange(
                                    section.id,
                                    checkpoint.id,
                                    column.id,
                                    e.target.value,
                                  )
                                }
                                className="w-full text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded px-2 py-1 focus:border-blue-500 outline-none"
                              />
                            )}
                          </td>
                        );
                      })}

                      {/* Actions column */}
                      {!showPreview && (
                        <td className="px-3 py-2 text-center print:hidden">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() =>
                                moveCheckpoint(
                                  section.id,
                                  checkpointIndex,
                                  "up",
                                )
                              }
                              disabled={checkpointIndex === 0}
                              className="p-1 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded text-xs disabled:opacity-50"
                              title="Move Up"
                            >
                              <FaArrowUp size={10} />
                            </button>
                            <button
                              onClick={() =>
                                moveCheckpoint(
                                  section.id,
                                  checkpointIndex,
                                  "down",
                                )
                              }
                              disabled={
                                checkpointIndex ===
                                section.checkPoints.length - 1
                              }
                              className="p-1 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded text-xs disabled:opacity-50"
                              title="Move Down"
                            >
                              <FaArrowDown size={10} />
                            </button>
                            <button
                              onClick={() =>
                                deleteCheckpoint(section.id, checkpoint.id)
                              }
                              disabled={section.checkPoints.length <= 1}
                              className="p-1 bg-red-100 hover:bg-red-200 text-red-600 rounded text-xs disabled:opacity-50"
                              title="Delete Row"
                            >
                              <FaTrash size={10} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>

          {/* Add Section Button */}
          {!showPreview && (
            <div className="p-4 bg-gray-50 border-t border-gray-300 print:hidden">
              <button
                onClick={addSection}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all text-sm"
              >
                <MdAddCircle /> Add New Section
              </button>
            </div>
          )}

          {/* Summary Section */}
          <div className="p-4 bg-gray-100 border-t-2 border-gray-300">
            <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
              <FaClipboardCheck className="text-blue-600" />
              Audit Summary
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-white rounded-lg p-3 text-center shadow-sm border">
                <div className="text-2xl font-bold text-gray-700">
                  {summary.total}
                </div>
                <span className="text-xs text-gray-500">Total Checks</span>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center shadow-sm border border-green-200">
                <div className="flex items-center justify-center gap-1 text-green-700 font-bold text-2xl">
                  <FaCheckCircle className="text-lg" />
                  {summary.pass}
                </div>
                <span className="text-xs text-green-600">Passed</span>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3 text-center shadow-sm border border-yellow-200">
                <div className="flex items-center justify-center gap-1 text-yellow-700 font-bold text-2xl">
                  <FaExclamationTriangle className="text-lg" />
                  {summary.warning}
                </div>
                <span className="text-xs text-yellow-600">Warnings</span>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center shadow-sm border border-red-200">
                <div className="flex items-center justify-center gap-1 text-red-700 font-bold text-2xl">
                  <FaTimesCircle className="text-lg" />
                  {summary.fail}
                </div>
                <span className="text-xs text-red-600">Failed</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center shadow-sm border border-gray-200">
                <div className="text-2xl font-bold text-gray-500">
                  {summary.pending}
                </div>
                <span className="text-xs text-gray-500">Pending</span>
              </div>
            </div>
          </div>

          {/* Signature Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 border-t-2 border-gray-300">
            <div className="p-6 border-r border-b md:border-b-0 border-gray-300 text-center">
              <span className="text-sm font-medium text-gray-600 block mb-8">
                Auditor Signature
              </span>
              <div className="border-b-2 border-gray-400 w-3/4 mx-auto mb-2"></div>
              <span className="text-xs text-gray-500">Name & Date</span>
            </div>
            <div className="p-6 border-r border-b md:border-b-0 border-gray-300 text-center">
              <span className="text-sm font-medium text-gray-600 block mb-8">
                Reviewed By
              </span>
              <div className="border-b-2 border-gray-400 w-3/4 mx-auto mb-2"></div>
              <span className="text-xs text-gray-500">Name & Date</span>
            </div>
            <div className="p-6 text-center">
              <span className="text-sm font-medium text-gray-600 block mb-8">
                Approved By
              </span>
              <div className="border-b-2 border-gray-400 w-3/4 mx-auto mb-2"></div>
              <span className="text-xs text-gray-500">Name & Date</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 text-center text-gray-500 text-sm print:hidden">
          <p>
            This document is confidential and intended for internal use only.
          </p>
          <p>
            Generated on {new Date().toLocaleDateString()} |{" "}
            {new Date().toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuditEntry;
