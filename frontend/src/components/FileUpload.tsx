import { useCallback, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styled, { keyframes, css } from 'styled-components';
import GlareHover from './GlareHover';
import { AnimatedItem } from './AnimatedItem';

interface FileUploadProps {
  onFileProcessed: (data: any) => void;
  onRawContent: (content: string) => void;
  onLoading: (loading: boolean) => void;
  getAuthHeaders: () => Record<string, string>;
}

const sampleFiles = [
  {
    name: 'sample_837p.edi',
    label: '837P claim',
    description: 'Professional claim structure with payer and provider loops.',
    accent: 'Claims',
  },
  {
    name: 'sample_835.edi',
    label: '835 remittance',
    description: 'Payment and adjustment details for remit analysis.',
    accent: 'Payments',
  },
  {
    name: 'sample_834.edi',
    label: '834 enrollment',
    description: 'Member additions, changes, and terminations.',
    accent: 'Members',
  },
];

type UploadState = 'idle' | 'dragover' | 'uploading' | 'success' | 'complete';

export default function FileUpload({ onFileProcessed, onRawContent, onLoading, getAuthHeaders }: FileUploadProps) {
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const dropRef = useRef<HTMLDivElement>(null);
  const dragCounter = useRef(0);
  const dataRef = useRef<any>(null);
  const timeoutsRef = useRef<number[]>([]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => timeoutsRef.current.forEach(t => clearTimeout(t));
  }, []);

  const handleTapResult = useCallback(() => {
    if (dataRef.current) {
      timeoutsRef.current.forEach(t => clearTimeout(t));
      onFileProcessed(dataRef.current);
    }
  }, [onFileProcessed]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const processFile = useCallback(
    async (file: File) => {
      setError(null);
      setFileName(file.name);
      setFileSize(formatFileSize(file.size));
      setUploadState('uploading');
      setProgress(0);
      onLoading(true);

      // Slower progress animation for dramatic effect
      let prog = 0;
      const interval = setInterval(() => {
        prog += Math.random() * 8 + 3;
        if (prog >= 95) {
          prog = 95;
          clearInterval(interval);
        }
        setProgress(Math.min(prog, 95));
      }, 140);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const isZip = file.name.toLowerCase().endsWith('.zip');
        const endpoint = isZip ? '/api/upload-batch' : '/api/upload';

        const response = await fetch(endpoint, { 
          method: 'POST', 
          headers: {
            ...getAuthHeaders()
          },
          body: formData 
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ detail: 'Upload failed' }));
          throw new Error(err.detail || 'Upload failed');
        }

        const data = await response.json();
        dataRef.current = data;

        clearInterval(interval);
        setProgress(100);

        if (!isZip && data.parse_result?.raw_content) {
          onRawContent(data.parse_result.raw_content);
        }

        // ─── CONSOLIDATED SUCCESS TRANSITION ───
        const t1 = window.setTimeout(() => {
          setUploadState('success');

          const t2 = window.setTimeout(() => {
            onFileProcessed(data);
          }, 2000); // 1.5s - 2s for full animation feel
          timeoutsRef.current.push(t2);
        }, 600);
        timeoutsRef.current.push(t1);
      } catch (err: any) {
        clearInterval(interval);
        setError(err.message || 'Failed to process file');
        setUploadState('idle');
        setProgress(0);
      } finally {
        onLoading(false);
      }
    },
    [onFileProcessed, onRawContent, onLoading],
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setUploadState('dragover');
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setUploadState('idle');
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const loadSample = useCallback(
    async (sampleName: string) => {
      onLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/samples/${sampleName}`);
        const { content } = await res.json();

        const blob = new Blob([content], { type: 'text/plain' });
        const file = new File([blob], sampleName, { type: 'text/plain' });
        await processFile(file);
      } catch (err: any) {
        setError(err.message || 'Failed to load sample');
        onLoading(false);
      }
    },
    [processFile, onLoading],
  );

  const isUploading = uploadState === 'uploading';
  const isSuccess = uploadState === 'success';
  const showShimmer = isUploading || isSuccess;

  return (
    <section className="panel-card animate-fade-in" style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <GlareHover
        width="100%"
        height="auto"
        background="transparent"
        borderRadius="24px"
        borderColor="transparent"
        glareColor="#54d0ff"
        glareOpacity={0.15}
        glareAngle={-35}
        glareSize={200}
        transitionDuration={800}
        style={{ 
          border: 'none', 
          height: 'auto', 
          maxWidth: '640px', 
          width: '100%'
        }}
      >
      <DropContainer
        ref={dropRef}
        $state={uploadState}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => (uploadState === 'idle' || uploadState === 'complete') && document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".edi,.txt,.x12,.zip"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {/* Animated glowing border */}
        <BorderGlow $state={uploadState} />

        {/* Particle orbits for dragover effect */}
        <AnimatePresence>
          {uploadState === 'dragover' && (
            <ParticleOrbit as={motion.div} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
              <Particle $delay={0} $size={4} $distance={120} $speed={6} />
              <Particle $delay={1.5} $size={3} $distance={100} $speed={8} />
              <Particle $delay={3} $size={5} $distance={140} $speed={10} />
              <Particle $delay={4.5} $size={3} $distance={90} $speed={7} />
            </ParticleOrbit>
          )}
        </AnimatePresence>

        {/* Teal diagonal shimmer — Dribbble uploading effect */}
        <AnimatePresence>
          {showShimmer && (
            <ShimmerBg
              as={motion.div}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
            />
          )}
        </AnimatePresence>

        {/* Radial pulse on success */}
        <AnimatePresence>
          {isSuccess && (
            <SuccessPulseRing
              as={motion.div}
              initial={{ scale: 0.3, opacity: 0.8 }}
              animate={{ scale: 3.5, opacity: 0 }}
              transition={{ duration: 1.8, ease: 'easeOut' }}
            />
          )}
          {isSuccess && (
            <SuccessPulseRing
              as={motion.div}
              initial={{ scale: 0.3, opacity: 0.6 }}
              animate={{ scale: 2.5, opacity: 0 }}
              transition={{ duration: 1.4, ease: 'easeOut', delay: 0.2 }}
            />
          )}
        </AnimatePresence>

        <ContentLayer>
          <AnimatePresence mode="wait">

            {/* ━━━ IDLE / DRAGOVER STATE ━━━ */}
            {(uploadState === 'idle' || uploadState === 'dragover') && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -40, transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] } }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                style={{ textAlign: 'center' }}
              >
                {/* 3D Document Icon with perspective + glow + shadow */}
                <DocIcon3DContainer
                  as={motion.div}
                  animate={
                    uploadState === 'dragover'
                      ? {
                          rotateY: [0, 12, -12, 0],
                          rotateX: [-5, 5, -5],
                          scale: [1, 1.12, 1.08, 1.12],
                          y: [0, -12, -8, -12],
                        }
                      : {
                          rotateY: [0, 6, -6, 0],
                          rotateX: [0, -3, 3, 0],
                          y: [0, -10, 0],
                        }
                  }
                  transition={{
                    duration: uploadState === 'dragover' ? 2.5 : 4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  {/* Glow halo behind icon */}
                  <DocGlowHalo $active={uploadState === 'dragover'} />
                  
                  {/* Multi-layer 3D Document SVG */}
                  <Doc3DSVG isDragover={uploadState === 'dragover'} />
                </DocIcon3DContainer>

                <DropTitle
                  as={motion.h2}
                  animate={
                    uploadState === 'dragover'
                      ? { color: '#54d0ff', scale: 1.05, textShadow: '0 0 30px rgba(84,208,255,0.4)' }
                      : { color: document.documentElement.getAttribute('data-theme') === 'light' ? '#1e293b' : '#ffffff', scale: 1, textShadow: '0 0 0px transparent' }
                  }
                  transition={{ duration: 0.4 }}
                >
                  Drag & Drop
                </DropTitle>
                <DropSubtext>
                  or{' '}
                  <BrowseLink onClick={(e) => { e.stopPropagation(); document.getElementById('file-input')?.click(); }}>
                    choose a file
                  </BrowseLink>
                </DropSubtext>
                <RequirementsText>
                  Supports .edi, .txt, .x12 and batch .zip uploads
                </RequirementsText>
              </motion.div>
            )}

            {/* ━━━ UPLOADING STATE ━━━ */}
            {isUploading && (
              <motion.div
                key="uploading"
                initial={{ opacity: 0, y: 40, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -40, filter: 'blur(8px)' }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                style={{ textAlign: 'center', width: '100%' }}
              >
                <ProgressBarContainer>
                  <ProgressTrack>
                    <ProgressFill
                      as={motion.div}
                      initial={{ width: '0%' }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </ProgressTrack>
                </ProgressBarContainer>

                <PercentageText
                  as={motion.div}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4 }}
                >
                  {Math.round(progress)}%
                </PercentageText>

                <UploadingText
                  as={motion.p}
                  animate={{ opacity: [0.4, 0.8, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  </UploadingText>
              </motion.div>
            )}

            {/* ━━━ SUCCESS STATE ━━━ (One solid animation) */}
            {isSuccess && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.6, filter: 'blur(12px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.85, filter: 'blur(6px)', y: -30 }}
                transition={{
                  duration: 0.6,
                  ease: [0.16, 1, 0.3, 1],
                  scale: { type: 'spring', stiffness: 200, damping: 18 },
                }}
                style={{ textAlign: 'center' }}
              >
                {/* Animated checkmark with glow ring */}
                <CheckmarkContainer
                  as={motion.div}
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 180, damping: 14, delay: 0.2 }}
                  whileHover={{ scale: 1.1, filter: 'brightness(1.2) drop-shadow(0 0 15px rgba(74, 222, 128, 0.4))' }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleTapResult}
                  style={{ cursor: 'pointer' }}
                  title="View Results Now"
                >
                  <CheckmarkGlowRing />
                  <CheckmarkInner>
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
                      <motion.path
                        d="M5 13l4 4L19 7"
                        stroke="#4ade80"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </svg>
                  </CheckmarkInner>
                </CheckmarkContainer>

                <SuccessLabel
                  as={motion.div}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                >
                  Success!
                </SuccessLabel>

                <UploadingText
                  as={motion.p}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.6 }}
                  transition={{ delay: 0.8 }}
                  style={{ fontSize: '0.9rem', marginTop: 8 }}
                >
                  Redirecting to your workspace...
                </UploadingText>
              </motion.div>
            )}
          </AnimatePresence>
        </ContentLayer>
      </DropContainer>
      </GlareHover>

      {/* ━━━ FILE ITEM CARD ━━━ */}
      <AnimatePresence>
        {isSuccess && fileName && (
          <FileItemCard
            as={motion.div}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.98 }}
            transition={{
              type: 'spring',
              stiffness: 200,
              damping: 22,
              delay: 0.2,
            }}
          >
            <FileItemIconWrap>
              <FileItemIconLabel>EDI</FileItemIconLabel>
            </FileItemIconWrap>
            <FileItemDetails>
              <FileItemName>{fileName}</FileItemName>
              <FileItemSize>{fileSize}</FileItemSize>
            </FileItemDetails>
            <FileItemActions>
              <FileActionBtn title="Re-parse">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
              </FileActionBtn>
            </FileItemActions>
          </FileItemCard>
        )}
      </AnimatePresence>

      {error && (
        <ErrorBar
          as={motion.div}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span>⚠</span> {error}
          <ErrorDismiss onClick={() => { setError(null); setUploadState('idle'); }}>×</ErrorDismiss>
        </ErrorBar>
      )}

      <SampleSection>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Sample files</p>
            <h3 className="mt-3 text-xl font-semibold" style={{ color: 'var(--text)' }}>Try the workflow without uploading your own data</h3>
          </div>
          <p className="hidden text-sm md:block" style={{ color: 'var(--muted)' }}>One click loads a transaction and opens the results panel.</p>
        </div>

        <SampleGrid>
          {sampleFiles.map((sample, i) => (
            <AnimatedItem key={sample.name} index={i} delay={i * 0.12} className="h-full">
            <SampleCard
              as={motion.button}
              onClick={() => loadSample(sample.name)}
              whileHover={{ y: -5, borderColor: 'rgba(84, 208, 255, 0.4)', transition: { duration: 0.3 } }}
              whileTap={{ scale: 0.97 }}
              style={{ width: '100%', height: '100%' }}
            >
              <span className="eyebrow">{sample.accent}</span>
              <strong>{sample.label}</strong>
              <p>{sample.description}</p>
            </SampleCard>
            </AnimatedItem>
          ))}
        </SampleGrid>
      </SampleSection>
    </section>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   3D Document Icon — Multi-layer with perspective
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function Doc3DSVG({ isDragover }: { isDragover: boolean }) {
  return (
    <svg width="64" height="74" viewBox="0 0 80 92" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ filter: 'drop-shadow(0 20px 40px var(--doc-shadow)) drop-shadow(0 4px 12px rgba(0,0,0,0.15))' }}
    >
      {/* Shadow page — deepest layer */}
      <rect x="6" y="10" width="48" height="60" rx="6" fill="var(--doc-shadow)" opacity="0.7" />

      {/* Middle page layer */}
      <rect x="12" y="6" width="48" height="60" rx="6" fill="var(--doc-mid)" stroke="var(--border)" strokeWidth="0.8" />

      {/* Front page — main document */}
      <rect x="18" y="14" width="48" height="60" rx="6"
        fill="url(#docGrad)"
        stroke={isDragover ? 'var(--accent)' : 'var(--border)'}
        strokeWidth="1.2"
      />

      {/* Folded corner with shadow */}
      <path d="M52 14V30H66" fill="var(--doc-fold-dark)" />
      <path d="M52 14V30H66" fill="url(#foldGrad)" />
      <path d="M52 14L66 30" stroke={isDragover ? 'var(--accent)' : 'var(--border)'} strokeWidth="0.8" />

      {/* Text lines with stagger animation feel */}
      <rect x="26" y="38" width="32" height="3" rx="1.5" fill="var(--doc-lines)" opacity="0.65" />
      <rect x="26" y="46" width="24" height="3" rx="1.5" fill="var(--doc-lines)" opacity="0.45" />
      <rect x="26" y="54" width="28" height="3" rx="1.5" fill="var(--doc-lines)" opacity="0.35" />
      <rect x="26" y="62" width="18" height="3" rx="1.5" fill="var(--doc-lines)" opacity="0.25" />

      {/* Upload arrow circle with glow */}
      <circle cx="56" cy="64" r="15"
        fill="var(--doc-circle)"
        stroke={isDragover ? 'var(--accent)' : 'var(--teal)'}
        strokeWidth="1.8"
      />
      {isDragover && (
        <circle cx="56" cy="64" r="15"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="0.5"
          opacity="0.4"
        />
      )}
      <path d="M56 71V57M50 61l6-6 6 6"
        stroke={isDragover ? 'var(--accent)' : 'var(--teal)'}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Gradients */}
      <defs>
        <linearGradient id="docGrad" x1="18" y1="14" x2="66" y2="74" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--doc-front-top)" />
          <stop offset="0.5" stopColor="var(--doc-front-mid)" />
          <stop offset="1" stopColor="var(--doc-front-bot)" />
        </linearGradient>
        <linearGradient id="foldGrad" x1="52" y1="14" x2="66" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--doc-fold)" />
          <stop offset="1" stopColor="var(--doc-fold-dark)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ━━━ Keyframes ━━━ */

const diagonalShimmer = keyframes`
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
`;

const neonPulse = keyframes`
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
`;

const progressPulse = keyframes`
  0%, 100% { box-shadow: 0 0 8px rgba(84, 208, 255, 0.5), 0 0 20px rgba(84, 208, 255, 0.15); }
  50% { box-shadow: 0 0 16px rgba(84, 208, 255, 0.9), 0 0 40px rgba(84, 208, 255, 0.3); }
`;

const glowPulse = keyframes`
  0%, 100% {
    box-shadow: 0 0 20px rgba(74, 222, 128, 0.3), 0 0 60px rgba(74, 222, 128, 0.1);
    border-color: rgba(74, 222, 128, 0.3);
  }
  50% {
    box-shadow: 0 0 30px rgba(74, 222, 128, 0.5), 0 0 80px rgba(74, 222, 128, 0.2);
    border-color: rgba(74, 222, 128, 0.6);
  }
`;

const orbitSpin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const haloBreath = keyframes`
  0%, 100% { transform: scale(1); opacity: 0.3; }
  50% { transform: scale(1.15); opacity: 0.6; }
`;

/* ━━━ Styled Components ━━━ */

const DropContainer = styled.div<{ $state: UploadState }>`
  position: relative;
  padding: 32px 40px;
  border-radius: 24px;
  overflow: hidden;
  width: 100%;
  min-height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: ${({ $state }) => ($state === 'idle' || $state === 'complete' ? 'pointer' : 'default')};
  transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  background: var(--bg-elevated);

  ${({ $state }) =>
    $state === 'idle' &&
    css`
      border: 1.5px dashed rgba(255, 255, 255, 0.1);
      &:hover {
        border-color: rgba(84, 208, 255, 0.3);
        background: var(--bg-card);
        box-shadow: 0 0 60px rgba(84, 208, 255, 0.04);
      }
    `}

  ${({ $state }) =>
    $state === 'dragover' &&
    css`
      border: 1.5px solid rgba(84, 208, 255, 0.6);
      background: radial-gradient(circle at 50% 50%, rgba(84, 208, 255, 0.04) 0%, var(--bg-elevated) 70%);
      box-shadow: 0 0 80px rgba(84, 208, 255, 0.06);
    `}

  ${({ $state }) =>
    ($state === 'uploading' || $state === 'success') &&
    css`
      border: 1.5px solid rgba(84, 208, 255, 0.5);
    `}

  ${({ $state }) =>
    $state === 'complete' &&
    css`
      border: 1.5px solid rgba(74, 222, 128, 0.25);
      background: var(--bg-elevated);
    `}
`;

const BorderGlow = styled.div<{ $state: UploadState }>`
  position: absolute;
  inset: -2px;
  border-radius: 22px;
  pointer-events: none;
  z-index: 0;
  opacity: 0;
  transition: opacity 0.6s ease;

  ${({ $state }) =>
    ($state === 'dragover' || $state === 'uploading') &&
    css`
      opacity: 1;
      box-shadow:
        0 0 40px rgba(84, 208, 255, 0.15),
        0 0 100px rgba(84, 208, 255, 0.06),
        inset 0 0 40px rgba(84, 208, 255, 0.02);
      animation: ${neonPulse} 3s ease-in-out infinite;
    `}

  ${({ $state }) =>
    $state === 'success' &&
    css`
      opacity: 1;
      box-shadow:
        0 0 40px rgba(74, 222, 128, 0.15),
        0 0 100px rgba(74, 222, 128, 0.06);
      animation: ${glowPulse} 2s ease-in-out infinite;
    `}

  ${({ $state }) =>
    $state === 'complete' &&
    css`
      opacity: 0.6;
      box-shadow:
        0 0 20px rgba(74, 222, 128, 0.1),
        0 0 50px rgba(74, 222, 128, 0.03);
    `}
`;

/* Orbiting particles on drag */
const ParticleOrbit = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  z-index: 2;
  pointer-events: none;
`;

const Particle = styled.div<{ $delay: number; $size: number; $distance: number; $speed: number }>`
  position: absolute;
  width: ${p => p.$size}px;
  height: ${p => p.$size}px;
  background: #54d0ff;
  border-radius: 50%;
  box-shadow: 0 0 ${p => p.$size * 3}px rgba(84, 208, 255, 0.6);
  animation: ${orbitSpin} ${p => p.$speed}s linear infinite;
  animation-delay: -${p => p.$delay}s;
  transform-origin: 0 0;

  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: ${p => p.$size * 3}px;
    height: ${p => p.$size * 3}px;
    background: radial-gradient(circle, rgba(84, 208, 255, 0.2) 0%, transparent 70%);
    border-radius: 50%;
  }

  /* Place particle at distance from center */
  margin-left: ${p => p.$distance}px;
  margin-top: -${p => p.$size / 2}px;
`;

/* Teal diagonal shimmer */
const ShimmerBg = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: 20px;
  pointer-events: none;
  background:
    repeating-linear-gradient(
      -55deg,
      transparent 0px,
      transparent 8px,
      var(--shimmer-lines) 8px,
      var(--shimmer-lines) 9px
    ),
    linear-gradient(
      135deg,
      var(--shimmer-1) 0%,
      var(--shimmer-2) 30%,
      var(--shimmer-3) 60%,
      var(--shimmer-4) 100%
    );
  background-size: 400% 100%, 100% 100%;
  animation: ${diagonalShimmer} 10s linear infinite;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at 50% 40%, rgba(84, 208, 255, 0.06) 0%, transparent 60%);
  }

  [data-theme="light"] & {
    background:
      repeating-linear-gradient(
        -55deg,
        transparent 0px,
        transparent 8px,
        rgba(5, 118, 66, 0.025) 8px,
        rgba(5, 118, 66, 0.025) 9px
      ),
      linear-gradient(
        135deg,
        rgba(243, 242, 239, 0.95) 0%,
        rgba(238, 237, 233, 0.9) 30%,
        rgba(240, 239, 235, 0.92) 60%,
        rgba(245, 244, 241, 0.95) 100%
      );
    background-size: 400% 100%, 100% 100%;
  }

  [data-theme="light"] &::after {
    background: radial-gradient(ellipse at 50% 40%, rgba(5, 118, 66, 0.03) 0%, transparent 60%);
  }
