import { useState, useEffect } from 'react';
import { TrendingUp, ArrowRight, Eye, Download, Star, ShieldCheck, FileText, Users } from 'lucide-react';
import { AnimatedItem } from './AnimatedItem';

// ─── Data adapted for EDI ClaimGuard ─────────────────────────────────────────

const trendingTransactions = [
  {
    name: 'Professional Claims',
    code: '837P',
    papers: 142,
    views: '12.4k',
    trending: true,
    gradient: 'from-emerald-500 to-green-600',
    shadow: 'rgba(74, 222, 128, 0.3)',
  },
  {
    name: 'Remittance Advice',
    code: '835',
    papers: 98,
    views: '8.7k',
    trending: true,
    gradient: 'from-cyan-500 to-teal-500',
    shadow: 'rgba(61, 217, 193, 0.3)',
  },
  {
    name: 'Benefit Enrollment',
    code: '834',
    papers: 76,
    views: '5.2k',
    trending: false,
    gradient: 'from-blue-500 to-indigo-500',
    shadow: 'rgba(99, 102, 241, 0.3)',
  },
  {
    name: 'Institutional Claims',
    code: '837I',
    papers: 54,
    views: '3.1k',
    trending: false,
    gradient: 'from-purple-500 to-violet-500',
    shadow: 'rgba(139, 92, 246, 0.3)',
  },
];

const topFeatures = [
  {
    title: 'AI-Powered Fix Suggestions',
    author: 'Gemini 2.5 Flash',
    rating: 4.9,
    downloads: '2.1k uses',
    icon: <ShieldCheck size={16} />,
  },
  {
    title: 'Schema-Driven JSON Validation',
    author: 'TR3 Rule Engine',
    rating: 4.8,
    downloads: '1.8k runs',
    icon: <FileText size={16} />,
  },
  {
    title: 'Enrollment Member Analytics',
    author: '834 Dashboard',
    rating: 4.7,
    downloads: '950 views',
    icon: <Users size={16} />,
  },
];

// ─── CSS Animation (injected once) ───────────────────────────────────────────
const slideInCSS = `
@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateY(18px);
    filter: blur(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
    filter: blur(0);
  }
}
.animate-slide-in {
  animation: slide-in 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
}
@media (min-width: 1024px) {
  .trending-grid {
    grid-template-columns: 1fr 1fr !important;
  }
}
`;

