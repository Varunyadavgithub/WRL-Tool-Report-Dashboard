import { useState, useCallback } from "react";
import axios from "axios";
import { baseURL } from "../assets/assets.js";

const API_BASE = `${baseURL}audit-report`;

// ==================== DATA TRANSFORMERS ====================
// Backend returns PascalCase, Frontend uses camelCase

const transformTemplate = (template) => {
  if (!template) return null;
  return {
    id: template.Id,
    templateCode: template.TemplateCode,
    name: template.Name,
    description: template.Description,
    category: template.Category,
    version: template.Version,
    isActive: template.IsActive,
    headerConfig: template.HeaderConfig,
    infoFields: template.InfoFields,
    columns: template.Columns,
    defaultSections: template.DefaultSections,
    createdBy: template.CreatedBy,
    createdAt: template.CreatedAt,
    updatedBy: template.UpdatedBy,
    updatedAt: template.UpdatedAt,
  };
};

const transformAudit = (audit) => {
  if (!audit) return null;
  return {
    id: audit.Id,
    auditCode: audit.AuditCode,
    templateId: audit.TemplateId,
    templateName: audit.TemplateName,
    reportName: audit.ReportName,
    formatNo: audit.FormatNo,
    revNo: audit.RevNo,
    revDate: audit.RevDate,
    notes: audit.Notes,
    status: audit.Status,
    infoData: audit.InfoData,
    sections: audit.Sections,
    columns: audit.Columns,
    infoFields: audit.InfoFields,
    headerConfig: audit.HeaderConfig,
    summary: audit.Summary,
    createdBy: audit.CreatedBy,
    createdAt: audit.CreatedAt,
    updatedBy: audit.UpdatedBy,
    updatedAt: audit.UpdatedAt,
    submittedBy: audit.SubmittedBy,
    submittedAt: audit.SubmittedAt,
    approvedBy: audit.ApprovedBy,
    approvedAt: audit.ApprovedAt,
    approvalComments: audit.ApprovalComments,
  };
};

