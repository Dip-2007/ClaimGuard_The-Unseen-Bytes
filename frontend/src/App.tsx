import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FileUpload from './components/FileUpload';
import ParsedTreeViewer from './components/ParsedTreeViewer';
import ValidationPanel from './components/ValidationPanel';
import AIChatPanel from './components/AIChatPanel';
import RemittanceSummary from './components/RemittanceSummary';
import EnrollmentDashboard from './components/EnrollmentDashboard';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import TrendingSection from './components/TrendingSection';
import AuthScreen from './components/AuthScreen';
import HistoryDashboard from './components/HistoryDashboard';

type TabId = 'upload' | 'results' | 'chat' | 'history';
type SectionId = 'validation' | 'parsed' | 'summary';

interface BatchFileEntry {
  fileName: string;
  parseData: ParseData;
  rawContent: string;
  initialRawContent: string;
  remittance: any;
  enrollment: any;
}

interface ParseData {
  parse_result: any;
  validation_result: any;
  transaction_type: string;
  transaction_type_label: string;
  file_name?: string;
}

export default function App() {
  // Auth state
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem('claimguard_token'));
  const [user, setUser] = useState<{ id: string; name: string; email: string } | null>(() => {
    const stored = localStorage.getItem('claimguard_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [isGuest, setIsGuest] = useState<boolean>(() => localStorage.getItem('claimguard_guest') === 'true');

  const handleAuth = useCallback((token: string, userData: { id: string; name: string; email: string }) => {
    setAuthToken(token);
    setUser(userData);
    setIsGuest(false);
    localStorage.removeItem('claimguard_guest');
  }, []);

  const handleGuest = useCallback(() => {
    setIsGuest(true);
    localStorage.setItem('claimguard_guest', 'true');
  }, []);

  const handleLogout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
    setIsGuest(false);
    localStorage.removeItem('claimguard_token');
    localStorage.removeItem('claimguard_user');
    localStorage.removeItem('claimguard_guest');
  }, []);

  // Helper to get auth headers for API calls
  const getAuthHeaders = useCallback((): Record<string, string> => {
    if (authToken) {
      return { 'Authorization': `Bearer ${authToken}` };
    }
    return {};
  }, [authToken]);


  // Main app state
  const [activeTab, setActiveTab] = useState<TabId>('upload');
  const [activeSection, setActiveSection] = useState<SectionId>('validation');
  const fileUploadRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);

  const handleScrollToUpload = useCallback(() => {
    fileUploadRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const [saveMessage, setSaveMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handlePopupClick = useCallback((sectionId: SectionId) => {
    setActiveSection(sectionId);
  }, []);
  const [parseData, setParseData] = useState<ParseData | null>(null);
  const [rawContent, setRawContent] = useState('');
  const [initialRawContent, setInitialRawContent] = useState('');
  const [activeActivityId, setActiveActivityId] = useState<string | null>(null);
  const [remittance, setRemittance] = useState<any>(null);
  const [enrollment, setEnrollment] = useState<any>(null);

  // ── Batch (ZIP) state ──
  const [batchFiles, setBatchFiles] = useState<BatchFileEntry[]>([]);
  const [batchIndex, setBatchIndex] = useState(0);
  const isBatchMode = batchFiles.length > 1;

  // Fetch summaries for a single parse data result
  const fetchSummaries = useCallback(async (data: any) => {
    let rem = null;
    let enr = null;
    if (data.transaction_type === '835' && data.parse_result?.raw_content) {
      try {
        const res = await fetch('/api/remittance-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ raw_content: data.parse_result.raw_content }),
        });
        rem = await res.json();
      } catch { /* ignore */ }
    }
    if (data.transaction_type === '834' && data.parse_result?.raw_content) {
      try {
        const res = await fetch('/api/enrollment-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ raw_content: data.parse_result.raw_content }),
        });
        enr = await res.json();
      } catch { /* ignore */ }
    }
    return { rem, enr };
  }, [getAuthHeaders]);

  const handleFileProcessed = useCallback(async (data: any) => {
    // ── BATCH ZIP MODE ──
    if (data.results && Array.isArray(data.results)) {
      const entries: BatchFileEntry[] = [];
      for (const r of data.results) {
        if (!r.upload_response?.success) continue;
        const d = r.upload_response;
        const rc = d.parse_result?.raw_content || '';
        const { rem, enr } = await fetchSummaries(d);
        entries.push({
          fileName: r.file_name,
          parseData: d,
          rawContent: rc,
          initialRawContent: rc,
          remittance: rem,
          enrollment: enr,
        });
      }
      if (entries.length > 0) {
        setBatchFiles(entries);
        setBatchIndex(0);
        // Load the first file
        const first = entries[0];
        setParseData(first.parseData);
        setRawContent(first.rawContent);
        setInitialRawContent(first.initialRawContent);
        setRemittance(first.remittance);
        setEnrollment(first.enrollment);
        setActiveTab('results');
      }
      return;
    }

    // ── SINGLE FILE MODE ──
    setBatchFiles([]);
    setBatchIndex(0);
    setParseData(data);
    setActiveTab('results');

    const { rem, enr } = await fetchSummaries(data);
    setRemittance(rem);
    setEnrollment(enr);
  }, [fetchSummaries]);

  // Save current file state back into the batch array before switching
  const saveBatchState = useCallback(() => {
    if (!isBatchMode) return;
    setBatchFiles(prev => {
      const copy = [...prev];
      copy[batchIndex] = {
        ...copy[batchIndex],
        rawContent,
        parseData: parseData!,
        remittance,
        enrollment,
      };
      return copy;
    });
  }, [isBatchMode, batchIndex, rawContent, parseData, remittance, enrollment]);

  const handleBatchNav = useCallback((newIndex: number) => {
    if (newIndex < 0 || newIndex >= batchFiles.length) return;
    saveBatchState();
    const entry = batchFiles[newIndex];
    setBatchIndex(newIndex);
    setParseData(entry.parseData);
    setRawContent(entry.rawContent);
    setInitialRawContent(entry.initialRawContent);
    setRemittance(entry.remittance);
    setEnrollment(entry.enrollment);
    setActiveSection('validation');
  }, [batchFiles, saveBatchState]);

  const handleFix = useCallback(
    async (errorId: string, fixValue: string, lineNumber: number = 0, elementIndex: number = -1) => {
      if (!rawContent) return;
      console.log('[handleFix] Sending fix:', { errorId, fixValue, lineNumber, elementIndex, rawContentLength: rawContent.length });
      try {
        const res = await fetch('/api/fix', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({
            error_id: errorId,
            fix_value: fixValue,
            raw_content: rawContent,
            line_number: lineNumber,
            element_index: elementIndex,
          }),
        });
        const data = await res.json();
        console.log('[handleFix] Response:', { 
          hasCorrection: !!data.corrected_content, 
          contentChanged: data.corrected_content !== rawContent,
          message: data.message,
          newErrors: data.validation_result?.error_count,
          newWarnings: data.validation_result?.warning_count,
        });
        if (data.corrected_content) {
          setRawContent(data.corrected_content);
          setParseData((prev) =>
            prev
              ? {
                ...prev,
                validation_result: data.validation_result,
                parse_result: data.parse_result
                  ? { ...data.parse_result, raw_content: data.corrected_content }
                  : prev.parse_result,
              }
              : prev
          );

          // Auto-sync corrected content to MongoDB cloud
          if (activeActivityId) {
            fetch(`/api/save-progress/${activeActivityId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
              body: JSON.stringify({
                raw_content: data.corrected_content,
                error_count: data.validation_result?.error_count || 0,
                warning_count: data.validation_result?.warning_count || 0,
                description: `File: ${parseData?.parse_result?.file_name || 'file.edi'} — ${data.validation_result?.error_count || 0} errors, ${data.validation_result?.warning_count || 0} warnings`,
              }),
            }).catch(err => console.error('Cloud sync error:', err));
          }
        }
      } catch (err) {
        console.error('Fix error:', err);
      }
    },
    [rawContent, getAuthHeaders],
  );

  const handleFixAll = useCallback(async () => {
    if (!rawContent) return;
    try {
      const res = await fetch('/api/fix-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ raw_content: rawContent }),
      });
      const data = await res.json();
      if (data.corrected_content) {
        setRawContent(data.corrected_content);
        setParseData((prev) =>
          prev
            ? {
              ...prev,
              validation_result: data.validation_result,
              parse_result: data.parse_result
                ? { ...data.parse_result, raw_content: data.corrected_content }
                : prev.parse_result,
            }
            : prev
        );

          // Auto-sync corrected content to MongoDB cloud
          if (activeActivityId) {
            fetch(`/api/save-progress/${activeActivityId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
              body: JSON.stringify({
                raw_content: data.corrected_content,
                error_count: data.validation_result?.error_count || 0,
                warning_count: data.validation_result?.warning_count || 0,
                description: `File: ${parseData?.parse_result?.file_name || 'file.edi'} — ${data.validation_result?.error_count || 0} errors, ${data.validation_result?.warning_count || 0} warnings`,
              }),
            }).catch(err => console.error('Cloud sync error:', err));
          }
      }
    } catch (err) {
      console.error('Fix all error:', err);
    }
  }, [rawContent, activeActivityId, getAuthHeaders, parseData]);

  const handleRawEdit = useCallback(async (newRawContent: string) => {
    if (!newRawContent) return;
    try {
      const res = await fetch('/api/validate-raw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ raw_content: newRawContent }),
      });
      const data = await res.json();
      if (data.corrected_content) {
        setRawContent(data.corrected_content);
        setParseData((prev) =>
          prev
            ? {
              ...prev,
              validation_result: data.validation_result,
              parse_result: data.parse_result
                ? { ...data.parse_result, raw_content: data.corrected_content }
                : prev.parse_result,
            }
            : prev
        );
      }
    } catch (err) {
      console.error('Raw edit error:', err);
    }
  }, []);

  const handleExport = useCallback(
    async (format: string) => {
      if (!rawContent) return;
      try {
        const isOriginal = format === 'original';
        const exportFormat = isOriginal ? 'edi' : format;
        const targetContent = isOriginal ? initialRawContent : rawContent;

        const res = await fetch('/api/export', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({ raw_content: targetContent, format: exportFormat }),
        });

        if (exportFormat === 'json') {
          const data = await res.json();
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'edi_parsed.json';
          a.click();
          URL.revokeObjectURL(url);
          return;
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = exportFormat === 'edi' ? (isOriginal ? 'original.edi' : 'corrected.edi') : 'errors.csv';
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Export error:', err);
      }
    },
    [rawContent, initialRawContent, getAuthHeaders],
  );

  const handleSaveProgress = useCallback(async () => {
    if (!rawContent || !parseData) return;
    setLoading(true);
    try {
      const blob = new Blob([rawContent], { type: 'text/plain' });
      const formData = new FormData();
      formData.append('file', blob, parseData.file_name || 'saved_progress.edi');

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setSaveMessage({ text: 'Progress saved to history!', type: 'success' });
        // Optionally update initialRawContent to match rawContent if we want "original" to refer to this new point
        // setInitialRawContent(rawContent);
        // Updating parseData so the UI might reflect new transaction details if needed
        handleFileProcessed(data);
        setTimeout(() => setSaveMessage(null), 4000);
      } else {
        setSaveMessage({ text: 'Failed to save progress.', type: 'error' });
        setTimeout(() => setSaveMessage(null), 4000);
      }
    } catch (err) {
      console.error('Save progress error:', err);
      setSaveMessage({ text: 'An error occurred while saving.', type: 'error' });
      setTimeout(() => setSaveMessage(null), 4000);
    } finally {
      setLoading(false);
    }
  }, [rawContent, parseData, getAuthHeaders, handleFileProcessed]);


  // Show auth screen if user is not authenticated and not a guest
  if (!authToken && !isGuest) {
    return <AuthScreen onAuth={handleAuth} onGuest={handleGuest} />;
  }

  if (activeTab === 'chat') {
    return (
      <>
        <Navbar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          hasResults={!!parseData}
          hasFixedFile={rawContent !== initialRawContent}
          onExport={parseData ? handleExport : undefined}
          user={user}
          onLogout={handleLogout}
        />
        <AIChatPanel
          context={rawContent || undefined}
          parsedContext={parseData ? JSON.stringify(parseData.parse_result, null, 2) : undefined}
          onBack={() => setActiveTab(parseData ? 'results' : 'upload')}
          getAuthHeaders={getAuthHeaders}
        />
      </>
    );
  }

  return (
    <>
      <div className="app-shell">
        <div className="app-bg app-bg-primary" />
        <div className="app-bg app-bg-secondary" />
        <div className="app-bg app-bg-grid" />

        <Navbar activeTab={activeTab} onTabChange={setActiveTab} hasResults={!!parseData} hasFixedFile={rawContent !== initialRawContent} onExport={parseData ? handleExport : undefined} user={user} isGuest={isGuest} onLogout={handleLogout} />

        <div className="app-frame">

          {loading && (
            <div className="progress-rail" aria-label="Processing file">
              <div className="progress-bar" />
            </div>
          )}

          <main className="main-content">
            {activeTab === 'upload' && (
              <section className="upload-layout animate-fade-in">
                <HeroSection onScrollToUpload={handleScrollToUpload} />

                <FileUpload
                  onFileProcessed={handleFileProcessed}
                  onRawContent={(c) => { setRawContent(c); setInitialRawContent(c); }}
                  onLoading={setLoading}
                  getAuthHeaders={getAuthHeaders}
                />

                <TrendingSection />
              </section>
            )}

            {activeTab === 'history' && (
              <section className="history-layout animate-fade-in">
                <HistoryDashboard
                  getAuthHeaders={getAuthHeaders}
                  isGuest={isGuest}
                  onContinueFixing={async (activityId, metadata) => {
                    let fileText = '';
                    // Always fetch from cloud via authenticated endpoint
                    try {
                      const fileRes = await fetch(`/api/download-activity/${activityId}`, {
                        headers: getAuthHeaders()
                      });
                      if (fileRes.ok) fileText = await fileRes.text();
                    } catch (err) {
                      console.error('Failed to load file from cloud:', err);
                    }

                    if (fileText) {
                      try {
                        setLoading(true);
                        // Re-parse through the backend
                        const blob = new Blob([fileText], { type: 'text/plain' });
                        const formData = new FormData();
                        formData.append('file', blob, metadata.file_name || 'resume.edi');

                        const parseRes = await fetch('/api/upload', {
                          method: 'POST',
                          headers: getAuthHeaders(),
                          body: formData,
                        });
                        const data = await parseRes.json();

                        if (data.success) {
                          setActiveActivityId(activityId);
                          setRawContent(data.parse_result.raw_content);
                          setInitialRawContent(data.parse_result.raw_content);
                          await handleFileProcessed(data);
                          setActiveTab('results');
                          setActiveSection('validation');
                        }
                      } catch (err) {
                        console.error('Failed to process file for fixing:', err);
                        alert('Error processing file.');
                      } finally {
                        setLoading(false);
                      }
                    } else {
                      alert('The file content is no longer available in cloud. Please upload a new file.');
                    }
                  }}
                  onViewResult={async (activityId, metadata) => {
                    let fileText = '';
                    // Always fetch from cloud via authenticated endpoint
                    try {
                      const fileRes = await fetch(`/api/download-activity/${activityId}`, {
                        headers: getAuthHeaders()
                      });
                      if (fileRes.ok) fileText = await fileRes.text();
                    } catch (err) {
                      console.error('Failed to load file from cloud:', err);
                    }

                    if (fileText) {
                      try {
                        setLoading(true);
                        const blob = new Blob([fileText], { type: 'text/plain' });
                        const formData = new FormData();
                        formData.append('file', blob, metadata.file_name || 'file.edi');

                        const parseRes = await fetch('/api/upload', {
                          method: 'POST',
                          headers: getAuthHeaders(),
                          body: formData,
                        });
                        const data = await parseRes.json();

                        if (data.success) {
                          setActiveActivityId(activityId);
                          setRawContent(data.parse_result.raw_content);
                          setInitialRawContent(data.parse_result.raw_content);
                          await handleFileProcessed(data);
                          setActiveTab('results');
                          setActiveSection('summary');
                        }
                      } catch (err) {
                        console.error('Failed to process file for analytics:', err);
                        alert('Error processing file.');
                      } finally {
                        setLoading(false);
                      }
                    } else {
                      alert('The file content is no longer available in cloud. Please upload a new file.');
                    }
                  }}
                />
              </section>
            )}

            {activeTab === 'results' && parseData && (
              <section className="results-layout animate-fade-in">
                {/* ── BATCH FILE NAVIGATOR ── */}
                {isBatchMode && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 12, padding: '12px 20px', marginBottom: 16,
                    borderRadius: 16, border: '1px solid var(--border)',
                    background: 'var(--bg-elevated)',
                  }}>
                    <button
                      onClick={() => handleBatchNav(batchIndex - 1)}
                      disabled={batchIndex <= 0}
                      style={{
                        background: batchIndex <= 0 ? 'transparent' : 'rgba(84,208,255,0.1)',
                        border: '1px solid', borderColor: batchIndex <= 0 ? 'var(--border)' : 'rgba(84,208,255,0.3)',
                        borderRadius: 10, padding: '8px 16px', cursor: batchIndex <= 0 ? 'not-allowed' : 'pointer',
                        color: batchIndex <= 0 ? 'var(--muted)' : '#54d0ff',
                        fontWeight: 700, fontSize: '0.8rem', fontFamily: 'inherit',
                        opacity: batchIndex <= 0 ? 0.5 : 1, transition: 'all 0.2s',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                      Prev
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                      {batchFiles.map((bf, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleBatchNav(idx)}
                          style={{
                            padding: '6px 14px', borderRadius: 10, cursor: 'pointer',
                            fontSize: '0.75rem', fontWeight: idx === batchIndex ? 700 : 500,
                            fontFamily: 'inherit', transition: 'all 0.2s',
                            border: '1px solid',
                            background: idx === batchIndex ? 'rgba(74,222,128,0.15)' : 'transparent',
                            borderColor: idx === batchIndex ? 'rgba(74,222,128,0.4)' : 'var(--border)',
                            color: idx === batchIndex ? '#4ade80' : 'var(--muted)',
                          }}
                        >
                          {bf.fileName.length > 20 ? bf.fileName.slice(0, 18) + '…' : bf.fileName}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => handleBatchNav(batchIndex + 1)}
                      disabled={batchIndex >= batchFiles.length - 1}
                      style={{
                        background: batchIndex >= batchFiles.length - 1 ? 'transparent' : 'rgba(84,208,255,0.1)',
                        border: '1px solid', borderColor: batchIndex >= batchFiles.length - 1 ? 'var(--border)' : 'rgba(84,208,255,0.3)',
                        borderRadius: 10, padding: '8px 16px', cursor: batchIndex >= batchFiles.length - 1 ? 'not-allowed' : 'pointer',
                        color: batchIndex >= batchFiles.length - 1 ? 'var(--muted)' : '#54d0ff',
                        fontWeight: 700, fontSize: '0.8rem', fontFamily: 'inherit',
                        opacity: batchIndex >= batchFiles.length - 1 ? 0.5 : 1, transition: 'all 0.2s',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      Next
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  </div>
                )}

                <div className="results-header">
                  <div>
                    <div className="results-eyebrow">{isBatchMode ? `File ${batchIndex + 1} of ${batchFiles.length}` : 'Current transaction'}</div>
                    <div className="results-title-row">
                      <span className="transaction-pill">{parseData.transaction_type}</span>
                      <h2>{parseData.transaction_type_label}</h2>
                    </div>
                    {isBatchMode && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 4, fontFamily: 'var(--font-mono, monospace)' }}>
                        {batchFiles[batchIndex]?.fileName}
                      </div>
                    )}
                  </div>

                  <div className="results-meta">
                    <div className="meta-block">
                      <span>Segments</span>
                      <strong>{parseData.parse_result?.segment_count ?? 0}</strong>
                    </div>
                    {parseData.parse_result?.sender_id && (
                      <div className="meta-block">
                        <span>Sender</span>
                        <strong>{parseData.parse_result.sender_id}</strong>
                      </div>
                    )}
                    {parseData.parse_result?.receiver_id && (
                      <div className="meta-block">
                        <span>Receiver</span>
                        <strong>{parseData.parse_result.receiver_id}</strong>
                      </div>
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {saveMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: -20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -20, scale: 0.9 }}
                      className={`absolute top-24 right-8 px-4 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-3 border backdrop-blur-md ${
                        saveMessage.type === 'success' 
                          ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                          : 'bg-red-500/10 border-red-500/30 text-red-400'
                      }`}
                    >
                      {saveMessage.type === 'success' ? (
                        <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      ) : (
                        <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      )}
                      <span className="font-semibold text-[0.85rem]">{saveMessage.text}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="results-workspace">
                  {activeSection === 'validation' && (
                    <motion.div layoutId="workspace-validation" className="workspace-center-panel" transition={{ type: 'spring', stiffness: 90, damping: 20, mass: 1.2 }}>
                      <ValidationPanel
                        validation={parseData.validation_result}
                        rawContent={rawContent}
                        initialRawContent={initialRawContent}
                        onFix={handleFix}
                        onFixAll={handleFixAll}
                        onRawEdit={handleRawEdit}
                        onSaveProgress={handleSaveProgress}
                      />
                    </motion.div>
                  )}
                  {activeSection === 'parsed' && (
                    <motion.div layoutId="workspace-parsed" className="workspace-center-panel" transition={{ type: 'spring', stiffness: 90, damping: 20, mass: 1.2 }}>
                      <ParsedTreeViewer
                        loops={parseData.parse_result?.loops || []}
                        transactionType={parseData.transaction_type}
                      />
                    </motion.div>
                  )}
                  {activeSection === 'summary' && parseData.transaction_type === '835' && remittance && (
                    <motion.div layoutId="workspace-summary" className="workspace-center-panel" transition={{ type: 'spring', stiffness: 90, damping: 20, mass: 1.2 }}>
                      <RemittanceSummary summary={remittance} />
                    </motion.div>
                  )}
                  {activeSection === 'summary' && parseData.transaction_type === '834' && enrollment && (
                    <motion.div layoutId="workspace-summary" className="workspace-center-panel" transition={{ type: 'spring', stiffness: 90, damping: 20, mass: 1.2 }}>
                      <EnrollmentDashboard summary={enrollment} />
                    </motion.div>
                  )}
                </div>
              </section>
            )}
          </main>

          <footer className="app-footer">
            <p>ClaimGuard hackathon build for EDI parsing, validation, and remediation workflows.</p>
          </footer>
        </div>
      </div>

      <AnimatePresence>
        {activeTab === 'results' && parseData && (() => {
          const allSections: { id: SectionId; label: string; content: React.ReactNode }[] = [
            { id: 'validation', label: 'Validation Results', content: <ValidationPanel validation={parseData.validation_result} rawContent={rawContent} initialRawContent={initialRawContent} onFix={handleFix} onFixAll={handleFixAll} onRawEdit={handleRawEdit} onSaveProgress={handleSaveProgress} /> },
            { id: 'parsed', label: 'Parsed Structure', content: <ParsedTreeViewer loops={parseData.parse_result?.loops || []} transactionType={parseData.transaction_type} /> },
          ];
          if (parseData.transaction_type === '835' && remittance) {
            allSections.push({ id: 'summary', label: 'Remittance Summary', content: <RemittanceSummary summary={remittance} /> });
          } else if (parseData.transaction_type === '834' && enrollment) {
            allSections.push({ id: 'summary', label: 'Enrollment Dashboard', content: <EnrollmentDashboard summary={enrollment} /> });
          }
          const inactive = allSections.filter(s => s.id !== activeSection);
          return inactive.map((section, index) => (
            <motion.div
              layoutId={`workspace-${section.id}`}
              key={section.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9, transition: { duration: 0.15 } }}
              className={`workspace-popup ${index === 0 ? 'workspace-popup-left' : 'workspace-popup-right'}`}
              onClick={() => handlePopupClick(section.id)}
              transition={{ type: 'spring', stiffness: 90, damping: 20, mass: 1.2 }}
              whileHover={{ y: -6, scale: 1.03, boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 30px rgba(74,222,128,0.2)' }}
              whileTap={{ scale: 0.94 }}
              style={{ perspective: 1000, transformOrigin: 'bottom center', zIndex: 100 }}
            >
              <div className="popup-title">{section.label}</div>
              <div className="popup-preview-content">
                {section.content}
              </div>
            </motion.div>
          ));
        })()}
      </AnimatePresence>
    </>
  );
}