`;

const SuccessPulseRing = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 60px;
  height: 60px;
  margin: -30px 0 0 -30px;
  border-radius: 50%;
  border: 2px solid rgba(74, 222, 128, 0.3);
  pointer-events: none;
  z-index: 3;
`;

const ContentLayer = styled.div`
  position: relative;
  z-index: 5;
  width: 100%;
`;

/* 3D Icon Container with CSS perspective */
const DocIcon3DContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
  perspective: 600px;
  transform-style: preserve-3d;
  position: relative;
`;

const DocGlowHalo = styled.div<{ $active: boolean }>`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 120px;
  height: 120px;
  margin: -60px 0 0 -60px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    ${p => p.$active ? 'rgba(84, 208, 255, 0.15)' : 'rgba(59, 89, 152, 0.12)'} 0%,
    transparent 70%
  );
  animation: ${haloBreath} ${p => p.$active ? '1.5s' : '4s'} ease-in-out infinite;
  pointer-events: none;
`;

const DropTitle = styled.h2`
  margin: 0 0 6px;
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text);
`;

const DropSubtext = styled.p`
  margin: 0;
  color: var(--muted);
  font-size: 0.95rem;
`;

const BrowseLink = styled.span`
  color: #54d0ff;
  cursor: pointer;
  font-weight: 500;
  text-decoration: underline;
  text-decoration-color: rgba(84, 208, 255, 0.3);
  text-underline-offset: 3px;
  transition: all 0.3s;

  &:hover {
    text-decoration-color: #54d0ff;
    text-shadow: 0 0 12px rgba(84, 208, 255, 0.3);
  }