// ─── Component ───────────────────────────────────────────────────────────────
export default function TrendingSection() {
  const [isLight, setIsLight] = useState(document.documentElement.getAttribute('data-theme') === 'light');
  useEffect(() => {
    const check = () => setIsLight(document.documentElement.getAttribute('data-theme') === 'light');
    check(); // Sync on mount in case Navbar already set it
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const bg = isLight ? '#f3f2ef' : 'rgba(5, 9, 7, 1)';
  const cardBg = isLight ? '#ffffff' : '#0f0f10';
  const cardHover = isLight ? '#f9f8f6' : '#131313';
  const textPrimary = isLight ? '#191919' : '#eee';
  const textSecondary = isLight ? '#666666' : '#666';
  const borderColor = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.07)';
  const borderHover = isLight ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.18)';
  const featureBg = isLight ? '#ffffff' : 'rgba(0, 0, 0, 0.45)';
  const featureHover = isLight ? '#f9f8f6' : 'rgba(255, 255, 255, 0.04)';
  const statColor = isLight ? '#191919' : '#fff';
  return (
    <>
      <style>{slideInCSS}</style>
      <section style={{
        background: `linear-gradient(180deg, transparent 0%, ${bg} 8%, ${bg} 92%, transparent 100%)`,
        padding: '64px 0 80px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Ambient glow */}
        <div style={{
          position: 'absolute', top: '20%', left: '-10%', width: 500, height: 500,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(74, 222, 128, 0.04), transparent 70%)',
          filter: 'blur(80px)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '10%', right: '-8%', width: 400, height: 400,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(251, 191, 36, 0.03), transparent 70%)',
          filter: 'blur(80px)', pointerEvents: 'none',
        }} />

        <div style={{ maxWidth: 1480, margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 32 }} className="trending-grid">
            {/* ─── Left: Trending Transactions ──────────────────────────────── */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <TrendingUp size={22} color="#4ade80" />
                <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: textPrimary, letterSpacing: '-0.02em' }}>
                  Supported Transactions
                </h2>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {trendingTransactions.map((tx, index) => (
                  <AnimatedItem key={tx.code} index={index} delay={index * 0.1}>
                  <div
                    className="group"
                    style={{
                      animationDelay: `${index * 0.1}s`,
                      background: cardBg,
                      border: `1px solid ${borderColor}`,
                      borderRadius: 18,
                      padding: '16px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      cursor: 'pointer',
                      transition: 'border-color 0.25s, background 0.25s, transform 0.25s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = borderHover;
                      e.currentTarget.style.background = cardHover;
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = borderColor;
                      e.currentTarget.style.background = cardBg;
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    {/* Code Block */}
                    <div style={{
                      width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                      display: 'grid', placeItems: 'center',
                      fontWeight: 800, fontSize: '0.85rem', letterSpacing: '0.04em',
                      color: statColor,
                      background: `linear-gradient(135deg, var(--tw-gradient-stops, ${tx.gradient.includes('emerald') ? '#34d399, #16a34a' : tx.gradient.includes('cyan') ? '#22d3ee, #14b8a6' : tx.gradient.includes('blue') ? '#3b82f6, #6366f1' : '#a855f7, #8b5cf6'}))`,
                      boxShadow: `0 8px 24px ${tx.shadow}`,
                    }}>
                      {tx.code.slice(0, 3)}
                    </div>

                    {/* Text */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontWeight: 700, fontSize: '0.92rem', color: textPrimary,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {tx.name}
                        </span>
                        {tx.trending && (
                          <span style={{
                            padding: '2px 8px', borderRadius: 999, fontSize: '0.6rem',
                            fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
                            color: '#fff',
                            background: 'linear-gradient(135deg, #ef4444, #f97316)',
                            lineHeight: '1.6',
                          }}>
                            Hot
                          </span>
                        )}
                      </div>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        marginTop: 4, fontSize: '0.78rem', color: textSecondary,
                      }}>
                        <span>{tx.papers} validation rules</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Eye size={12} /> {tx.views}
                        </span>
                      </div>
                    </div>

                    {/* Arrow */}
                    <ArrowRight
                      size={18}
                      style={{
                        color: '#444', flexShrink: 0,
                        transition: 'color 0.2s, transform 0.2s',
                      }}
                      className="group-hover:text-[#4ade80] group-hover:translate-x-1"
                    />
                  </div>
                  </AnimatedItem>
                ))}

                {/* Footer Button */}
                <button
                  style={{
                    width: '100%', marginTop: 8, padding: '14px 0',
                    border: `1px solid ${borderColor}`,
                    borderRadius: 16, background: 'transparent',
                    color: textSecondary, fontWeight: 700, fontSize: '0.85rem',
                    cursor: 'pointer', transition: 'all 0.2s',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(74, 222, 128, 0.25)';
                    e.currentTarget.style.color = '#4ade80';
                    e.currentTarget.style.background = 'rgba(74, 222, 128, 0.04)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = borderColor;
                    e.currentTarget.style.color = textSecondary;
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  View All Transaction Types →
                </button>
              </div>
            </div>

            {/* ─── Right: Top Features ──────────────────────────────────────── */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <Star size={22} color="#fbbf24" />
                <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: textPrimary, letterSpacing: '-0.02em' }}>
                  Top Features This Build
                </h2>
              </div>

              <div style={{
                position: 'relative',
                background: cardBg,
                border: `1px solid ${borderColor}`,
                borderRadius: 22, padding: 18, overflow: 'hidden',
              }}>
                {/* Soft amber glow */}
                <div style={{
                  position: 'absolute', inset: 0, pointerEvents: 'none',
                  background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.03), rgba(249, 115, 22, 0.02), transparent)',
                  borderRadius: 'inherit',
                }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, position: 'relative', zIndex: 1 }}>
                  {topFeatures.map((feature, index) => (
                    <AnimatedItem key={feature.title} index={index} delay={(index + 4) * 0.1}>
                    <div
                      className=""
                      style={{
                        animationDelay: `${(index + 4) * 0.1}s`,
                        background: featureBg,
                        border: `1px solid ${borderColor}`,
                        borderRadius: 16, padding: '14px 16px',
                        display: 'flex', alignItems: 'center', gap: 14,
                        cursor: 'pointer', transition: 'all 0.25s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = featureHover;
                        e.currentTarget.style.borderColor = borderHover;
                        e.currentTarget.style.transform = 'translateX(4px)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = featureBg;
                        e.currentTarget.style.borderColor = borderColor;
                        e.currentTarget.style.transform = 'translateX(0)';
                      }}
                    >
                      {/* Rank */}
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        display: 'grid', placeItems: 'center',
                        fontWeight: 800, fontSize: '0.85rem', color: statColor,
                        background: 'linear-gradient(135deg, #fbbf24, #f97316)',
                        boxShadow: '0 6px 18px rgba(251, 191, 36, 0.25)',
                      }}>
                        {index + 1}
                      </div>

                      {/* Details */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontWeight: 700, fontSize: '0.88rem', color: textPrimary,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {feature.title}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#666', marginTop: 2 }}>
                          {feature.author}
                        </div>
                      </div>

                      {/* Stats */}
                      <div style={{
                        textAlign: 'right', flexShrink: 0,
                        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4,
                      }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          fontSize: '0.82rem', fontWeight: 700, color: '#fbbf24',
                        }}>
                          <Star size={13} fill="#fbbf24" color="#fbbf24" />
                          {feature.rating}
                        </div>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          fontSize: '0.72rem', color: '#666',
                        }}>
                          <Download size={11} />
                          {feature.downloads}
                        </div>
                      </div>
                    </div>
                    </AnimatedItem>
                  ))}
                </div>

                {/* Bottom stat bar */}
                <div style={{
                  display: 'flex', justifyContent: 'space-around', marginTop: 16,
                  padding: '14px 0', borderTop: `1px solid ${borderColor}`,
                  position: 'relative', zIndex: 1,
                }}>
                  {[
                    { label: 'Validations', value: '50+' },
                    { label: 'Auto-fixes', value: '12' },
                    { label: 'AI Accuracy', value: '95%' },
                  ].map(stat => (
                    <div key={stat.label} style={{ textAlign: 'center' }}>
                      <div style={{
                        fontWeight: 800, fontSize: '1.2rem', color: statColor,
                        letterSpacing: '-0.02em',
                      }}>
                        {stat.value}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#666', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
