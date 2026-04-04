import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import styled, { keyframes } from 'styled-components';
import { ArrowRight } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface HeroSectionProps {
  onScrollToUpload?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function HeroSection({ onScrollToUpload }: HeroSectionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Floating particles
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const particles: { x: number; y: number; vx: number; vy: number; r: number; o: number }[] = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 35; i++) {
      particles.push({
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.2,
        r: Math.random() * 1.8 + 0.4,
        o: Math.random() * 0.35 + 0.05,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.offsetWidth;
        if (p.x > canvas.offsetWidth) p.x = 0;
        if (p.y < 0) p.y = canvas.offsetHeight;
        if (p.y > canvas.offsetHeight) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.o * 0.6})`;
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <HeroWrapper>
      {/* Particle Canvas */}
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}
      />

      {/* Subtle ambient light — no green */}
      <div className="ambient-glow" />

      {/* Content */}
      <div className="hero-content">
        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 40, filter: 'blur(12px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1 className="hero-headline">
            <span className="chrome-text">Smarter</span>
            <br />
            <span className="white-text">Parse, Validate & Repair</span>
            <br />
            <span className="white-text">Healthcare EDI Claims</span>
          </h1>
        </motion.div>

        {/* Subtitle */}
        <motion.p
          className="hero-subtitle"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          AI-powered compliance in one calm workspace.
        </motion.p>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <CTAButton onClick={onScrollToUpload}>
            <span className="btn-bg" />
            <span className="btn-label">
              Upload EDI File <ArrowRight size={16} />
            </span>
          </CTAButton>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          className="scroll-indicator"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.0 }}
        >
          <span className="scroll-text">SCROLL</span>
          <div className="scroll-line" />
        </motion.div>
      </div>
    </HeroWrapper>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const scrollPulse = keyframes`
  0%, 100% { height: 40px; opacity: 0.4; }
  50% { height: 60px; opacity: 0.8; }
`;

const HeroWrapper = styled.section`
  position: relative;
  min-height: 92vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #050507;
  overflow: visible;

  .ambient-glow {
    position: absolute;
    top: 10%;
    left: 50%;
    transform: translateX(-50%);
    width: 700px;
    height: 500px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.015), transparent 70%);
    filter: blur(100px);
    pointer-events: none;
  }



  .hero-content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 0 24px;
    gap: 28px;
  }

  .hero-headline {
    margin: 0;
    font-size: clamp(2.8rem, 7vw, 5.5rem);
    font-weight: 700;
    line-height: 1.05;
    letter-spacing: -0.04em;
    font-family: 'Plus Jakarta Sans', sans-serif;
  }

  .chrome-text {
    background: linear-gradient(
      180deg,
      rgba(130, 255, 170, 0.9) 0%,
      rgba(74, 222, 128, 0.6) 50%,
      rgba(34, 197, 94, 0.3) 100%
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-style: italic;
    font-weight: 700;
    padding-right: 0.08em;
    display: inline-block;
  }

  .white-text {
    color: rgba(255, 255, 255, 0.88);
  }

  .hero-subtitle {
    margin: 0;
    font-size: clamp(0.95rem, 1.5vw, 1.15rem);
    color: rgba(180, 180, 200, 0.55);
    font-weight: 500;
    letter-spacing: 0.01em;
    max-width: 400px;
  }

  .scroll-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    margin-top: 32px;
  }

  .scroll-text {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.25em;
    color: rgba(180, 180, 190, 0.35);
    text-transform: uppercase;
  }

  .scroll-line {
    width: 1px;
    height: 40px;
    background: linear-gradient(
      to bottom,
      rgba(200, 200, 210, 0.4),
      rgba(160, 160, 170, 0.15),
      transparent
    );
    animation: ${scrollPulse} 2.5s ease-in-out infinite;
  }
`;

const CTAButton = styled.button`
  position: relative;
  border: 0;
  cursor: pointer;
  padding: 0;
  background: transparent;
  font-family: inherit;

  .btn-bg {
    position: absolute;
    inset: 0;
    border-radius: 999px;
    background: rgba(15, 15, 20, 0.9);
    border: 1px solid rgba(74, 222, 128, 0.25);
    box-shadow:
      0 0 30px rgba(74, 222, 128, 0.08),
      0 0 60px rgba(34, 197, 94, 0.04),
      inset 0 1px 0 rgba(255, 255, 255, 0.04);
    transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .btn-label {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px 36px;
    font-size: 0.92rem;
    font-weight: 700;
    color: rgba(200, 255, 220, 0.85);
    letter-spacing: 0.01em;
    transition: color 0.25s;
  }

  &:hover .btn-bg {
    border-color: rgba(74, 222, 128, 0.45);
    box-shadow:
      0 0 40px rgba(74, 222, 128, 0.15),
      0 0 80px rgba(34, 197, 94, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
    transform: translateY(-1px);
  }

  &:hover .btn-label {
    color: #fff;
  }

  &:active .btn-bg {
    transform: translateY(0);
  }
`;