`;

const RequirementsText = styled.p`
  margin: 20px 0 0;
  color: var(--muted);
  font-size: 0.78rem;
`;

/* ── Uploading state ── */

const ProgressBarContainer = styled.div`
  max-width: 300px;
  margin: 0 auto 24px;
`;

const ProgressTrack = styled.div`
  position: relative;
  height: 5px;
  border-radius: 999px;
  background: var(--surface);
  overflow: visible;
`;

const ProgressFill = styled.div`
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #2f7cf6, #54d0ff, #3dd9c1);
  position: relative;
  animation: ${progressPulse} 2s ease-in-out infinite;

  &::after {
    content: '';
    position: absolute;
    right: -3px;
    top: 50%;
    transform: translateY(-50%);
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: #54d0ff;
    box-shadow: 0 0 14px rgba(84, 208, 255, 0.9), 0 0 35px rgba(84, 208, 255, 0.35);
  }
`;

const PercentageText = styled.div`
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
`;

const UploadingText = styled.p`
  font-size: 1.1rem;
  font-weight: 500;
  color: var(--muted);
  margin: 0;
`;

/* ── Success state ── */

const CheckmarkContainer = styled.div`
  width: 80px;
  height: 80px;
  margin: 0 auto 16px;
  position: relative;
  display: grid;
  place-items: center;
