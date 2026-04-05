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

interface ParseData {
  parse_result: any;
  validation_result: any;
  transaction_type: string;
  transaction_type_label: string;
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

  const handlePopupClick = useCallback((sectionId: SectionId) => {
    setActiveSection(sectionId);
  }, []);
  const [parseData, setParseData] = useState<ParseData | null>(null);
  const [rawContent, setRawContent] = useState('');
  const [initialRawContent, setInitialRawContent] = useState('');
  const [remittance, setRemittance] = useState<any>(null);
  const [enrollment, setEnrollment] = useState<any>(null);

  const handleFileProcessed = useCallback(async (data: any) => {
    setParseData(data);
    setActiveTab('results');

    if (data.transaction_type === '835' && data.parse_result?.raw_content) {
      try {
        const res = await fetch('/api/remittance-summary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({ raw_content: data.parse_result.raw_content }),
        });
        const summary = await res.json();
        setRemittance(summary);
      } catch {
        setRemittance(null);
      }
    } else {
      setRemittance(null);
    }

    if (data.transaction_type === '834' && data.parse_result?.raw_content) {
      try {
        const res = await fetch('/api/enrollment-summary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({ raw_content: data.parse_result.raw_content }),
        });
        const summary = await res.json();
        setEnrollment(summary);
      } catch {
        setEnrollment(null);
      }
    } else {
      setEnrollment(null);
    }
  }, []);

  const handleFix = useCallback(
    async (errorId: string, fixValue: string, lineNumber: number = 0, elementIndex: number = -1) => {
      if (!rawContent) return;
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
        console.error('Fix error:', err);
      }
    },
    [rawContent],
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

      }
    } catch (err) {
      console.error('Fix all error:', err);
    }
  }, [rawContent]);

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
        const res = await fetch('/api/export', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({ raw_content: rawContent, format: format }),
        });

        if (format === 'json') {
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
        a.download = format === 'edi' ? 'corrected.edi' : 'errors.csv';
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Export error:', err);
      }
    },
    [rawContent],
  );


  // Show auth screen if user is not authenticated and not a guest
  if (!authToken && !isGuest) {
    return <AuthScreen onAuth={handleAuth} onGuest={handleGuest} />;
  }

  if (activeTab === 'chat') {
    return (
      <>
        <Navbar activeTab={activeTab} onTabChange={setActiveTab} hasResults={!!parseData} onExport={parseData ? handleExport : undefined} user={user} onLogout={handleLogout} />
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

        <Navbar activeTab={activeTab} onTabChange={setActiveTab} hasResults={!!parseData} onExport={parseData ? handleExport : undefined} user={user} isGuest={isGuest} onLogout={handleLogout} />

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
                  onViewResult={(metadata) => {
                    if (metadata.cloudinary_url) {
                      window.open(metadata.cloudinary_url, '_blank');
                    }
                  }}
                />
              </section>
            )}

            {activeTab === 'results' && parseData && (
              <section className="results-layout animate-fade-in">
                <div className="results-header">
                  <div>
                    <div className="results-eyebrow">Current transaction</div>
                    <div className="results-title-row">
                      <span className="transaction-pill">{parseData.transaction_type}</span>
                      <h2>{parseData.transaction_type_label}</h2>
                    </div>
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
            { id: 'validation', label: 'Validation Results', content: <ValidationPanel validation={parseData.validation_result} rawContent={rawContent} initialRawContent={initialRawContent} onFix={handleFix} onFixAll={handleFixAll} onRawEdit={handleRawEdit} /> },
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