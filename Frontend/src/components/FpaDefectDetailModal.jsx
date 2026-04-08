import { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLazyGetFpaDefectDetailsQuery } from "../redux/api/fpaReportApi";
import { closeDefectModal } from "../redux/slices/fpaReportSlice.js";
import Loader from "./ui/Loader";
import { IoCloseOutline } from "react-icons/io5";
import { HiOutlineSearch } from "react-icons/hi";
import { FiDownload, FiMaximize2, FiX, FiImage, FiAlertCircle } from "react-icons/fi";
import { baseURL } from "../assets/assets.js";
import toast from "react-hot-toast";

const SERVER_URL = new URL(baseURL).origin;

/* ── Category config ── */
const CAT_CONFIG = {
  critical: {
    wrapper: "border-red-200 bg-red-50/60",
    badge:   "bg-red-100 text-red-700 border-red-200",
    dot:     "bg-red-500",
    label:   "Critical",
  },
  major: {
    wrapper: "border-orange-200 bg-orange-50/60",
    badge:   "bg-orange-100 text-orange-700 border-orange-200",
    dot:     "bg-orange-500",
    label:   "Major",
  },
  minor: {
    wrapper: "border-yellow-200 bg-yellow-50/40",
    badge:   "bg-yellow-100 text-yellow-700 border-yellow-200",
    dot:     "bg-yellow-500",
    label:   "Minor",
  },
};

const getImageUrl = (imageName) => {
  if (!imageName) return null;
  return `${SERVER_URL}/uploads/FpaDefectImages/${imageName}`;
};

/* ── Lightbox ── */
const Lightbox = ({ src, alt, onClose }) => (
  <div className="fixed inset-0 z-[80] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
    onClick={onClose}>
    <button onClick={onClose}
      className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-colors">
      <FiX size={20} />
    </button>
    <img src={src} alt={alt}
      className="max-h-[90vh] max-w-[90vw] rounded-xl shadow-2xl object-contain"
      onClick={(e) => e.stopPropagation()} />
  </div>
);