`;

const CheckmarkGlowRing = styled.div`
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 2px solid rgba(74, 222, 128, 0.3);
  animation: ${glowPulse} 2s ease-in-out infinite;
`;

const CheckmarkInner = styled.div`
  width: 64px;
  height: 64px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: rgba(74, 222, 128, 0.08);
  border: 1.5px solid rgba(74, 222, 128, 0.2);
`;

const SuccessLabel = styled.div`
  font-size: 1.1rem;
  font-weight: 600;
  color: #4ade80;
  margin-bottom: 8px;
  text-shadow: 0 0 20px rgba(74, 222, 128, 0.3);
`;

/* ── File Card ── */

const FileItemCard = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 16px;
  padding: 16px 20px;
  border-radius: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  backdrop-filter: blur(8px);
`;

const FileItemIconWrap = styled.div`
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: linear-gradient(135deg, #3b5998, #5b7cc2);
  flex-shrink: 0;
  box-shadow: 0 4px 16px rgba(59, 89, 152, 0.3);
`;

const FileItemIconLabel = styled.span`
  font-size: 0.65rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: 0.05em;
`;

const FileItemDetails = styled.div`
  flex: 1;
  min-width: 0;
`;

const FileItemName = styled.div`
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const FileItemSize = styled.div`
  font-size: 0.75rem;
  color: var(--muted);
  margin-top: 2px;
