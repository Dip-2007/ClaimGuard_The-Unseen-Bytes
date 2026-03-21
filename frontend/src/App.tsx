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

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('upload');
  const [loading, setLoading] = useState(false);
  const [parseData, setParseData] = useState<ParseData | null>(null);
  const [rawContent, setRawContent] = useState<string>('');
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
      } catch { /* graceful fail */ }
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
      } catch { /* graceful fail */ }
    }
  }, []);

  const handleFix = useCallback(async (errorId: string, fixValue: string) => {
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
        setParseData((prev) => prev ? { ...prev, validation_result: data.validation_result } : prev);
      }
    } catch (err) {
      console.error('Fix error:', err);
    }
  }, [rawContent]);

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
        setParseData((prev) => prev ? { ...prev, validation_result: data.validation_result } : prev);
      }
    } catch (err) {
      console.error('Fix all error:', err);
    }
  }, [rawContent]);

  const handleExport = useCallback(async (format: string) => {
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
      } else {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = format === 'edi' ? 'corrected.edi' : 'errors.csv';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Export error:', err);
    }
  }, [rawContent]);

  return (
    <div className="min-h-screen relative overflow-hidden text-slate-200">
      
      {/* Background glow effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-indigo-900/20 rounded-full blur-[100px] pointer-events-none" />

      {/* Ultra-Wide Dynamic Island Navbar */}
      <header className="fixed top-6 w-[96%] max-w-[1800px] left-1/2 -translate-x-1/2 z-50">
        <div className="relative flex items-center justify-between px-8 h-[72px] bg-black/60 backdrop-blur-xl border border-blue-900/40 rounded-[36px] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          
          {/* Logo - Left */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 shadow-[0_0_15px_rgba(37,99,235,0.5)] flex items-center justify-center text-white font-bold text-base">
              ⚡
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight hidden lg:block">ClaimGuard</h1>
          </div>

          {/* Nav Tabs */}
          <nav className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-4 bg-black/40 p-1.5 rounded-full border border-white/5">
            {[
              { id: 'upload' as TabId, label: 'Upload', show: true },
              { id: 'results' as TabId, label: 'Results', show: !!parseData },
              { id: 'chat' as TabId, label: 'AI Chat', show: true },
            ].filter(t => t.show).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-2 rounded-full text-sm font-semibold transition-all duration-300 border ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-400 bg-blue-500/10 shadow-[0_0_15px_rgba(37,99,235,0.3)]'
                    : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Export Buttons - Right */}
          <div className="flex gap-4">
            {parseData && (
              <>
                <button onClick={() => handleExport('json')} className="btn-secondary text-xs font-bold py-1.5 px-4 rounded-full">JSON</button>
                <button onClick={() => handleExport('edi')} className="btn-secondary text-xs font-bold py-1.5 px-4 rounded-full">EDI</button>
                <button onClick={() => handleExport('csv')} className="btn-secondary text-xs font-bold py-1.5 px-4 rounded-full">CSV</button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Loading Bar */}
      {loading && (
        <div className="fixed top-[104px] left-0 w-full h-1 bg-black z-40">
          <div className="h-full bg-blue-500 w-2/3 animate-pulse shadow-[0_0_10px_#3b82f6]" />
        </div>
      )}

      {/* Main Content */}
      <main className="w-full flex flex-col items-center px-6 pb-16 relative z-10">
        
        {/* 🚀 FOOLPROOF SPACER: This physically pushes all content down below the 96px navbar */}
        <div className="w-full h-[160px] pointer-events-none shrink-0" aria-hidden="true" />
        
        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div className="w-full max-w-7xl flex flex-col items-center justify-center mx-auto">
            {/* Hero */}
            <div className="text-center mb-10 animate-fade-in delay-100 flex flex-col items-center justify-center w-full">
              <h2 className="text-4xl md:text-6xl font-extrabold mb-6 w-full text-center tracking-tight bg-gradient-to-r from-white via-blue-100 to-blue-400 bg-clip-text text-transparent pb-2">
                Parse & Validate EDI Files
              </h2>
              <p className="text-slate-400 max-w-2xl text-lg leading-relaxed font-medium text-center mx-auto w-full">
                Upload X12 837P/837I, 835, or 834 files for instant structural parsing,
                HIPAA 5010 validation, AI error explanations, and deterministic fixes.
              </p>
            </div>

            <div className="w-full max-w-3xl flex flex-col items-center mx-auto animate-fade-in delay-200">
              <FileUpload
                onFileProcessed={handleFileProcessed}
                onRawContent={setRawContent}
                onLoading={setLoading}
              />
            </div>

            {/* Feature Grid */}
            <div className="w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 mb-12 animate-fade-in delay-300">
              {[
                { title: 'Parse', desc: 'Recursive-descent hierarchy mapping' },
                { title: 'Validate', desc: 'HIPAA 5010 compliance rules' },
                { title: 'Auto-Fix', desc: 'Deterministic error correction' },
                { title: 'AI Assistant', desc: 'Gemini-powered claim diagnosis' },
                { title: '835 Remittance', desc: 'Automated claim payment extraction' },
                { title: '834 Enrollment', desc: 'Member dashboard with additions' },
              ].map((feature, i) => (
                <div key={i} className="group rounded-2xl bg-[#080B12] border border-blue-900/30 p-6 hover:border-blue-500/50 hover:bg-[#0A1020] transition-all duration-300 hover:-translate-y-1 shadow-lg hover:shadow-[0_8px_30px_rgba(37,99,235,0.12)]">
                  <h3 className="text-lg font-bold text-white tracking-wide mb-3 group-hover:text-blue-400 transition-colors">{feature.title}</h3>
                  <p className="text-sm text-slate-400 font-medium leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results Tab */}
        {activeTab === 'results' && parseData && (
          <div className="w-full max-w-[1400px] mx-auto space-y-6 animate-fade-in">
            {/* File Info Bar */}
            <div className="glass-card p-5 flex items-center justify-between border-l-4 border-l-blue-500">
              <div className="flex items-center gap-4">
                <span className="px-3 py-1 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-full text-sm font-bold shadow-[0_0_10px_rgba(37,99,235,0.2)]">
                  {parseData.transaction_type}
                </span>
                <span className="text-white font-bold text-lg">{parseData.transaction_type_label}</span>
                <span className="text-xs text-slate-400 bg-white/5 px-2 py-1 rounded">
                  {parseData.parse_result?.segment_count} segments
                </span>
              </div>
              <div className="flex items-center gap-6 text-sm">
                {parseData.parse_result?.sender_id && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Sender</span>
                    <span className="text-blue-300 font-mono bg-blue-900/30 px-2 py-0.5 rounded">{parseData.parse_result.sender_id}</span>
                  </div>
                )}
                {parseData.parse_result?.receiver_id && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Receiver</span>
                    <span className="text-blue-300 font-mono bg-blue-900/30 px-2 py-0.5 rounded">{parseData.parse_result.receiver_id}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

            {/* 835 Remittance Summary */}
            {parseData.transaction_type === '835' && remittance && (
              <RemittanceSummary summary={remittance} />
            )}

            {/* 834 Enrollment Dashboard */}
            {parseData.transaction_type === '834' && enrollment && (
              <EnrollmentDashboard summary={enrollment} />
            )}
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div className="w-full max-w-5xl mx-auto animate-fade-in">
            <AIChatPanel context={rawContent || undefined} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-black/40 backdrop-blur-md py-6 text-center mt-auto z-10 relative">
        <p className="text-sm font-medium text-slate-500">EDI ClaimGuard <span className="mx-2 text-blue-900">•</span> Hackathon Project</p>
      </footer>
    </div>
  );
}