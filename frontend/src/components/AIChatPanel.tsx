import { useState, useRef, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import MagicBento from './MagicBento';
import type { BentoCardProps } from './MagicBento';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
  isBookmarked?: boolean;
  attachedContext?: string;
  attachedFileName?: string;
  filterTag?: string;
}

interface AIChatPanelProps {
  context?: string;
  parsedContext?: string;
  onBack?: () => void;
}

type FolderType = 'All Chats' | 'Bookmarked' | 'With Attachments';

const renderMessageContent = (content: string) => {
  return (
    <div className="ai-markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-xl font-bold text-white mt-4 mb-2 border-b border-slate-700 pb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-bold text-white mt-4 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-semibold text-slate-200 mt-3 mb-1.5">{children}</h3>,
          h4: ({ children }) => <h4 className="text-sm font-semibold text-slate-300 mt-2 mb-1">{children}</h4>,
          p: ({ children }) => <p className="mb-3 leading-[1.8] text-slate-300">{children}</p>,
          strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
          em: ({ children }) => <em className="text-slate-400 italic">{children}</em>,
          ul: ({ children }) => <ul className="list-disc ml-5 mb-3 space-y-1 text-slate-300">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal ml-5 mb-3 space-y-1 text-slate-300">{children}</ol>,
          li: ({ children }) => <li className="leading-[1.7]">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-3 border-slate-500 pl-4 my-3 text-slate-400 italic bg-slate-800/30 py-2 rounded-r-lg">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300 transition">{children}</a>,
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 rounded-xl border border-slate-700">
              <table className="w-full text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-slate-800 text-slate-300 font-semibold">{children}</thead>,
          tbody: ({ children }) => <tbody className="divide-y divide-slate-700/50">{children}</tbody>,
          tr: ({ children }) => <tr className="hover:bg-slate-800/40 transition">{children}</tr>,
          th: ({ children }) => <th className="px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-400">{children}</th>,
          td: ({ children }) => <td className="px-4 py-2.5 text-slate-300">{children}</td>,
          hr: () => <hr className="border-slate-700 my-4" />,
          code: ({ className, children }) => {
            const isInline = !className;
            if (isInline) {
              return <code className="bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded text-[13px] font-mono border border-slate-700">{children}</code>;
            }
            const codeText = String(children).replace(/\n$/, '');
            return (
              <div className="my-4 bg-[#1a1a2e] rounded-2xl p-5 border border-slate-700 shadow-lg relative group">
                <button
                  className="absolute top-4 right-4 text-slate-400 opacity-0 group-hover:opacity-100 transition hover:text-white bg-slate-800 p-1.5 rounded-md border border-slate-700"
                  onClick={() => navigator.clipboard.writeText(codeText)}
                  title="Copy Code"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
                </button>
                <pre className="font-mono text-[13px] text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">{codeText}</pre>
              </div>
            );
          },
          pre: ({ children }) => <>{children}</>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default function AIChatPanel({ context: globalContext, parsedContext, onBack }: AIChatPanelProps) {
  const [isLight, setIsLight] = useState(document.documentElement.getAttribute('data-theme') === 'light');
  useEffect(() => {
    const check = () => setIsLight(document.documentElement.getAttribute('data-theme') === 'light');
    check(); // Sync on mount in case Navbar already set it
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const [activeFolder, setActiveFolder] = useState<FolderType>('All Chats');
  const [activeFilterTag, setActiveFilterTag] = useState('All');
  
  const [localAttachment, setLocalAttachment] = useState<{name: string, content: string} | null>(null);
  const [localParsedContext, setLocalParsedContext] = useState<string | null>(null);
  const [isViewingContext, setIsViewingContext] = useState(false);
  const [contextViewType, setContextViewType] = useState<'raw' | 'json'>('raw');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const effectiveContext = localAttachment ? localAttachment.content : globalContext;

  useEffect(() => {
    const stored = localStorage.getItem('claimguard_chat_sessions');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSessions(parsed);
      } catch (e) {
        console.error("Failed to parse chat sessions", e);
      }
    }
  }, []);

  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('claimguard_chat_sessions', JSON.stringify(sessions));
    } else {
      localStorage.removeItem('claimguard_chat_sessions');
    }
  }, [sessions]);

  useEffect(() => {
    if (activeSessionId) {
      const sess = sessions.find(s => s.id === activeSessionId);
      if (sess) {
        setMessages(sess.messages);
        setLocalAttachment(sess.attachedFileName ? { name: sess.attachedFileName, content: sess.attachedContext! } : null);
        setActiveFilterTag(sess.filterTag || 'All');
      }
    } else {
      setMessages([]);
      setLocalAttachment(null);
      setActiveFilterTag('All');
    }
  }, [activeSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  const createNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setInput('');
    setLocalAttachment(null);
    setLocalParsedContext(null);
    setActiveFilterTag('All');
  };

  const selectChat = (id: string) => {
    setActiveSessionId(id);
    const sess = sessions.find(s => s.id === id);
    if (sess) {
       setMessages(sess.messages);
    }
  };

  const deleteChat = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) {
      createNewChat();
    }
  };

  const toggleBookmark = () => {
    if (!activeSessionId) return;
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, isBookmarked: !s.isBookmarked } : s));
  };

  const exportChat = () => {
    if (!activeSession) return;
    const blob = new Blob([JSON.stringify(activeSession, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_${activeSession.title.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      setLocalAttachment({ name: file.name, content });
      
      // Attempt to parse it locally
      try {
        const res = await fetch('/api/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw_content: content, format: 'json' })
        });
        if (res.ok) {
          const data = await res.json();
          setLocalParsedContext(JSON.stringify(data.parse_result, null, 2));
        }
      } catch (err) {
        console.error("Failed to parse local attachment", err);
      }
      
      if (activeSessionId) {
        setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, attachedFileName: file.name, attachedContext: content } : s));
      }
    };
    reader.readAsText(file);
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = () => {
    setLocalAttachment(null);
    setLocalParsedContext(null);
    if (activeSessionId) {
      setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, attachedFileName: undefined, attachedContext: undefined } : s));
    }
  };

  const sendMessage = async (overrideInput?: string) => {
    const textToSend = overrideInput || input;
    if (!textToSend.trim() || loading) return;

    const prefix = activeFilterTag !== 'All' ? `[Filtering Context: ${activeFilterTag}]\n` : '';
    const fullText = prefix + textToSend.trim();

    const userMsg: ChatMessage = { role: 'user', content: fullText };
    const updatedMessages = [...messages, userMsg];
    
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    let currentId = activeSessionId;
    let isNewSession = false;

    if (!currentId) {
      currentId = Date.now().toString();
      isNewSession = true;
      setActiveSessionId(currentId);
    }

    setSessions(prev => {
      let nextState;
      if (isNewSession) {
        let title = textToSend.trim();
        if (title.length > 25) title = title.substring(0, 25) + "...";
        nextState = [{ 
          id: currentId as string, 
          title, 
          messages: updatedMessages, 
          updatedAt: Date.now(),
          attachedFileName: localAttachment?.name,
          attachedContext: localAttachment?.content,
          filterTag: activeFilterTag,
          isBookmarked: false
        }, ...prev];
      } else {
        nextState = prev.map(s => s.id === currentId ? { ...s, messages: updatedMessages, updatedAt: Date.now() } : s);
      }
      return nextState.sort((a, b) => b.updatedAt - a.updatedAt);
    });

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: fullText,
          context: effectiveContext || null,
          history: messages.slice(-6),
        }),
      });

      const data = await res.json();
      const replyContent = data.reply || data.error || 'No response received.';
      const astMsg: ChatMessage = { role: 'assistant', content: replyContent };
      const finaleMessages = [...updatedMessages, astMsg];
      
      setMessages(finaleMessages);

      setSessions(prev => {
        return prev.map(s => s.id === currentId ? { ...s, messages: finaleMessages, updatedAt: Date.now() } : s).sort((a, b) => b.updatedAt - a.updatedAt);
      });

    } catch (err: any) {
      const errMsg: ChatMessage = { role: 'assistant', content: `Error: ${err.message}` };
      const finaleMessages = [...updatedMessages, errMsg];
      
      setMessages(finaleMessages);
      setSessions(prev => {
        return prev.map(s => s.id === currentId ? { ...s, messages: finaleMessages, updatedAt: Date.now() } : s);
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  };

  let filteredSessions = sessions.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()));
  if (activeFolder === 'Bookmarked') {
    filteredSessions = filteredSessions.filter(s => s.isBookmarked);
  } else if (activeFolder === 'With Attachments') {
    filteredSessions = filteredSessions.filter(s => !!s.attachedContext);
  }

  const filterTabs = ['All', '837P Claims', '835 Remit', '834 Enroll', 'Context', 'History'];

  const chatCards: BentoCardProps[] = [
    {
       title: "Segment Analysis",
       description: "Understand complex X12 structural loops and elements.",
       onClick: () => sendMessage("Explain the ST, GS, and ISA segments format")
    },
    {
       title: "Denial Mitigation",
       description: "Analyze remittance advice against standard CARC/RARC codes.",
       onClick: () => sendMessage("Decode CARC code 45 and explain it")
    },
    {
       title: "Remediation Guide",
       description: "Get step-by-step suggestions to fix incorrect EDI payloads.",
       onClick: () => sendMessage("How do I fix a missing NM109 segment?")
    }
  ];

  return (
    <div className={`flex h-[100dvh] w-full ${isLight ? 'bg-[#f3f2ef] text-[#191919]' : 'bg-[#050907] text-slate-200'} font-sans fixed inset-0 z-50`}>
      
      <input 
        type="file" 
        accept=".txt,.edi,.csv,.json"
        ref={fileInputRef} 
        className="hidden" 
        onChange={handleFileUpload}
      />

      {/* Sidebar */}
      <div className={`w-[300px] flex-shrink-0 ${isLight ? 'bg-white border-r border-[#e0dfdc]' : 'bg-[#161616] border-r border-[#222]'} py-6 flex flex-col m-3 rounded-[24px] z-20 overflow-hidden`}>
        <div className="flex items-center gap-3 px-6 mb-6 cursor-pointer hover:opacity-80 transition" onClick={onBack}>
          <div className={`w-8 h-8 rounded-full ${isLight ? 'bg-[#e8e6e1]' : 'bg-[#3d3d3d]'} flex items-center justify-center`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          </div>
          <span className={`font-semibold text-[15px] ${isLight ? 'text-[#1a1a2e]' : 'text-white'} tracking-tight`}>ClaimGuard Chats</span>
        </div>

        <div className="relative mb-6 px-4">
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full ${isLight ? 'bg-[#f3f2ef]' : 'bg-[#2a2a2a]'} text-sm ${isLight ? 'text-[#1a1a2e]' : 'text-slate-300'} rounded-xl py-2 pl-10 pr-4 outline-none focus:ring-1 focus:ring-[#4ade80]`}
          />
          <svg className="absolute left-7 top-2.5 text-slate-400 w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 scrollbar-hide px-2">
          {/* Functional Folders Section */}
          <div>
            <div className="text-[11px] font-bold text-slate-500 mb-2 mt-2 flex justify-between items-center px-4">
              Folders
            </div>
            <div className="space-y-[1px]">
              {(['All Chats', 'Bookmarked', 'With Attachments'] as FolderType[]).map(folder => (
                <div 
                  key={folder} 
                  onClick={() => setActiveFolder(folder)}
                  className={`group flex items-center justify-between px-4 py-2.5 rounded-r-lg cursor-pointer text-[14px] transition border-l-[3px] ${activeFolder === folder ? `${isLight ? 'bg-[#e8f0ea]' : 'bg-[#1a2e22]'} border-[#4ade80] text-[#4ade80] font-medium` : `border-transparent ${isLight ? 'hover:bg-[#f3f2ef]' : 'hover:bg-[#202020]'} ${isLight ? 'text-[#666666]' : 'text-slate-300'}`}`}
                >
                  <div className="flex items-center gap-3">
                    <svg className={`w-[18px] h-[18px] ${activeFolder === folder ? 'text-[#4ade80]' : 'text-slate-500 group-hover:text-slate-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      {folder === 'Bookmarked' ? <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/> : folder === 'With Attachments' ? <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/> : <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>}
                    </svg>
                    <span className="truncate max-w-[150px]">{folder}</span>
                  </div>
                  <span className="text-slate-600 group-hover:text-slate-400 tracking-widest text-[10px] hidden group-hover:block">...</span>
                </div>
              ))}
            </div>
          </div>

          {/* Dynamic Chats Section */}
          <div>
            <div className="text-[11px] font-bold text-slate-500 mb-2 mt-2 flex justify-between items-center px-4">
              {searchQuery ? 'Search Results' : activeFolder}
            </div>
            
            {filteredSessions.length === 0 ? (
              <div className="px-4 py-2 text-xs text-slate-500 italic">No chats found.</div>
            ) : (
              <div className="space-y-[1px]">
                {filteredSessions.map((chat) => (
                  <div 
                    key={chat.id} 
                    onClick={() => selectChat(chat.id)}
                    className={`group flex flex-col px-4 py-2.5 rounded-r-lg cursor-pointer relative transition-colors border-l-[3px] ${activeSessionId === chat.id ? `${isLight ? 'bg-[#e8f0ea]' : 'bg-[#1a2e22]'} border-[#4ade80]` : `border-transparent ${isLight ? 'hover:bg-[#f3f2ef]' : 'hover:bg-[#202020]'}`}`}
                  >
                    <div className="flex items-center gap-3 text-[14px] text-slate-300">
                      <svg className={`w-[18px] h-[18px] shrink-0 ${activeSessionId === chat.id ? 'text-[#4ade80]' : 'text-slate-500'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      <span className={`truncate w-[140px] ${activeSessionId === chat.id ? 'font-medium text-[#4ade80]' : ''}`}>{chat.title}</span>
                      {chat.isBookmarked && (
                        <svg className="w-3.5 h-3.5 text-[#4ade80] ml-auto shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                      )}
                    </div>
                    
                    {(chat.filterTag && chat.filterTag !== 'All') && (
                      <div className="text-[10px] text-[#4ade80]/70 truncate mt-1 pl-[30px] opacity-80 group-hover:opacity-100">Tag: {chat.filterTag}</div>
                    )}

                    <button 
                      onClick={(e) => deleteChat(e, chat.id)}
                      className="absolute right-4 top-2.5 text-slate-600 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition"
                      title="Delete chat"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <button 
          onClick={createNewChat}
          className={`mt-4 mx-4 bg-[#4ade80] hover:bg-[#3dcc73] ${isLight ? 'text-white' : 'text-[#0a1a10]'} font-semibold py-3.5 px-4 rounded-[14px] flex items-center justify-between transition shadow-lg shadow-[#4ade80]/10`}
        >
          <span className="text-sm">New chat</span>
          <div className="bg-white/30 rounded text-black flex items-center justify-center w-5 h-5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14"/></svg>
          </div>
        </button>
      </div>

      {/* Main Container Area - No background gradient! purely dark as requested */}
      <div className={`flex-1 flex flex-col relative ${isLight ? 'bg-white' : 'bg-[#121212]'} m-3 ml-0 rounded-[24px]`}>
        
        {/* Top header with active functional buttons */}
        <div className="h-16 flex items-center px-10 z-10 w-full pt-6 justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="text-slate-400 hover:text-white transition flex items-center gap-2 text-[14px] font-medium tracking-wide">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
              Workspace
            </button>
            <div className="px-2.5 py-1 rounded bg-[#22c55e]/10 text-[#4ade80] text-[11px] font-bold border border-[#22c55e]/20 tracking-wider flex items-center gap-2">
              ClaimGuard AI 
              {localAttachment ? `(Attached: ${localAttachment.name})` : globalContext ? `(Workspace Linked)` : null}
            </div>
          </div>
          
          {/* Functional Top Right Buttons */}
          <div className="flex items-center gap-5 text-slate-400">
            {effectiveContext && (
               <button 
                 onClick={() => setIsViewingContext(true)}
                 title="View Context File"
                 className="flex items-center gap-2 hover:text-white transition focus:outline-none bg-[#22c55e]/10 text-[#4ade80] px-3 py-1.5 rounded-[10px] text-xs font-semibold"
               >
                 <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                 View Context
               </button>
            )}
            {activeSessionId && (
              <>
                <button 
                  onClick={toggleBookmark}
                  title={activeSession?.isBookmarked ? "Remove Bookmark" : "Bookmark Chat"}
                  className={`transition focus:outline-none ${activeSession?.isBookmarked ? 'text-[#4ade80]' : 'hover:text-white'}`}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill={activeSession?.isBookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                </button>
                <button 
                  onClick={exportChat}
                  title="Export Chat as JSON"
                  className="hover:text-white transition focus:outline-none"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/></svg>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 pb-32 pt-12 z-10 w-full max-w-4xl mx-auto flex flex-col relative custom-scrollbar">
          {messages.length === 0 ? (
             <div className="flex-1 flex flex-col items-center justify-center -mt-10 w-full max-w-3xl mx-auto">
              <div className={`w-full ${isLight ? 'bg-white border border-[#e0dfdc]' : 'bg-[#1b1c1b]/80'} backdrop-blur-3xl rounded-[28px] p-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] ${isLight ? '' : 'border border-white/5'} relative mb-4 flex flex-col`}>
                
                <div className="flex justify-center mb-6">
                  <div className="w-[42px] h-[42px] mask mask-squircle bg-[#22c55e] flex items-center justify-center text-black rounded-xl">
                     <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  </div>
                </div>
                
                <h1 className={`text-[32px] font-medium text-center ${isLight ? 'text-[#1a1a2e]' : 'text-white'} mb-3 tracking-tight`}>How can I help you today?</h1>
                <p className="text-center text-[#9a9a9a] mb-8 max-w-[420px] mx-auto text-[13px] leading-relaxed">
                  Upload an EDI payload or ask a general query. Set the context tab below to prefix your request parameters.
                </p>

                <div className="mb-8 w-full">
                  <MagicBento cards={chatCards} particleCount={0} disableAnimations={false} enableTilt={true} enableBorderGlow={true} />
                </div>

                {/* Active Functional Filter Tabs */}
                <div className="flex items-center justify-center gap-6 mb-5 text-[13px] font-medium text-[#777]">
                  {filterTabs.map(tab => (
                    <span 
                      key={tab}
                      onClick={() => setActiveFilterTag(tab)}
                      className={`pb-1 cursor-pointer transition border-b-[2px] ${activeFilterTag === tab ? 'text-[#4ade80] border-[#4ade80]' : 'border-transparent hover:text-slate-300'}`}
                    >
                      {tab}
                    </span>
                  ))}
                </div>

                {/* Clean white input bar for empty state */}
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                     <button 
                       onClick={() => fileInputRef.current?.click()}
                       className="w-8 h-8 flex items-center justify-center hover:bg-[#f0f0f0] rounded-full transition-colors text-[#666]"
                       title="Attach File"
                     >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                     </button>
                  </div>
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Message ClaimGuard AI..."
                    className={`w-full ${isLight ? 'bg-[#f3f2ef] text-[#1a1a2e] placeholder:text-[#999999]' : 'bg-white text-slate-800 placeholder:text-slate-400'} rounded-xl py-[14px] pl-[52px] pr-[60px] focus:outline-none shadow-lg text-[15px] font-medium`}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button 
                       onClick={() => sendMessage()}
                       disabled={!input.trim() || loading}
                       className="w-[34px] h-[34px] rounded-[10px] bg-[#4ade80] hover:bg-[#3dcc73] disabled:bg-[#d5ebd1] disabled:text-[#888] text-white flex items-center justify-center transition shadow-sm ml-1 focus:outline-none"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </button>
                  </div>
                </div>

                {/* Attachment Pill Indicator */}
                {localAttachment && (
                  <div className="absolute -bottom-8 left-0 right-0 flex justify-center">
                    <div className="flex items-center gap-2 bg-[#1b1c1b] border border-[#4ade80]/30 text-[#4ade80] text-xs px-3 py-1 rounded-full shadow-lg">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                      {localAttachment.name}
                      <button onClick={removeAttachment} className="ml-1 hover:text-white"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 w-full max-w-3xl mx-auto flex flex-col space-y-10 pb-20">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex flex-col w-full ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-4 mb-2">
                    {msg.role === 'user' ? (
                      <>
                        <span className="font-semibold text-white text-[15px]">You</span>
                        <div className="w-8 h-8 rounded-full bg-[#2a2a2a] flex items-center justify-center border border-[#333]">
                          <svg className="w-4 h-4 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-8 h-8 mask mask-squircle bg-[#22c55e] flex items-center justify-center text-[#0a1f10] rounded-lg">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        </div>
                        <span className="font-semibold text-[#4ade80] text-[15px] tracking-wide">ClaimGuard AI</span>
                      </>
                    )}
                  </div>
                  
                  <div className={`max-w-[85%] text-[15px] ${msg.role === 'user' ? 'pr-12 text-white text-right' : 'pl-12 text-slate-300 font-normal'} tracking-[0.015em] leading-[1.75]`}>
                    {renderMessageContent(msg.content)}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex flex-col items-start w-full">
                  <div className="flex items-center gap-4 mb-2">
                    <div className="w-8 h-8 mask mask-squircle bg-[#22c55e]/30 flex items-center justify-center text-[#4ade80] rounded-lg animate-pulse">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    </div>
                    <span className="font-semibold text-[#4ade80]/60 text-[15px] tracking-wide">ClaimGuard AI</span>
                  </div>
                  <div className="w-full pl-12 text-[15px] text-slate-500 italic">
                    Analyzing context...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Floating clean white input area when chat has history */}
        {messages.length > 0 && (
          <div className="absolute bottom-6 left-0 right-0 w-full z-20 flex flex-col items-center px-10">
            {localAttachment && (
              <div className="mb-2 mr-auto ml-[calc(50%-1.1rem)] max-w-3xl transform -translate-x-1/2 flex items-center gap-2 bg-[#22c55e] text-[#050907] font-semibold text-xs px-4 py-1.5 rounded-t-xl shadow-lg border-b-0 w-fit">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                {localAttachment.name}
                <button onClick={removeAttachment} className="ml-1 hover:text-[#0b2413]"><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
              </div>
            )}
            <div className="w-full max-w-3xl relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                 <button 
                   onClick={() => fileInputRef.current?.click()}
                   className="w-8 h-8 flex items-center justify-center hover:bg-[#f0f0f0] rounded-md transition-colors"
                   title="Attach File"
                 >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                 </button>
              </div>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message ClaimGuard AI..."
                className={`w-full ${isLight ? 'bg-[#f3f2ef] border border-[#e0dfdc] text-[#1a1a2e] placeholder:text-[#999999]' : 'bg-white border border-[#444] text-slate-800 placeholder:text-slate-400'} rounded-2xl py-[16px] pl-[52px] pr-16 focus:outline-none focus:border-[#4ade80] shadow-2xl text-[15px] font-medium ${localAttachment ? 'rounded-tl-none' : ''}`}
              />
              <button 
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-[#4ade80] hover:bg-[#3ec770] disabled:bg-[#d5ebd1] disabled:text-[#888] text-white flex items-center justify-center transition focus:outline-none"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            </div>
          </div>
        )}
        
        <div className="absolute bottom-1 left-0 right-0 text-center text-[10px] text-[#444] font-medium z-10 select-none pb-0.5">
          ClaimGuard AI can make mistakes. Consider checking important information.
        </div>
      </div>

      {isViewingContext && (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center ${isLight ? 'bg-white/60' : 'bg-black/60'} backdrop-blur-sm p-6`}>
          <div className={`${isLight ? 'bg-white border-[#e0dfdc]' : 'bg-[#121212] border-[#333]'} border rounded-[24px] w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden shadow-2xl relative animate-fade-in`}>
            <div className={`h-16 border-b ${isLight ? 'border-[#e0dfdc] bg-[#f3f2ef]' : 'border-[#333] bg-[#1a1a1a]'} flex items-center justify-between px-6`}>
              <h3 className="text-white font-semibold flex items-center gap-2">
                <svg className="w-5 h-5 text-[#4ade80]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                {localAttachment ? localAttachment.name : "Workspace EDI Context"}
              </h3>
              
              <div className="flex gap-4 items-center">
                {(localAttachment ? localParsedContext : parsedContext) && (
                  <div className="flex bg-[#222] p-1 rounded-lg border border-[#333]">
                    <button onClick={() => setContextViewType('raw')} className={`px-4 py-1.5 text-xs rounded-md transition ${contextViewType === 'raw' ? 'bg-[#4ade80] text-black font-bold' : 'text-slate-400 hover:text-white'}`}>Raw EDI</button>
                    <button onClick={() => setContextViewType('json')} className={`px-4 py-1.5 text-xs rounded-md transition ${contextViewType === 'json' ? 'bg-[#4ade80] text-black font-bold' : 'text-slate-400 hover:text-white'}`}>Parsed JSON</button>
                  </div>
                )}
                
                <button onClick={() => setIsViewingContext(false)} className="text-slate-400 hover:text-white p-2 ml-2" title="Close context viewer">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className={`flex-1 overflow-auto p-6 ${isLight ? 'bg-[#f4f5f7]' : 'bg-[#0a0a0a]'}`}>
              <pre className="text-[#4ade80] font-mono text-[13px] whitespace-pre-wrap leading-relaxed">
                {(contextViewType === 'json' && (localAttachment ? localParsedContext : parsedContext)) ? (localAttachment ? localParsedContext : parsedContext) : effectiveContext}
              </pre>
            </div>
            <div className={`h-14 border-t ${isLight ? 'border-[#e0dfdc] bg-[#f3f2ef]' : 'border-[#333] bg-[#1a1a1a]'} flex items-center justify-end px-6`}>
               <button 
                  onClick={() => setIsViewingContext(false)} 
                  className="bg-[#333] hover:bg-[#444] text-white px-5 py-2 rounded-xl text-sm font-medium transition"
               >
                 Close
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