`;

const FileItemActions = styled.div`
  display: flex;
  gap: 8px;
`;

const FileActionBtn = styled.button`
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    color: var(--text);
    border-color: rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.08);
    box-shadow: 0 0 12px rgba(255, 255, 255, 0.05);
  }
`;

const ErrorBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  padding: 14px 18px;
  border-radius: 14px;
  background: rgba(255, 80, 100, 0.08);
  border: 1px solid rgba(255, 80, 100, 0.2);
  color: #ff6f7d;
  font-size: 0.88rem;
  font-weight: 500;
`;

const ErrorDismiss = styled.button`
  margin-left: auto;
  background: none;
  border: none;
  color: #ff6f7d;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0 4px;
  opacity: 0.6;
  &:hover { opacity: 1; }
`;

const SampleSection = styled.div`
  margin-top: 32px;
  width: 100%;
`;

const SampleGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 24px;
`;

const SampleCard = styled.button`
  padding: 18px;
  text-align: left;
  border-radius: 20px;
  border: 1px solid var(--border);
  color: inherit;
  background: var(--surface);
  transition: background 0.3s ease;

  &:hover {
    background: var(--surface-hover);
  }

  strong {
    display: block;
    margin-top: 10px;
  }

  p {
    margin: 6px 0 0;
    color: var(--muted);
    font-size: 0.88rem;
  }
`;