// ==================== MAIN HOOK ====================
export const useAuditData = () => {
  const [templates, setTemplates] = useState([]);
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Clear error
  const clearError = useCallback(() => setError(null), []);

  // ==================== TEMPLATE METHODS ====================

  const loadTemplates = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE}/templates`, { params });
      const transformedTemplates = (response.data.data || []).map(
        transformTemplate,
      );
      setTemplates(transformedTemplates);
      return {
        data: transformedTemplates,
        totalCount: response.data.totalCount || 0,
        page: response.data.page || 1,
        limit: response.data.limit || 50,
      };
    } catch (err) {
      const message = err.response?.data?.message || "Failed to load templates";
      setError(message);
      console.error("Load templates error:", err);
      return { data: [], totalCount: 0 };
    } finally {
      setLoading(false);
    }
  }, []);

  const getTemplateById = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE}/templates/${id}`);
      return transformTemplate(response.data.data);
    } catch (err) {
      const message = err.response?.data?.message || "Failed to load template";
      setError(message);
      console.error("Get template error:", err);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createTemplate = useCallback(async (templateData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_BASE}/templates`, templateData);
      const newTemplate = transformTemplate(response.data.data);
      setTemplates((prev) => [newTemplate, ...prev]);
      return newTemplate;
    } catch (err) {
      const message =
        err.response?.data?.message || "Failed to create template";
      setError(message);
      console.error("Create template error:", err);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateTemplate = useCallback(async (id, templateData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.put(
        `${API_BASE}/templates/${id}`,
        templateData,
      );
      const updatedTemplate = transformTemplate(response.data.data);
      setTemplates((prev) =>
        prev.map((t) => (t.id == id ? updatedTemplate : t)),
      );
      return updatedTemplate;
    } catch (err) {
      const message =
        err.response?.data?.message || "Failed to update template";
      setError(message);
      console.error("Update template error:", err);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteTemplate = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      await axios.delete(`${API_BASE}/templates/${id}`);
      setTemplates((prev) => prev.filter((t) => t.id != id));
      return true;
    } catch (err) {
      const message =
        err.response?.data?.message || "Failed to delete template";
      setError(message);
      console.error("Delete template error:", err);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const duplicateTemplate = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(
        `${API_BASE}/templates/${id}/duplicate`,
      );
      const newTemplate = transformTemplate(response.data.data);
      setTemplates((prev) => [newTemplate, ...prev]);
      return newTemplate;
    } catch (err) {
      const message =
        err.response?.data?.message || "Failed to duplicate template";
      setError(message);
      console.error("Duplicate template error:", err);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ==================== AUDIT METHODS ====================

  const loadAudits = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE}/audits`, { params });
      const transformedAudits = (response.data.data || []).map(transformAudit);
      setAudits(transformedAudits);
      return {
        data: transformedAudits,
        totalCount: response.data.totalCount || 0,
        page: response.data.page || 1,
        limit: response.data.limit || 50,
      };
    } catch (err) {
      const message = err.response?.data?.message || "Failed to load audits";
      setError(message);
      console.error("Load audits error:", err);
      return { data: [], totalCount: 0 };
    } finally {
      setLoading(false);
    }
  }, []);

  const getAuditById = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE}/audits/${id}`);
      return transformAudit(response.data.data);
    } catch (err) {
      const message = err.response?.data?.message || "Failed to load audit";
      setError(message);
      console.error("Get audit error:", err);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createAudit = useCallback(async (auditData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_BASE}/audits`, auditData);
      const newAudit = transformAudit(response.data.data);
      setAudits((prev) => [newAudit, ...prev]);
      return newAudit;
    } catch (err) {
      const message = err.response?.data?.message || "Failed to create audit";
      setError(message);
      console.error("Create audit error:", err);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateAudit = useCallback(async (id, auditData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.put(`${API_BASE}/audits/${id}`, auditData);
      const updatedAudit = transformAudit(response.data.data);
      setAudits((prev) => prev.map((a) => (a.id == id ? updatedAudit : a)));
      return updatedAudit;
    } catch (err) {
      const message = err.response?.data?.message || "Failed to update audit";
      setError(message);
      console.error("Update audit error:", err);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteAudit = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      await axios.delete(`${API_BASE}/audits/${id}`);
      setAudits((prev) => prev.filter((a) => a.id != id));
      return true;
    } catch (err) {
      const message = err.response?.data?.message || "Failed to delete audit";
      setError(message);
      console.error("Delete audit error:", err);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const submitAudit = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_BASE}/audits/${id}/submit`);
      const updatedAudit = transformAudit(response.data.data);
      setAudits((prev) => prev.map((a) => (a.id == id ? updatedAudit : a)));
      return updatedAudit;
    } catch (err) {
      const message = err.response?.data?.message || "Failed to submit audit";
      setError(message);
      console.error("Submit audit error:", err);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const approveAudit = useCallback(async (id, approvalData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(
        `${API_BASE}/audits/${id}/approve`,
        approvalData,
      );
      const updatedAudit = transformAudit(response.data.data);
      setAudits((prev) => prev.map((a) => (a.id == id ? updatedAudit : a)));
      return updatedAudit;
    } catch (err) {
      const message = err.response?.data?.message || "Failed to approve audit";
      setError(message);
      console.error("Approve audit error:", err);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const rejectAudit = useCallback(async (id, rejectionData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(
        `${API_BASE}/audits/${id}/reject`,
        rejectionData,
      );
      const updatedAudit = transformAudit(response.data.data);
      setAudits((prev) => prev.map((a) => (a.id == id ? updatedAudit : a)));
      return updatedAudit;
    } catch (err) {
      const message = err.response?.data?.message || "Failed to reject audit";
      setError(message);
      console.error("Reject audit error:", err);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const getAuditHistory = useCallback(async (id) => {
    try {
      const response = await axios.get(`${API_BASE}/audits/${id}/history`);
      return response.data.data;
    } catch (err) {
      console.error("Get audit history error:", err);
      throw new Error(
        err.response?.data?.message || "Failed to load audit history",
      );
    }
  }, []);

  const getAuditStats = useCallback(async (params = {}) => {
    try {
      const response = await axios.get(`${API_BASE}/audits/stats`, { params });
      return response.data.data;
    } catch (err) {
      console.error("Get audit stats error:", err);
      throw new Error(
        err.response?.data?.message || "Failed to load audit stats",
      );
    }
  }, []);

  return {
    // State
    templates,
    audits,
    loading,
    error,
    clearError,

    // Template methods
    loadTemplates,
    getTemplateById,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,

    // Audit methods
    loadAudits,
    getAuditById,
    createAudit,
    updateAudit,
    deleteAudit,
    submitAudit,
    approveAudit,
    rejectAudit,
    getAuditHistory,
    getAuditStats,
  };
};

export default useAuditData;
