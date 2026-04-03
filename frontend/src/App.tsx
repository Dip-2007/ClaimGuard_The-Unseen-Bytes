import { useState, useCallback } from 'react';
import FileUpload from './components/FileUpload';
import ParsedTreeViewer from './components/ParsedTreeViewer';
import ValidationPanel from './components/ValidationPanel';
import AIChatPanel from './components/AIChatPanel';
import RemittanceSummary from './components/RemittanceSummary';
import EnrollmentDashboard from './components/EnrollmentDashboard';

type TabId = 'upload' | 'results' | 'chat';

interface ParseData {
  parse_result: any;
  validation_result: any;
  transaction_type: string;
  transaction_type_label: string;
}

const capabilityCards = [
  {
    eyebrow: 'Parse',
    title: 'Readable X12 structure',
    description: 'Turn flat EDI text into loop trees, segment maps, and transaction-aware summaries.',
  },
  {
    eyebrow: 'Validate',
    title: 'Faster compliance review',
    description: 'Surface errors, warnings, and context-rich suggestions in one operator-friendly panel.',
  },
  {
    eyebrow: 'Repair',
    title: 'Deterministic fixes',
    description: 'Apply targeted corrections and export cleaned payloads without leaving the workflow.',
  },
];

const supportedTransactions = ['837P / 837I claims', '835 remittance', '834 enrollment'];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('upload');
  const [loading, setLoading] = useState(false);
  const [parseData, setParseData] = useState<ParseData | null>(null);
  const [rawContent, setRawContent] = useState('');
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
    async (errorId: string, fixValue: string) => {
      if (!rawContent) return;
      try {
        const res = await fetch('/api/fix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error_id: errorId, fix_value: fixValue, raw_content: rawContent }),
        });
        const data = await res.json();
        if (data.corrected_content) {
          setRawContent(data.corrected_content);
          setParseData((prev) => (prev ? { ...prev, validation_result: data.validation_result } : prev));
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
        setParseData((prev) => (prev ? { ...prev, validation_result: data.validation_result } : prev));
      }
    } catch (err) {
      console.error('Fix all error:', err);
    }
  }, [rawContent]);

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

  const tabs = [
    { id: 'upload' as TabId, label: 'Workspace', available: true },
    { id: 'results' as TabId, label: 'Results', available: !!parseData },
    { id: 'chat' as TabId, label: 'AI Guide', available: true },
  ].filter((tab) => tab.available);

  if (activeTab === 'chat') {
    return <AIChatPanel 
       context={rawContent || undefined} 
       parsedContext={parseData ? JSON.stringify(parseData.parse_result, null, 2) : undefined}
       onBack={() => setActiveTab(parseData ? 'results' : 'upload')} 
    />;
  }

  return (
    <div className="app-shell">
      <div className="app-bg app-bg-primary" />
      <div className="app-bg app-bg-secondary" />
      <div className="app-bg app-bg-grid" />

      <div className="app-frame">
        <header className="topbar">
          <div className="brand-mark">
            <div className="brand-badge">CG</div>
            <div>
              <p className="brand-title">ClaimGuard</p>
              <p className="brand-subtitle">EDI triage cockpit</p>
            </div>
          </div>

          <nav className="topbar-nav" aria-label="Primary">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab-pill ${activeTab === tab.id ? 'tab-pill-active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="topbar-actions">
            {parseData ? (
              <>
                <button onClick={() => handleExport('json')} className="btn-secondary compact">
                  Export JSON
                </button>
                <button onClick={() => handleExport('edi')} className="btn-secondary compact">
                  Export EDI
                </button>
                <button onClick={() => handleExport('csv')} className="btn-secondary compact">
                  Export CSV
                </button>
              </>
            ) : (
              <span className="status-chip subtle">Ready for upload</span>
            )}
          </div>
        </header>

        {loading && (
          <div className="progress-rail" aria-label="Processing file">
            <div className="progress-bar" />
          </div>
        )}

        <main className="main-content">
          {activeTab === 'upload' && (
            <section className="upload-layout animate-fade-in">
              <div className="hero-panel glass-card">
                <div className="hero-copy">
                  <span className="eyebrow">EDI operations, redesigned</span>
                  <h1 className="hero-title">Parse, validate, repair, and review healthcare transactions in one calm workspace.</h1>
                  <p className="hero-description">
                    Built for hackathon speed, but styled like a real product. Upload a live file or try a sample to inspect
                    structural loops, validation findings, remittance totals, and enrollment changes in minutes.
                  </p>

                  <div className="hero-badges">
                    {supportedTransactions.map((item) => (
                      <span key={item} className="status-chip">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="hero-stats">
                  <div className="metric-card">
                    <span className="metric-label">Focus</span>
                    <strong>Cleaner claim workflows</strong>
                    <p>Designed to reduce context switching from upload to AI support.</p>
                  </div>
                  <div className="metric-card">
                    <span className="metric-label">Output</span>
                    <strong>Human-readable diagnostics</strong>
                    <p>Validation issues and summaries stay legible even on dense files.</p>
                  </div>
                </div>
              </div>

              <FileUpload onFileProcessed={handleFileProcessed} onRawContent={setRawContent} onLoading={setLoading} />

              <div className="feature-grid">
                {capabilityCards.map((card) => (
                  <article key={card.title} className="feature-card glass-card glass-card-hover">
                    <span className="eyebrow">{card.eyebrow}</span>
                    <h2>{card.title}</h2>
                    <p>{card.description}</p>
                  </article>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'results' && parseData && (
            <section className="results-layout animate-fade-in">
              <div className="results-header glass-card">
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

              <div className="results-grid">
                <ParsedTreeViewer
                  loops={parseData.parse_result?.loops || []}
                  transactionType={parseData.transaction_type}
                />
                <ValidationPanel
                  validation={parseData.validation_result}
                  onFix={handleFix}
                  onFixAll={handleFixAll}
                />
              </div>

              {parseData.transaction_type === '835' && remittance && <RemittanceSummary summary={remittance} />}
              {parseData.transaction_type === '834' && enrollment && <EnrollmentDashboard summary={enrollment} />}
            </section>
          )}
        </main>

        <footer className="app-footer">
          <p>ClaimGuard hackathon build for EDI parsing, validation, and remediation workflows.</p>
        </footer>
      </div>
    </div>
  );
}