const FpaDefectDetailModal = () => {
  const dispatch = useDispatch();
  const { selectedFGSRNo } = useSelector((s) => s.fpaReport);

  const [triggerFetch, { data: defectData, isLoading, isFetching }] =
    useLazyGetFpaDefectDetailsQuery();

  /* BUG FIX: removed unused `failedImages` state — tracking broken images was
     implemented but never rendered. Now we track per-index and show fallback. */
  const [brokenImages, setBrokenImages]       = useState({});
  const [downloadingIdx, setDownloadingIdx]   = useState(null);
  const [lightboxSrc, setLightboxSrc]         = useState(null);
  const [filterCat, setFilterCat]             = useState("all");

  useEffect(() => {
    if (selectedFGSRNo) {
      triggerFetch({ fgsrNo: selectedFGSRNo });
      setBrokenImages({});
      setFilterCat("all");
    }
  }, [selectedFGSRNo, triggerFetch]);

  const handleClose = () => dispatch(closeDefectModal());

  const handleImageError = useCallback((idx) => {
    setBrokenImages((prev) => ({ ...prev, [idx]: true }));
  }, []);

  const handleDownload = async (imageName, idx) => {
    if (!imageName) return;
    setDownloadingIdx(idx);
    try {
      const res  = await fetch(getImageUrl(imageName));
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = imageName;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); window.URL.revokeObjectURL(url);
      toast.success("Image downloaded");
    } catch {
      toast.error("Failed to download image");
    } finally {
      setDownloadingIdx(null);
    }
  };

  const defects = defectData?.data || [];
  const loading = isLoading || isFetching;

  const filtered = filterCat === "all"
    ? defects
    : defects.filter((d) => d.Category?.toLowerCase() === filterCat);

  const counts = {
    critical: defects.filter((d) => d.Category?.toLowerCase() === "critical").length,
    major:    defects.filter((d) => d.Category?.toLowerCase() === "major").length,
    minor:    defects.filter((d) => d.Category?.toLowerCase() === "minor").length,
  };

  return (
    <>
      {/* ── Lightbox ── */}
      {lightboxSrc && (
        <Lightbox src={lightboxSrc} alt="Defect image" onClose={() => setLightboxSrc(null)} />
      )}

      {/* ── Modal backdrop ── */}
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        onClick={handleClose}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-gray-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-gray-50/50 rounded-t-2xl">
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <FiAlertCircle size={12} className="text-blue-500" />
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Defect Details</span>
              </div>
              <h2 className="text-sm font-black text-gray-900">
                FGSRNo: <span className="font-mono text-blue-700">{selectedFGSRNo}</span>
              </h2>
            </div>
            <button onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1.5 transition-colors">
              <IoCloseOutline size={20} />
            </button>
          </div>

          {/* ── Summary & Filter bar ── */}
          {!loading && defects.length > 0 && (
            <div className="px-5 py-2.5 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2 flex-wrap">
              {/* Filter buttons */}
              {[
                { key: "all",      label: `All (${defects.length})`,    cls: "bg-gray-700 text-white" },
                { key: "critical", label: `Critical (${counts.critical})`, cls: "bg-red-600 text-white" },
                { key: "major",    label: `Major (${counts.major})`,       cls: "bg-orange-500 text-white" },
                { key: "minor",    label: `Minor (${counts.minor})`,       cls: "bg-yellow-500 text-white" },
              ].map(({ key, label, cls }) => (
                <button key={key} onClick={() => setFilterCat(key)}
                  className={`text-[10px] font-black px-2.5 py-1 rounded-lg transition-all border ${
                    filterCat === key ? cls + " border-transparent shadow-sm" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}>
                  {label}
                </button>
              ))}

              {/* With-image count */}
              <span className="ml-auto text-[10px] text-gray-400">
                {defects.filter((d) => d.DefectImage).length} with images
              </span>
            </div>
          )}

          {/* ── Body ── */}
          <div className="flex-1 overflow-auto p-4">
            {loading && <div className="py-12 flex justify-center"><Loader /></div>}

            {!loading && defects.length === 0 && (
              <div className="py-14 text-center">
                <HiOutlineSearch className="text-gray-300 text-5xl mx-auto mb-3" />
                <p className="text-gray-500 font-semibold text-sm">No defect details found.</p>
                <p className="text-gray-400 text-xs mt-1">FGSRNo: {selectedFGSRNo}</p>
              </div>
            )}

            {!loading && defects.length > 0 && (
              <div className="space-y-3">
                {filtered.length === 0 ? (
                  <div className="py-8 text-center text-gray-400 text-xs">
                    No {filterCat} defects for this FG.
                  </div>
                ) : (
                  filtered.map((defect, index) => {
                    const catKey   = defect.Category?.toLowerCase() || "minor";
                    const config   = CAT_CONFIG[catKey] || CAT_CONFIG.minor;
                    const imgUrl   = getImageUrl(defect.DefectImage);
                    const imgBroken = brokenImages[index];
                    const isDling  = downloadingIdx === index;
                    /* Find original index in full defects array for broken-image tracking */
                    const origIdx  = defects.indexOf(defect);

                    return (
                      <div key={index}
                        className={`border rounded-xl p-4 transition-all hover:shadow-sm ${config.wrapper}`}>
                        <div className="flex items-start gap-3">

                          {/* Left: info */}
                          <div className="flex-1 min-w-0">
                            {/* Category badge + number */}
                            <div className="flex items-center gap-2 mb-2.5">
                              <span className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${config.dot}`} />
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${config.badge}`}>
                                  {config.label}
                                </span>
                              </span>
                              <span className="text-[10px] text-gray-400 font-mono">#{index + 1}</span>
                            </div>

                            {/* Defect description */}
                            <div className="mb-2">
                              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Defect</p>
                              <p className="text-sm font-semibold text-gray-800">
                                {defect.AddDefect || <span className="text-gray-300 italic">Not specified</span>}
                              </p>
                            </div>

                            {/* Remark */}
                            <div>
                              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Remark</p>
                              <p className="text-xs text-gray-600 leading-relaxed">
                                {defect.Remark || <span className="text-gray-300 italic">No remark</span>}
                              </p>
                            </div>
                          </div>

                          {/* Right: Image panel */}
                          {defect.DefectImage ? (
                            <div className="flex-shrink-0 w-24">
                              {!imgBroken && imgUrl ? (
                                /* ── Image preview with click-to-expand ── */
                                <div className="relative group cursor-pointer" onClick={() => setLightboxSrc(imgUrl)}>
                                  <img
                                    src={imgUrl}
                                    alt={`Defect ${index + 1}`}
                                    onError={() => handleImageError(origIdx)}
                                    className="w-24 h-24 object-cover rounded-lg border border-gray-200 group-hover:border-blue-400 transition-all shadow-sm"
                                  />
                                  {/* Hover overlay */}
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 rounded-lg transition-all flex items-center justify-center">
                                    <FiMaximize2 size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </div>
                                </div>
                              ) : (
                                /* ── Broken image fallback ── */
                                <div className="w-24 h-24 rounded-lg border border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-1">
                                  <FiImage size={18} className="text-gray-300" />
                                  <span className="text-[9px] text-gray-300 text-center">Image unavailable</span>
                                </div>
                              )}

                              {/* Download button */}
                              <button
                                onClick={() => handleDownload(defect.DefectImage, index)}
                                disabled={isDling}
                                className={`w-24 mt-1.5 py-1 rounded-lg text-[9px] font-bold flex items-center justify-center gap-1 transition-all border ${
                                  isDling
                                    ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                                    : "bg-white border-gray-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300"
                                }`}>
                                <FiDownload size={10} className={isDling ? "animate-bounce" : ""} />
                                {isDling ? "Saving…" : "Download"}
                              </button>
                            </div>
                          ) : (
                            /* No image placeholder */
                            <div className="flex-shrink-0 w-24 h-24 rounded-lg border border-dashed border-gray-200 bg-gray-50/50 flex flex-col items-center justify-center gap-1">
                              <FiImage size={16} className="text-gray-200" />
                              <span className="text-[9px] text-gray-300 text-center">No image</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/60 rounded-b-2xl flex items-center justify-between">
            <span className="text-[10px] text-gray-400">
              {filtered.length} of {defects.length} defects shown · Click image to expand
            </span>
            <button onClick={handleClose}
              className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold rounded-lg transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default FpaDefectDetailModal;