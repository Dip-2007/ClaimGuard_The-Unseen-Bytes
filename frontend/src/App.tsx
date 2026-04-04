import { useState, useCallback, useRef } from 'react';
import FileUpload from './components/FileUpload';
import ParsedTreeViewer from './components/ParsedTreeViewer';
import ValidationPanel from './components/ValidationPanel';
import AIChatPanel from './components/AIChatPanel';
import RemittanceSummary from './components/RemittanceSummary';
import EnrollmentDashboard from './components/EnrollmentDashboard';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import TrendingSection from './components/TrendingSection';

type TabId = 'upload' | 'results' | 'chat';
type SectionId = 'validation' | 'parsed' | 'summary';

interface ParseData {
  parse_result: any;
  validation_result: any;
  transaction_type: string;
  transaction_type_label: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('upload');
  const [activeSection, setActiveSection] = useState<SectionId>('validation');
  const [animOutDir, setAnimOutDir] = useState<'left' | 'right' | null>(null);
  const [animInDir, setAnimInDir] = useState<'left' | 'right' | null>(null);
  const animTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileUploadRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);

  const handleScrollToUpload = useCallback(() => {
    fileUploadRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const handlePopupClick = useCallback((sectionId: SectionId, popupIndex: number) => {
    const dir = popupIndex === 0 ? 'left' : 'right';
    setAnimOutDir(dir);
    if (animTimeout.current) clearTimeout(animTimeout.current);
    animTimeout.current = setTimeout(() => {
      setActiveSection(sectionId);
      setAnimOutDir(null);
      setAnimInDir(dir);
    }, 300);
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
          headers: { 'Content-Type': 'application/json' },
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
          headers: { 'Content-Type': 'application/json' },
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
          headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw_content: rawContent, format }),
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

  if (activeTab === 'chat') {
    return (
      <>
        <Navbar activeTab={activeTab} onTabChange={setActiveTab} hasResults={!!parseData} onExport={parseData ? handleExport : undefined} />
        <AIChatPanel
          context={rawContent || undefined}
          parsedContext={parseData ? JSON.stringify(parseData.parse_result, null, 2) : undefined}
          onBack={() => setActiveTab(parseData ? 'results' : 'upload')}
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

        <Navbar activeTab={activeTab} onTabChange={setActiveTab} hasResults={!!parseData} onExport={parseData ? handleExport : undefined} />

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

                <div ref={fileUploadRef}>
                  <FileUpload
                    onFileProcessed={handleFileProcessed}
                    onRawContent={(c) => { setRawContent(c); setInitialRawContent(c); }}
                    onLoading={setLoading}
                  />
                </div>

                <TrendingSection />
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

                <div className={`results-workspace ${animOutDir ? 'ws-out-' + animOutDir : ''} ${animInDir ? 'ws-in-' + animInDir : ''} ${!animOutDir && !animInDir ? 'ws-initial' : ''}`}>
                  {activeSection === 'validation' && (
                    <div className="workspace-center-panel">
                      <ValidationPanel
                        validation={parseData.validation_result}
                        rawContent={rawContent}
                        initialRawContent={initialRawContent}
                        onFix={handleFix}
                        onFixAll={handleFixAll}
                        onRawEdit={handleRawEdit}
                      />
                    </div>
                  )}
                  {activeSection === 'parsed' && (
                    <div className="workspace-center-panel">
                      <ParsedTreeViewer
                        loops={parseData.parse_result?.loops || []}
                        transactionType={parseData.transaction_type}
                      />
                    </div>
                  )}
                  {activeSection === 'summary' && parseData.transaction_type === '835' && remittance && (
                    <div className="workspace-center-panel">
                      <RemittanceSummary summary={remittance} />
                    </div>
                  )}
                  {activeSection === 'summary' && parseData.transaction_type === '834' && enrollment && (
                    <div className="workspace-center-panel">
                      <EnrollmentDashboard summary={enrollment} />
                    </div>
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
          <div
            key={section.id}
            className={`workspace-popup ${index === 0 ? 'workspace-popup-left' : 'workspace-popup-right'}`}
            onClick={() => handlePopupClick(section.id, index)}
          >
            <div className="popup-title">{section.label}</div>
            <div className="popup-preview-content">
              {section.content}
            </div>
          </div>
        ));
      })()}
    </>
  );
}