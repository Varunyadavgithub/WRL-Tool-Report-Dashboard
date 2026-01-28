import { useState, useEffect, useCallback } from "react";

const TEMPLATES_KEY = "audit_templates";
const AUDITS_KEY = "audit_records";

export const useAuditData = () => {
  const [templates, setTemplates] = useState([]);
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load data from localStorage on mount
  useEffect(() => {
    loadTemplates();
    loadAudits();
  }, []);

  // Templates
  const loadTemplates = () => {
    const stored = localStorage.getItem(TEMPLATES_KEY);
    if (stored) {
      setTemplates(JSON.parse(stored));
    }
  };

  const saveTemplates = (newTemplates) => {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(newTemplates));
    setTemplates(newTemplates);
  };

  const getTemplateById = useCallback((id) => {
    const stored = localStorage.getItem(TEMPLATES_KEY);
    if (stored) {
      const templates = JSON.parse(stored);
      return templates.find((t) => t.id === id);
    }
    return null;
  }, []);

  const createTemplate = useCallback((templateData) => {
    const newTemplate = {
      ...templateData,
      id: `template_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const stored = localStorage.getItem(TEMPLATES_KEY);
    const templates = stored ? JSON.parse(stored) : [];
    const newTemplates = [...templates, newTemplate];
    saveTemplates(newTemplates);
    return newTemplate;
  }, []);

  const updateTemplate = useCallback((id, templateData) => {
    const stored = localStorage.getItem(TEMPLATES_KEY);
    const templates = stored ? JSON.parse(stored) : [];
    const updatedTemplates = templates.map((t) =>
      t.id === id
        ? { ...t, ...templateData, updatedAt: new Date().toISOString() }
        : t,
    );
    saveTemplates(updatedTemplates);
    return updatedTemplates.find((t) => t.id === id);
  }, []);

  const deleteTemplate = useCallback((id) => {
    const stored = localStorage.getItem(TEMPLATES_KEY);
    const templates = stored ? JSON.parse(stored) : [];
    const filteredTemplates = templates.filter((t) => t.id !== id);
    saveTemplates(filteredTemplates);
  }, []);

  const duplicateTemplate = useCallback(
    (id) => {
      const template = getTemplateById(id);
      if (template) {
        const newTemplate = {
          ...template,
          id: `template_${Date.now()}`,
          name: `${template.name} (Copy)`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const stored = localStorage.getItem(TEMPLATES_KEY);
        const templates = stored ? JSON.parse(stored) : [];
        const newTemplates = [...templates, newTemplate];
        saveTemplates(newTemplates);
        return newTemplate;
      }
      return null;
    },
    [getTemplateById],
  );

  // Audits
  const loadAudits = () => {
    const stored = localStorage.getItem(AUDITS_KEY);
    if (stored) {
      setAudits(JSON.parse(stored));
    }
  };

  const saveAudits = (newAudits) => {
    localStorage.setItem(AUDITS_KEY, JSON.stringify(newAudits));
    setAudits(newAudits);
  };

  const getAuditById = useCallback((id) => {
    const stored = localStorage.getItem(AUDITS_KEY);
    if (stored) {
      const audits = JSON.parse(stored);
      return audits.find((a) => a.id === id);
    }
    return null;
  }, []);

  const createAudit = useCallback((auditData) => {
    const newAudit = {
      ...auditData,
      id: `audit_${Date.now()}`,
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const stored = localStorage.getItem(AUDITS_KEY);
    const audits = stored ? JSON.parse(stored) : [];
    const newAudits = [...audits, newAudit];
    saveAudits(newAudits);
    return newAudit;
  }, []);

  const updateAudit = useCallback((id, auditData) => {
    const stored = localStorage.getItem(AUDITS_KEY);
    const audits = stored ? JSON.parse(stored) : [];
    const updatedAudits = audits.map((a) =>
      a.id === id
        ? { ...a, ...auditData, updatedAt: new Date().toISOString() }
        : a,
    );
    saveAudits(updatedAudits);
    return updatedAudits.find((a) => a.id === id);
  }, []);

  const deleteAudit = useCallback((id) => {
    const stored = localStorage.getItem(AUDITS_KEY);
    const audits = stored ? JSON.parse(stored) : [];
    const filteredAudits = audits.filter((a) => a.id !== id);
    saveAudits(filteredAudits);
  }, []);

  const submitAudit = useCallback(
    (id) => {
      return updateAudit(id, { status: "submitted" });
    },
    [updateAudit],
  );

  const approveAudit = useCallback(
    (id, approverName) => {
      return updateAudit(id, {
        status: "approved",
        approvedBy: approverName,
        approvedAt: new Date().toISOString(),
      });
    },
    [updateAudit],
  );

  return {
    templates,
    audits,
    loading,
    // Template methods
    getTemplateById,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
    loadTemplates,
    // Audit methods
    getAuditById,
    createAudit,
    updateAudit,
    deleteAudit,
    submitAudit,
    approveAudit,
    loadAudits,
  };
};

export default useAuditData;
