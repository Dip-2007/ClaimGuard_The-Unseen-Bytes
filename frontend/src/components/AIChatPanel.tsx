import { useState, useRef, useEffect } from 'react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AIChatPanelProps {
  context?: string;
}

export default function AIChatPanel({ context }: AIChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const sendMessage = async (overrideInput?: string) => {
    const textToSend = overrideInput || input;
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: textToSend.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          context: context || null,
          history: messages.slice(-6),
        }),
      });

      const data = await res.json();
      const reply = data.reply || data.error || 'No response received.';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `⚠️ Error: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickQuestions = [
    { title: 'Explain', desc: 'the ISA segment', icon: '💡' },
    { title: 'Troubleshoot', desc: 'NPI validation', icon: '🛠️' },
    { title: 'Decode', desc: 'CARC code 45', icon: '🔍' },
    { title: 'Summarize', desc: 'claim denials', icon: '📝' },
  ];

  return (
    <div className="flex flex-col h-[480px] w-full max-w-4xl mx-auto bg-[#131314] rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] border border-white/5 overflow-hidden font-sans">
      <div className="w-full p-4 flex items-center justify-between shrink-0 border-b border-white/5 bg-[#131314] z-10">
        <div className="flex items-center gap-2 text-lg font-medium text-[#e3e3e3]">
          <span className="text-xl">✨</span>
          ClaimGuard AI
        </div>
        <div className="px-3 py-1 bg-[#1e1f20] rounded-lg text-[11px] font-semibold text-slate-300 border border-white/10 shadow-inner tracking-wide uppercase">
          Gemini 1.5 Pro
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4 scroll-smooth flex flex-col">
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col justify-center max-w-3xl mx-auto w-full animate-fade-in my-auto pb-4">
            <h1 className="text-3xl md:text-4xl font-medium mb-1 tracking-tight text-left">
              <span className="bg-gradient-to-r from-[#4285f4] via-[#d96570] to-[#ce63c1] bg-clip-text text-transparent">
                Hello,
              </span>
            </h1>
            <h2 className="text-2xl md:text-3xl font-medium text-[#444746] mb-6 tracking-tight text-left">
              How can I help you today?
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {quickQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(`${q.title} ${q.desc}`)}
                  className="bg-[#1e1f20] hover:bg-[#2a2b2f] transition-colors p-3 rounded-xl flex flex-col gap-2 text-left h-full min-h-[90px] group border border-transparent hover:border-white/5 cursor-pointer shadow-sm"
                >
                  <div className="text-[13px] text-[#e3e3e3] font-medium leading-relaxed">
                    <span className="text-white font-semibold">{q.title}</span> <br/> {q.desc}
                  </div>
                  <div className="mt-auto self-end bg-[#131314] p-1.5 rounded-full opacity-100 group-hover:bg-[#333538] transition-colors text-xs">
                    {q.icon}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="max-w-3xl mx-auto w-full space-y-6">
          {messages.map((msg, i) => (
            <div key={i} className={`flex w-full animate-fade-in ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'user' ? (
                <div className="bg-[#1e1f20] text-[#e3e3e3] px-5 py-2.5 rounded-3xl max-w-[85%] text-[14px] leading-relaxed shadow-sm">
                  {msg.content}
                </div>
              ) : (
                <div className="flex gap-3 max-w-full">
                  <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center mt-1">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M16.19 2H7.81C4.17 2 2 4.17 2 7.81V16.18C2 19.83 4.17 22 7.81 22H16.18C19.82 22 21.99 19.83 21.99 16.19V7.81C22 4.17 19.83 2 16.19 2ZM15.96 11.21L13.12 12.55C12.78 12.71 12.51 12.98 12.34 13.33L10.99 16.16C10.74 16.69 9.99 16.69 9.74 16.16L8.4 13.33C8.23 12.99 7.96 12.72 7.61 12.55L4.78 11.21C4.25 10.96 4.25 10.21 4.78 9.96L7.61 8.62C7.95 8.46 8.22 8.19 8.39 7.84L9.74 5.01C9.99 4.48 10.74 4.48 10.99 5.01L12.33 7.84C12.5 8.18 12.77 8.45 13.12 8.62L15.96 9.96C16.49 10.21 16.49 10.96 15.96 11.21ZM18.9 17.61L17.7 18.17C17.55 18.24 17.44 18.35 17.37 18.5L16.81 19.7C16.7 19.92 16.38 19.92 16.27 19.7L15.71 18.5C15.64 18.35 15.53 18.24 15.38 18.17L14.18 17.61C13.96 17.5 13.96 17.18 14.18 17.07L15.38 16.51C15.53 16.44 15.64 16.33 15.71 16.18L16.27 14.98C16.38 14.76 16.7 14.76 16.81 14.98L17.37 16.18C17.44 16.33 17.55 16.44 17.7 16.51L18.9 17.07C19.12 17.18 19.12 17.5 18.9 17.61ZM18.9 6.84L17.7 7.4C17.55 7.47 17.44 7.58 17.37 7.73L16.81 8.93C16.7 9.15 16.38 9.15 16.27 8.93L15.71 7.73C15.64 7.58 15.53 7.47 15.38 7.4L14.18 6.84C13.96 6.73 13.96 6.41 14.18 6.3L15.38 5.74C15.53 5.67 15.64 5.56 15.71 5.41L16.27 4.21C16.38 3.99 16.7 3.99 16.81 4.21L17.37 5.41C17.44 5.56 17.55 5.67 17.7 5.74L18.9 6.3C19.12 6.41 19.12 6.73 18.9 6.84Z" fill="url(#paint0_linear)"/>
                      <defs>
                        <linearGradient id="paint0_linear" x1="2" y1="12" x2="22" y2="12" gradientUnits="userSpaceOnUse">
                          <stop stopColor="#4285f4"/>
                          <stop offset="0.5" stopColor="#d96570"/>
                          <stop offset="1" stopColor="#ce63c1"/>
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                  <div className="flex-1 text-[#e3e3e3] text-[14px] leading-relaxed pt-1">
                    <div
                      className="whitespace-pre-wrap font-sans"
                      dangerouslySetInnerHTML={{
                        __html: msg.content
                          .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
                          .replace(/\n/g, '<br />')
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex justify-start animate-fade-in max-w-3xl mx-auto w-full">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center mt-1">
                  <span className="text-xl animate-pulse">✨</span>
                </div>
                <div className="bg-gradient-to-r from-[#4285f4]/40 via-[#d96570]/40 to-[#ce63c1]/40 bg-clip-text text-transparent text-[14px] font-medium pt-1 animate-pulse">
                  Thinking...
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-2" />
        </div>
      </div>

      <div className="w-full px-4 pb-4 pt-2 bg-[#131314] shrink-0 border-t border-white/5 shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
        <div className="max-w-3xl mx-auto relative flex items-end bg-[#1e1f20] rounded-[24px] pl-4 pr-1.5 py-1.5 focus-within:bg-[#2a2b2f] transition-colors shadow-sm border border-white/5">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Gemini..."
            rows={1}
            className="flex-1 bg-transparent border-none text-[#e3e3e3] placeholder-[#8e918f] resize-none outline-none max-h-[120px] overflow-y-auto py-2.5 text-[14px] leading-relaxed"
            disabled={loading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-[#e3e3e3] hover:bg-[#333538] transition-colors disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer ml-2 mb-0.5"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3.4 20.4L20.85 12.92C21.66 12.57 21.66 11.43 20.85 11.08L3.4 3.6C2.74 3.31 2.01 3.8 2.01 4.51L2 9.12C2 9.62 2.37 10.05 2.87 10.11L17 12L2.87 13.88C2.37 13.95 2 14.38 2 14.88L2.01 19.49C2.01 20.2 2.74 20.69 3.4 20.4Z" fill="currentColor"/>
            </svg>
          </button>
        </div>
        <div className="text-center text-[11px] text-[#8e918f] mt-2.5 tracking-wide">
          Gemini may display inaccurate info, including about people, so double-check its responses.
        </div>
      </div>
    </div>
  );
}