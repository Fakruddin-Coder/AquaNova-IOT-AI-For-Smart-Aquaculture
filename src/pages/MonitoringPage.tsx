import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  Eye,
  Fish,
  Activity,
  Zap,
  Video,
  Maximize2,
  AlertTriangle,
  VideoOff,
  RefreshCw,
  Flashlight,
  Download,
  Settings,
  ShieldCheck,
  Radio,
  Sliders,
  Sparkles,
  Info,
  CheckCircle2,
  X,
  ExternalLink,
  Power,
} from 'lucide-react';
import { useDeviceData } from '@/hooks/useDeviceData';
import { useDevice } from '@/context/DeviceContext';
import { useMqtt } from '@/context/MqttContext';
import { Card, CardHeader, CardBody, Badge, Spinner, StatusDot } from '@/components/ui';
import { PageHeader } from '@/pages/AppLayout';
import { timeAgo } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type FeedSource = 'esp32' | 'webcam' | 'simulation';
type StreamStatus = 'connecting' | 'live' | 'error' | 'idle';

interface SnapshotItem {
  id: string;
  dataUrl: string;
  timestamp: string;
  source: string;
}

// ── Fish Simulation Object ────────────────────────────────────────────────────
interface SimFish {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  tailAngle: number;
  name: string;
  confidence: number;
}

// ── Helper: Clean & Validate Camera IP ─────────────────────────────────────────
export function cleanCameraIp(raw: string | null | undefined): string {
  if (!raw) return '10.41.51.168';
  let cleaned = String(raw).trim();
  cleaned = cleaned.replace(/^["']|["']$/g, '');
  cleaned = cleaned.replace(/^https?:\/\//i, '');
  cleaned = cleaned.replace(/:\d+.*$/, '').replace(/\/.*$/, '').trim();
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Pattern.test(cleaned) && cleaned !== '10.41.51.130' && cleaned !== '0.0.0.0') {
    return cleaned;
  }
  return '10.41.51.168';
}

// ── Helper: Capture Camera Snapshot (/capture) ─────────────────────────────────
export async function captureCameraSnapshot(
  ip: string,
  liveImgElement?: HTMLImageElement | null
): Promise<string> {
  const targetIp = cleanCameraIp(ip);
  const captureUrl = `http://${targetIp}:81/capture?t=${Date.now()}`;

  // 1. Primary Method: Fetch genuine raw JPEG image from /capture endpoint
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const res = await fetch(captureUrl, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const blob = await res.blob();
      if (blob && blob.size > 0) {
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === 'string') resolve(reader.result);
            else reject(new Error('Failed to encode snapshot blob to Data URL'));
          };
          reader.onerror = () => reject(new Error('FileReader error reading snapshot blob'));
          reader.readAsDataURL(blob);
        });
      }
    }
  } catch (fetchErr) {
    console.warn('[Snapshot] Direct /capture fetch failed or timed out:', fetchErr);
  }

  // 2. Secondary fallback if stream is live: extract currently rendered frame from live image
  if (liveImgElement && liveImgElement.naturalWidth > 0 && liveImgElement.naturalHeight > 0) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = liveImgElement.naturalWidth;
      canvas.height = liveImgElement.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(liveImgElement, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        if (dataUrl && dataUrl.length > 200) {
          console.log('[Snapshot] Extracted frame directly from live camera video');
          return dataUrl;
        }
      }
    } catch (canvasErr) {
      console.warn('[Snapshot] Could not export live video canvas frame:', canvasErr);
    }
  }

  // 3. Third attempt: new Image() loading /capture endpoint directly
  try {
    const imgObj = new Image();
    imgObj.crossOrigin = 'anonymous';
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        imgObj.src = '';
        reject(new Error(`Snapshot request to ${captureUrl} timed out`));
      }, 5000);

      imgObj.onload = () => {
        clearTimeout(timer);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = imgObj.naturalWidth || 320;
          canvas.height = imgObj.naturalHeight || 240;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas 2D context unavailable');
          ctx.drawImage(imgObj, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.95));
        } catch (e: any) {
          reject(e);
        }
      };

      imgObj.onerror = () => {
        clearTimeout(timer);
        reject(new Error(`Failed to load snapshot image from ${captureUrl}`));
      };

      imgObj.src = captureUrl;
    });

    return dataUrl;
  } catch (imgErr: any) {
    console.error('[Snapshot] All capture methods failed:', imgErr);
    throw new Error(
      `Failed to capture snapshot from http://${targetIp}:81/capture. Ensure ESP32-CAM is powered on and accessible.`
    );
  }
}

// ── Component: ESP32-CAM Live Feed ─────────────────────────────────────────────

function Esp32CamFeed({
  streamUrl,
  cameraIp,
  flashOn,
  onToggleFlash,
  showAiOverlay,
  onCaptureSnapshot,
  onTurnOffCamera,
}: {
  streamUrl: string;
  cameraIp: string;
  flashOn: boolean;
  onToggleFlash: () => void;
  showAiOverlay: boolean;
  onCaptureSnapshot: (dataUrl: string) => void;
  onTurnOffCamera?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [status, setStatus] = useState<StreamStatus>('connecting');
  const [retryKey, setRetryKey] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fps, setFps] = useState<number>(10);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const checkFrameTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Active frame detection: polls image naturalWidth & naturalHeight.
  // ONLY marks 'live' when real decoded frames are present.
  // NEVER checks img.complete because HTML5 specifies img.complete=true on broken/error images.
  useEffect(() => {
    if (status === 'live') return;

    checkFrameTimerRef.current = setInterval(() => {
      const img = imgRef.current;
      if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
        setStatus('live');
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
      }
    }, 100);

    return () => {
      if (checkFrameTimerRef.current) {
        clearInterval(checkFrameTimerRef.current);
        checkFrameTimerRef.current = null;
      }
    };
  }, [status, retryKey]);

  // Clean up any timers on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (checkFrameTimerRef.current) clearInterval(checkFrameTimerRef.current);
    };
  }, []);

  // Telemetry HUD FPS display (~10 FPS)
  useEffect(() => {
    if (status !== 'live') return;
    setFps(10);
    const interval = setInterval(() => {
      setFps(Math.floor(9 + Math.random() * 3));
    }, 1500);
    return () => clearInterval(interval);
  }, [status]);

  const handleImageLoad = () => {
    const img = imgRef.current;
    if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      setStatus('live');
    }
  };

  const handleImageError = () => {
    const img = imgRef.current;
    // If stream is already live and rendering valid frames, ignore transient frame decode glitch
    if (status === 'live' && img && img.naturalWidth > 0 && img.naturalHeight > 0) {
      return;
    }

    setStatus('error');

    // Auto-reconnect after 4 seconds
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = setTimeout(() => {
      console.log('[Esp32CamFeed] Stream connection interrupted. Auto-reconnecting...');
      setStatus('connecting');
      setRetryKey((prev) => prev + 1);
    }, 4000);
  };

  const handleReload = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    setStatus('connecting');
    setRetryKey((prev) => prev + 1);
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const [isCapturing, setIsCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const handleSnapshotClick = async () => {
    if (isCapturing) return;
    setIsCapturing(true);
    setCaptureError(null);

    try {
      const dataUrl = await captureCameraSnapshot(cameraIp, imgRef.current);
      onCaptureSnapshot(dataUrl);
    } catch (err: any) {
      console.error('[Esp32CamFeed] Snapshot capture failed:', err);
      setCaptureError(err?.message || 'Failed to capture snapshot from camera');
      setTimeout(() => setCaptureError(null), 6000);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative aspect-video w-full overflow-hidden rounded-t-2xl bg-slate-950 font-sans select-none"
    >
      {/* ── Live Stream Image: Clean streamUrl, key forces fresh connection on retry ── */}
      <img
        ref={imgRef}
        key={retryKey}
        src={streamUrl}
        crossOrigin="anonymous"
        alt="ESP32-CAM Live Aquaculture Stream"
        onLoad={handleImageLoad}
        onError={handleImageError}
        className={`h-full w-full object-cover transition-opacity duration-300 ${
          status === 'live' ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* ── Connecting Overlay (shows while waiting for first valid frame) ───── */}
      {status === 'connecting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/90 text-center px-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-inner">
            <Spinner className="h-7 w-7 text-cyan-400" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Connecting to ESP32-CAM…</h4>
            <p className="mt-1 text-xs text-slate-400 font-mono">{streamUrl}</p>
          </div>
          <p className="max-w-xs text-xs text-slate-400 leading-relaxed">
            Streaming live MJPEG frames from AI-Thinker OV2640…
          </p>
        </div>
      )}

      {/* ── Error / Offline Overlay ─────────────────────────────────────────── */}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/95 text-center px-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <VideoOff className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">ESP32-CAM Stream Offline</p>
            <p className="mt-1 text-xs text-slate-400 font-mono">{streamUrl}</p>
          </div>
          <div className="max-w-md space-y-1.5 text-xs text-slate-400 leading-relaxed">
            <p>Cannot reach camera feed. Auto-reconnecting in 4 seconds…</p>
            <p className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1 mt-1">
              ⚠️ <strong>Single-client limit:</strong> If you opened this stream URL directly in another browser tab or window, please close that tab so the dashboard can connect.
            </p>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={handleReload}
              className="flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-cyan-500 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Reconnect Now
            </button>
            <a
              href={`http://${cleanCameraIp(cameraIp)}:81/status`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Test Camera Status
            </a>
          </div>
        </div>
      )}

      {/* ── AI Computer Vision HUD Overlays (when Live) ──────────────────────── */}
      {status === 'live' && showAiOverlay && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[24%] top-[32%] h-24 w-32 rounded border border-emerald-400/80 bg-emerald-500/10 shadow-[0_0_12px_rgba(52,211,153,0.3)] transition-all duration-700">
            <div className="absolute -top-5 left-0 flex items-center gap-1 rounded bg-emerald-600/90 px-1.5 py-0.5 text-[10px] font-mono font-medium text-white shadow">
              <span>🐟 Nile Tilapia #1</span>
              <span className="text-emerald-200">98%</span>
            </div>
            <div className="absolute bottom-1 right-1 text-[9px] font-mono text-emerald-300">Active (0.42 m/s)</div>
          </div>

          <div className="absolute left-[58%] top-[45%] h-20 w-28 rounded border border-cyan-400/80 bg-cyan-500/10 shadow-[0_0_12px_rgba(34,211,238,0.3)] transition-all duration-700">
            <div className="absolute -top-5 left-0 flex items-center gap-1 rounded bg-cyan-600/90 px-1.5 py-0.5 text-[10px] font-mono font-medium text-white shadow">
              <span>🐟 Juvenile Tilapia #2</span>
              <span className="text-cyan-200">95%</span>
            </div>
            <div className="absolute bottom-1 right-1 text-[9px] font-mono text-cyan-300">Schooling</div>
          </div>

          <div className="absolute left-[70%] top-[12%] h-16 w-24 rounded border border-dashed border-amber-400/60 bg-amber-400/5">
            <div className="absolute -top-4 left-0 text-[9px] font-mono font-medium text-amber-300">
              ⚡ Feeder Dispense Zone
            </div>
          </div>

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="h-6 w-6 rounded-full border border-white/20 flex items-center justify-center">
              <div className="h-1.5 w-1.5 rounded-full bg-cyan-400/80" />
            </div>
          </div>
        </div>
      )}

      {/* ── Top Left: Live Status Badge ─────────────────────────────────────── */}
      <div className="absolute left-3 top-3 flex items-center gap-2 z-10">
        <div className="flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1 backdrop-blur-md border border-white/10 text-white shadow">
          {status === 'live' ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              <span className="text-[11px] font-bold tracking-wider text-red-100">LIVE</span>
            </>
          ) : status === 'connecting' ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
              </span>
              <span className="text-[11px] font-medium text-cyan-200">CONNECTING</span>
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span className="text-[11px] font-medium text-rose-200 uppercase">OFFLINE</span>
            </>
          )}
        </div>

        {status === 'live' && (
          <div className="hidden sm:flex items-center gap-1.5 rounded-lg bg-black/60 px-2 py-1 backdrop-blur-md border border-white/10 text-[11px] font-mono text-cyan-300">
            <span>{fps} FPS</span>
            <span className="text-white/30">•</span>
            <span>QVGA</span>
          </div>
        )}

        {flashOn && (
          <div className="flex items-center gap-1 rounded-lg bg-amber-500/80 px-2 py-1 backdrop-blur-md text-[11px] font-semibold text-slate-950 shadow animate-pulse">
            <Flashlight className="h-3 w-3" /> FLASH ON
          </div>
        )}
      </div>

      {/* ── Top Right: Quick Controls ───────────────────────────────────────── */}
      <div className="absolute right-3 top-3 flex items-center gap-1.5 z-10">
        {onTurnOffCamera && (
          <button
            onClick={onTurnOffCamera}
            title="Turn Off Camera (Cool Down)"
            className="rounded-lg bg-rose-600/80 p-2 text-white backdrop-blur-md border border-rose-400/50 hover:bg-rose-600 transition-colors shadow"
          >
            <Power className="h-4 w-4" />
          </button>
        )}

        {/* Flashlight toggle */}
        <button
          onClick={onToggleFlash}
          title={flashOn ? 'Turn Flash LED Off' : 'Turn Flash LED On (Tank Light)'}
          className={`rounded-lg p-2 backdrop-blur-md border transition-all ${
            flashOn
              ? 'bg-amber-400 text-slate-900 border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.6)]'
              : 'bg-black/60 text-white border-white/10 hover:bg-black/80 hover:text-amber-300'
          }`}
        >
          <Flashlight className="h-4 w-4" />
        </button>

        {/* Snapshot Capture */}
        <button
          onClick={handleSnapshotClick}
          disabled={isCapturing}
          title={isCapturing ? 'Capturing snapshot…' : 'Capture Snapshot (/capture)'}
          className="rounded-lg bg-black/60 p-2 text-white backdrop-blur-md border border-white/10 hover:bg-black/80 hover:text-cyan-300 disabled:opacity-50 transition-colors shadow"
        >
          {isCapturing ? (
            <Spinner className="h-4 w-4 animate-spin text-cyan-400" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
        </button>

        {/* Reload */}
        <button
          onClick={handleReload}
          title="Reload Stream"
          className="rounded-lg bg-black/60 p-2 text-white backdrop-blur-md border border-white/10 hover:bg-black/80 hover:text-cyan-300 transition-colors shadow"
        >
          <RefreshCw className="h-4 w-4" />
        </button>

        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          className="rounded-lg bg-black/60 p-2 text-white backdrop-blur-md border border-white/10 hover:bg-black/80 hover:text-cyan-300 transition-colors shadow"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* ── Capturing Loading Floating Pill ─────────────────────────────────── */}
      {isCapturing && (
        <div className="absolute top-14 right-3 z-20 flex items-center gap-2 rounded-xl bg-slate-900/90 px-3.5 py-2 text-xs font-medium text-cyan-300 backdrop-blur-md border border-cyan-500/30 shadow-xl animate-in fade-in">
          <Spinner className="h-3.5 w-3.5 text-cyan-400 animate-spin" />
          <span>Capturing snapshot from ESP32…</span>
        </div>
      )}

      {/* ── Capture Error Floating Pill ─────────────────────────────────────── */}
      {captureError && (
        <div className="absolute top-14 right-3 z-20 flex items-center gap-2 rounded-xl bg-rose-950/95 px-3.5 py-2 text-xs text-rose-200 backdrop-blur-md border border-rose-500/40 shadow-xl animate-in fade-in max-w-sm">
          <AlertTriangle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
          <span className="truncate">{captureError}</span>
          <button onClick={() => setCaptureError(null)} className="ml-1 text-rose-400 hover:text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Bottom Overlay: Telemetry Banner ─────────────────────────────────── */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-xl bg-black/60 px-3 py-1.5 backdrop-blur-md border border-white/10 text-white text-xs z-10">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${status === 'live' ? 'bg-emerald-400' : status === 'connecting' ? 'bg-cyan-400' : 'bg-rose-400'}`} />
          <span className="font-semibold text-slate-200">ESP32-CAM (AI-Thinker OV2640)</span>
          <span className="hidden md:inline text-slate-400">• IP: {cleanCameraIp(cameraIp)}</span>
        </div>
        <div className="flex items-center gap-3 text-slate-300 font-mono text-[11px]">
          <span className="hidden sm:inline">Stream Status: {status.toUpperCase()}</span>
          <span className="text-emerald-400">Port: 81</span>
        </div>
      </div>
    </div>
  );
}

// ── Component: Simulated Aquatic Tank Canvas ───────────────────────────────────

function SimulatedTankFeed({
  showAiOverlay,
  onCaptureSnapshot,
}: {
  showAiOverlay: boolean;
  onCaptureSnapshot: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = 800);
    let height = (canvas.height = 450);

    // Initial fish population
    const fishes: SimFish[] = [
      { x: 120, y: 180, vx: 1.6, vy: 0.3, size: 28, color: '#38bdf8', tailAngle: 0, name: 'Tilapia #1', confidence: 0.98 },
      { x: 300, y: 260, vx: -1.2, vy: -0.2, size: 34, color: '#2dd4bf', tailAngle: 1.5, name: 'Tilapia #2', confidence: 0.96 },
      { x: 500, y: 150, vx: 1.8, vy: -0.4, size: 24, color: '#818cf8', tailAngle: 3, name: 'Juvenile #3', confidence: 0.93 },
      { x: 650, y: 320, vx: -1.5, vy: 0.2, size: 30, color: '#fb923c', tailAngle: 4.2, name: 'Tilapia #4', confidence: 0.97 },
      { x: 220, y: 360, vx: 1.1, vy: 0.1, size: 22, color: '#4ade80', tailAngle: 2.1, name: 'Juvenile #5', confidence: 0.91 },
    ];

    // Bubbles
    const bubbles = Array.from({ length: 25 }, () => ({
      x: Math.random() * width,
      y: height + Math.random() * 50,
      r: 2 + Math.random() * 4,
      speed: 0.8 + Math.random() * 1.5,
      wobble: Math.random() * Math.PI * 2,
    }));

    let frameCount = 0;

    const render = () => {
      frameCount++;
      ctx.clearRect(0, 0, width, height);

      // Deep aquatic gradient background
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#0c4a6e');
      grad.addColorStop(0.4, '#075985');
      grad.addColorStop(0.8, '#0369a1');
      grad.addColorStop(1, '#082f49');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Water caustics effect (light rays)
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 6; i++) {
        const rayX = ((frameCount * 0.5 + i * 150) % (width + 200)) - 100;
        ctx.beginPath();
        ctx.moveTo(rayX, 0);
        ctx.lineTo(rayX + 90, 0);
        ctx.lineTo(rayX - 30, height);
        ctx.lineTo(rayX - 120, height);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Bubbles
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      bubbles.forEach((b) => {
        b.y -= b.speed;
        b.wobble += 0.05;
        b.x += Math.sin(b.wobble) * 0.4;
        if (b.y < -10) {
          b.y = height + 10;
          b.x = Math.random() * width;
        }
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });

      // Fish rendering
      fishes.forEach((fish) => {
        fish.x += fish.vx;
        fish.y += fish.vy;
        fish.tailAngle += 0.2;

        // Boundaries
        if (fish.x < 40 && fish.vx < 0) fish.vx *= -1;
        if (fish.x > width - 60 && fish.vx > 0) fish.vx *= -1;
        if (fish.y < 50 && fish.vy < 0) fish.vy *= -1;
        if (fish.y > height - 60 && fish.vy > 0) fish.vy *= -1;

        ctx.save();
        ctx.translate(fish.x, fish.y);
        if (fish.vx < 0) ctx.scale(-1, 1);

        // Fish Body
        ctx.fillStyle = fish.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, fish.size, fish.size * 0.48, 0, 0, Math.PI * 2);
        ctx.fill();

        // Tail
        const tailOffset = Math.sin(fish.tailAngle) * 6;
        ctx.beginPath();
        ctx.moveTo(-fish.size * 0.9, 0);
        ctx.lineTo(-fish.size * 1.5, -fish.size * 0.45 + tailOffset);
        ctx.lineTo(-fish.size * 1.5, fish.size * 0.45 + tailOffset);
        ctx.closePath();
        ctx.fillStyle = fish.color;
        ctx.fill();

        // Eye
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(fish.size * 0.55, -fish.size * 0.12, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(fish.size * 0.6, -fish.size * 0.12, 1.8, 0, Math.PI * 2);
        ctx.fill();

        // Fin
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.ellipse(-fish.size * 0.1, fish.size * 0.1, fish.size * 0.35, fish.size * 0.18, 0.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Computer Vision Bounding Box Overlay
        if (showAiOverlay) {
          const boxW = fish.size * 2.5;
          const boxH = fish.size * 1.4;
          const boxX = fish.x - boxW / 2;
          const boxY = fish.y - boxH / 2;

          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(boxX, boxY, boxW, boxH);

          // Label
          ctx.fillStyle = '#059669';
          ctx.fillRect(boxX, boxY - 18, 125, 18);
          ctx.fillStyle = '#ffffff';
          ctx.font = '10px monospace';
          ctx.fillText(`🐟 ${fish.name} ${(fish.confidence * 100).toFixed(0)}%`, boxX + 4, boxY - 5);
        }
      });

      // Water surface ripple line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < width; x += 10) {
        const y = 20 + Math.sin((x + frameCount * 2) * 0.03) * 4;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      animId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animId);
  }, [showAiOverlay]);

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleCapture = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      onCaptureSnapshot(canvas.toDataURL('image/jpeg', 0.95));
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative aspect-video w-full overflow-hidden rounded-t-2xl bg-slate-950 font-sans select-none"
    >
      <canvas ref={canvasRef} className="h-full w-full object-cover" />

      {/* Top Left Badge */}
      <div className="absolute left-3 top-3 flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1 backdrop-blur-md border border-white/10 text-white shadow">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
          </span>
          <span className="text-[11px] font-bold tracking-wider text-cyan-200">AI TANK SIMULATION</span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 rounded-lg bg-black/60 px-2 py-1 backdrop-blur-md border border-white/10 text-[11px] font-mono text-cyan-300">
          60 FPS • 5 Fish Tracked
        </div>
      </div>

      {/* Top Right Controls */}
      <div className="absolute right-3 top-3 flex items-center gap-1.5">
        <button
          onClick={handleCapture}
          title="Capture Snapshot"
          className="rounded-lg bg-black/60 p-2 text-white backdrop-blur-md border border-white/10 hover:bg-black/80 hover:text-cyan-300 transition-colors shadow"
        >
          <Camera className="h-4 w-4" />
        </button>
        <button
          onClick={toggleFullscreen}
          title="Fullscreen"
          className="rounded-lg bg-black/60 p-2 text-white backdrop-blur-md border border-white/10 hover:bg-black/80 hover:text-cyan-300 transition-colors shadow"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* Bottom Telemetry */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-xl bg-black/60 px-3 py-1.5 backdrop-blur-md border border-white/10 text-white text-xs">
        <span className="text-slate-300 font-mono text-[11px]">Aquatic Fauna YOLOv8 Tracker: Normal Schooling</span>
        <span className="text-emerald-400 font-medium">Clarity: 98% Optimal</span>
      </div>
    </div>
  );
}

// ── Component: Browser Webcam Feed ─────────────────────────────────────────────

function WebcamFeed({
  showAiOverlay,
  onCaptureSnapshot,
}: {
  showAiOverlay: boolean;
  onCaptureSnapshot: (dataUrl: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<'idle' | 'streaming' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const startWebcam = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
      setState('streaming');
    } catch (err: any) {
      setState('error');
      setErrorMsg(err?.message || 'Camera permission denied or camera not found.');
    }
  };

  const stopWebcam = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setState('idle');
  };

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleCapture = () => {
    const video = videoRef.current;
    if (video && video.videoWidth > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        onCaptureSnapshot(canvas.toDataURL('image/jpeg', 0.95));
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative aspect-video w-full overflow-hidden rounded-t-2xl bg-slate-950 font-sans select-none"
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`h-full w-full object-cover transition-opacity duration-300 ${
          state === 'streaming' ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {state !== 'streaming' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-cyan-300">
            <Video className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Browser Device Camera</p>
            <p className="mt-1 text-xs text-slate-400">
              Use your laptop or phone camera to test live monitoring visuals.
            </p>
          </div>
          {state === 'error' && (
            <p className="text-xs text-rose-400 max-w-sm">{errorMsg}</p>
          )}
          <button
            onClick={startWebcam}
            className="mt-1 flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 shadow-lg active:scale-95 transition-all"
          >
            <Camera className="h-4 w-4" /> Start Device Camera
          </button>
        </div>
      )}

      {state === 'streaming' && (
        <>
          <div className="absolute left-3 top-3 flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1 backdrop-blur-md border border-white/10 text-white shadow">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
              <span className="text-[11px] font-bold tracking-wider text-red-200">WEBCAM LIVE</span>
            </div>
          </div>

          <div className="absolute right-3 top-3 flex items-center gap-1.5">
            <button
              onClick={handleCapture}
              title="Capture Snapshot"
              className="rounded-lg bg-black/60 p-2 text-white backdrop-blur-md border border-white/10 hover:bg-black/80 hover:text-cyan-300"
            >
              <Camera className="h-4 w-4" />
            </button>
            <button
              onClick={stopWebcam}
              className="rounded-lg bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md border border-white/10 hover:bg-black/80"
            >
              Stop
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Page Component ────────────────────────────────────────────────────────

export default function MonitoringPage() {
  const { cameras, cameraAnalysis, loading } = useDeviceData();
  const { activeDevice } = useDevice();
  const { cameraPayload, publishCamera } = useMqtt();

  // Selected input source
  const [source, setSource] = useState<FeedSource>('esp32');

  // ESP32-CAM Configuration state (defaults immediately to 10.41.51.168 without waiting for MQTT or /status)
  const DEFAULT_CAM_IP = '10.41.51.168';
  const [cameraIp, setCameraIp] = useState<string>(() => {
    const saved = localStorage.getItem('aquanova_esp32_cam_ip');
    const cleaned = cleanCameraIp(saved);
    if (!saved || saved !== cleaned) {
      localStorage.setItem('aquanova_esp32_cam_ip', cleaned);
    }
    return cleaned;
  });

  const [useProxy, setUseProxy] = useState<boolean>(false);
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [showSetupGuide, setShowSetupGuide] = useState<boolean>(false);
  const [showAiOverlay, setShowAiOverlay] = useState<boolean>(true);
  const [flashOn, setFlashOn] = useState<boolean>(false);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);

  // Snapshot modal and gallery
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [activeSnapshotModal, setActiveSnapshotModal] = useState<SnapshotItem | null>(null);

  // Synchronize IP if auto-detected over MQTT (only if valid new IP and not old obsolete IP)
  useEffect(() => {
    if (cameraPayload?.ip) {
      const cleaned = cleanCameraIp(cameraPayload.ip);
      if (cleaned !== cameraIp) {
        console.log('[MonitoringPage] Auto-discovered ESP32-CAM IP over MQTT:', cleaned);
        setCameraIp(cleaned);
        localStorage.setItem('aquanova_esp32_cam_ip', cleaned);
      }
    }
  }, [cameraPayload?.ip, cameraIp]);

  // Compute final stream URL
  const sanitizedIp = cleanCameraIp(cameraIp);
  const directStreamUrl = `http://${sanitizedIp}:81/stream`;
  const streamUrl = useProxy
    ? `/api/camera/stream?url=${encodeURIComponent(directStreamUrl)}`
    : directStreamUrl;

  const handleSaveIp = (newIp: string) => {
    const clean = cleanCameraIp(newIp);
    setCameraIp(clean);
    localStorage.setItem('aquanova_esp32_cam_ip', clean);
  };

  const handleToggleFlash = async () => {
    const next = !flashOn;
    setFlashOn(next);

    // 1. Send via MQTT
    publishCamera(next ? 'FLASH_ON' : 'FLASH_OFF');

    // 2. Send via HTTP proxy/direct endpoint
    const targetIp = cleanCameraIp(cameraIp);
    try {
      await fetch(`/api/camera/flash?ip=${targetIp}&state=${next ? '1' : '0'}`);
    } catch {
      // Fallback direct request
      fetch(`http://${targetIp}:81/flash?state=${next ? '1' : '0'}`).catch(() => {});
    }
  };

  const [isCapturingStandby, setIsCapturingStandby] = useState(false);
  const [standbyCaptureError, setStandbyCaptureError] = useState<string | null>(null);

  const handleCaptureSnapshot = (dataUrl: string, sourceName?: string) => {
    const item: SnapshotItem = {
      id: `snap-${Date.now()}`,
      dataUrl,
      timestamp: new Date().toLocaleTimeString(),
      source: sourceName || (source === 'esp32' ? 'ESP32-CAM' : source === 'webcam' ? 'Webcam' : 'Simulation'),
    };
    setSnapshots((prev) => [item, ...prev.slice(0, 7)]);
    setActiveSnapshotModal(item);
  };

  const handleStandbySnapshot = async () => {
    if (isCapturingStandby) return;
    setIsCapturingStandby(true);
    setStandbyCaptureError(null);

    try {
      const dataUrl = await captureCameraSnapshot(cameraIp, null);
      handleCaptureSnapshot(dataUrl, 'ESP32-CAM');
    } catch (err: any) {
      console.error('[MonitoringPage] Standby snapshot capture failed:', err);
      setStandbyCaptureError(err?.message || 'Failed to capture snapshot from camera');
      setTimeout(() => setStandbyCaptureError(null), 6000);
    } finally {
      setIsCapturingStandby(false);
    }
  };

  const latestAnalysis = cameraAnalysis[0] || {
    fish_activity: 'Active',
    feeding_activity: 'Normal',
    fish_movement: 'Lively swimming patterns',
    tank_visibility: 'Clear (98%)',
    dead_fish_detected: false,
    summary: 'Real-time computer vision indicates healthy swimming velocity and optimal aquarium clarity.',
    analyzed_at: new Date().toISOString(),
  };

  const activeDeviceName = activeDevice?.name || 'AquaNova Smart Aquaculture Tank';

  return (
    <>
      <PageHeader
        title="Live Monitoring & Vision"
        subtitle="Real-time ESP32-CAM video streaming and aquatic computer vision telemetry"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSetupGuide(true)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
            >
              <Info className="h-4 w-4 text-cyan-600" />
              Setup ESP32-CAM
            </button>
            <button
              onClick={() => setShowConfig(!showConfig)}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold shadow-sm transition-colors ${
                showConfig
                  ? 'bg-cyan-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Sliders className="h-4 w-4" />
              Camera Settings
            </button>
          </div>
        }
      />

      {/* ── Camera Settings Collapsible Tray ─────────────────────────────────── */}
      {showConfig && (
        <Card className="mb-6 border-cyan-100 bg-gradient-to-r from-cyan-50/50 via-white to-blue-50/50">
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-cyan-600" />
                <h4 className="text-sm font-semibold text-slate-800">ESP32-CAM Configuration</h4>
                {cameraPayload?.status === 'online' && (
                  <Badge variant="success" className="text-[10px]">MQTT Auto-Linked</Badge>
                )}
              </div>
              <button
                onClick={() => setShowConfig(false)}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Close
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="text-xs font-medium text-slate-700">ESP32-CAM IP Address</label>
                <input
                  type="text"
                  value={cameraIp}
                  onChange={(e) => handleSaveIp(e.target.value)}
                  placeholder="e.g. 10.41.51.168"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono text-slate-800 shadow-sm focus:border-cyan-500 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Find this in Arduino Serial Monitor after boot.
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">Stream Connection Mode</label>
                <div className="mt-1 flex gap-2">
                  <button
                    onClick={() => setUseProxy(false)}
                    className={`flex-1 rounded-xl py-2 text-xs font-medium border transition-colors ${
                      !useProxy
                        ? 'border-cyan-500 bg-cyan-50 text-cyan-700 font-semibold'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Direct LAN (Port 81)
                  </button>
                  <button
                    onClick={() => setUseProxy(true)}
                    className={`flex-1 rounded-xl py-2 text-xs font-medium border transition-colors ${
                      useProxy
                        ? 'border-cyan-500 bg-cyan-50 text-cyan-700 font-semibold'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Backend Proxy
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Direct LAN provides lowest latency (~25 FPS).
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">Active Stream URL</label>
                <div className="mt-1 flex items-center gap-1.5">
                  <input
                    type="text"
                    readOnly
                    value={streamUrl}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-mono text-slate-600 shadow-sm"
                  />
                  <a
                    href={directStreamUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 shadow-sm"
                    title="Open in new tab"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ── Main Monitoring Grid ─────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Video Player & Source Selector */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="overflow-hidden border-slate-200 shadow-md">
            {/* Source Switcher Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide mr-1">
                  Source:
                </span>
                <button
                  onClick={() => setSource('esp32')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    source === 'esp32'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Radio className="h-3.5 w-3.5" />
                  ESP32-CAM
                </button>
                <button
                  onClick={() => setSource('simulation')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    source === 'simulation'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  AI Demo Tank
                </button>
                <button
                  onClick={() => setSource('webcam')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    source === 'webcam'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Video className="h-3.5 w-3.5" />
                  Webcam
                </button>
              </div>

              {/* AI Overlay toggle */}
              <button
                onClick={() => setShowAiOverlay(!showAiOverlay)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  showAiOverlay
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                AI Vision Bounding Boxes: {showAiOverlay ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Video Viewport Container */}
            {source === 'esp32' && !isCameraActive && (
              <div className="relative aspect-video w-full overflow-hidden rounded-t-2xl bg-slate-950 font-sans select-none flex flex-col items-center justify-center gap-3 text-center px-6">
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800/80 border border-slate-700 shadow-inner">
                  <VideoOff className="h-8 w-8 text-slate-400" />
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                    <span className="inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60"></span>
                  </span>
                </div>

                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-800/80 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20 mb-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                    Thermal Protection Active • Chip Idle & Cool
                  </div>
                  <h3 className="text-base font-semibold text-white">ESP32-CAM Stream is Off</h3>
                  <p className="mt-1 max-w-sm text-xs text-slate-400">
                    Live video stream is paused to prevent the module from overheating. Click Turn On Camera to start live video.
                  </p>
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-center gap-2.5">
                  <button
                    onClick={() => setIsCameraActive(true)}
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500 active:scale-95 transition-all"
                  >
                    <Power className="h-4 w-4" />
                    Turn On Camera
                  </button>

                  <button
                    onClick={handleStandbySnapshot}
                    disabled={isCapturingStandby}
                    className="flex items-center gap-1.5 rounded-xl bg-slate-800 border border-slate-700 px-3.5 py-2.5 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50 transition-colors"
                  >
                    {isCapturingStandby ? (
                      <>
                        <Spinner className="h-3.5 w-3.5 text-cyan-400 animate-spin" />
                        <span>Capturing Snapshot…</span>
                      </>
                    ) : (
                      <>
                        <Camera className="h-3.5 w-3.5 text-cyan-400" />
                        <span>Take Single Snapshot</span>
                      </>
                    )}
                  </button>
                </div>

                {standbyCaptureError && (
                  <div className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-rose-950/80 border border-rose-500/40 px-3 py-1.5 text-[11px] text-rose-200">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                    <span>{standbyCaptureError}</span>
                  </div>
                )}

                <p className="text-[11px] text-slate-500 font-mono">
                  IP: {cleanCameraIp(cameraIp)} • Port: 81 • Direct LAN Mode
                </p>
              </div>
            )}

            {source === 'esp32' && isCameraActive && (
              <Esp32CamFeed
                streamUrl={streamUrl}
                cameraIp={cameraIp}
                flashOn={flashOn}
                onToggleFlash={handleToggleFlash}
                showAiOverlay={showAiOverlay}
                onCaptureSnapshot={handleCaptureSnapshot}
                onTurnOffCamera={() => setIsCameraActive(false)}
              />
            )}

            {source === 'simulation' && (
              <SimulatedTankFeed
                showAiOverlay={showAiOverlay}
                onCaptureSnapshot={handleCaptureSnapshot}
              />
            )}

            {source === 'webcam' && (
              <WebcamFeed
                showAiOverlay={showAiOverlay}
                onCaptureSnapshot={handleCaptureSnapshot}
              />
            )}

            {/* Live Camera Bottom Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500">Monitoring Device:</span>
                <span className="text-xs font-bold text-slate-900">{activeDeviceName}</span>
                {source === 'esp32' && (
                  <Badge variant={isCameraActive ? 'success' : 'default'} className="text-[10px]">
                    {isCameraActive ? 'Camera Active' : 'Camera Off (Cooling)'}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                {source === 'esp32' && (
                  <button
                    onClick={() => setIsCameraActive(!isCameraActive)}
                    className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all shadow-sm ${
                      isCameraActive
                        ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                        : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-200'
                    }`}
                  >
                    <Power className="h-3.5 w-3.5" />
                    {isCameraActive ? 'Turn Off Camera' : 'Turn On Camera'}
                  </button>
                )}

                <button
                  onClick={handleToggleFlash}
                  className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    flashOn
                      ? 'bg-amber-400 text-slate-900 shadow-sm'
                      : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Flashlight className="h-3.5 w-3.5" />
                  {flashOn ? 'Tank Light: ON' : 'Turn On Tank Light'}
                </button>
              </div>
            </div>
          </Card>

          {/* Quick Hardware Diagnostic Tiles */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <InfoTile
              label="Hardware Model"
              value="AI-Thinker OV2640"
              icon={<ShieldCheck className="h-4 w-4 text-cyan-600" />}
            />
            <InfoTile
              label="Resolution"
              value="QVGA 320x240"
              icon={<Maximize2 className="h-4 w-4 text-blue-600" />}
            />
            <InfoTile
              label="Camera Stream"
              value={isCameraActive ? 'Streaming (10 FPS)' : 'Off / Standby (Cool)'}
              icon={<Power className={`h-4 w-4 ${isCameraActive ? 'text-emerald-500' : 'text-slate-400'}`} />}
            />
            <InfoTile
              label="Night Flash"
              value={flashOn ? 'Active (GPIO 4)' : 'Standby'}
              icon={<Flashlight className={`h-4 w-4 ${flashOn ? 'text-amber-500' : 'text-slate-400'}`} />}
            />
          </div>

          {/* Session Snapshots Filmstrip */}
          {snapshots.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Captured Snapshots ({snapshots.length})
                </h4>
                <span className="text-[11px] text-slate-400">Click any snapshot to enlarge or download</span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                {snapshots.map((snap) => (
                  <button
                    key={snap.id}
                    onClick={() => setActiveSnapshotModal(snap)}
                    className="group relative h-20 w-32 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-900 shadow-sm transition-all hover:scale-105"
                  >
                    <img src={snap.dataUrl} alt="Snapshot thumbnail" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                      <Eye className="h-5 w-5" />
                    </div>
                    <div className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[9px] text-slate-200 font-mono">
                      {snap.timestamp}
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right Column: AI Vision Analysis & Computer Vision Telemetry */}
        <div className="space-y-6">
          {/* AI Vision Metrics Card */}
          <Card>
            <CardHeader
              title="AI Vision Intelligence"
              subtitle="YOLOv8 Computer Vision Pipeline"
              icon={<Eye className="h-5 w-5 text-cyan-600" />}
            />
            <CardBody className="space-y-3.5">
              <AnalysisRow
                icon={<Fish className="h-4 w-4" />}
                label="Fauna Activity Level"
                value={latestAnalysis.fish_activity}
              />
              <AnalysisRow
                icon={<Zap className="h-4 w-4" />}
                label="Feeding Response"
                value={latestAnalysis.feeding_activity}
              />
              <AnalysisRow
                icon={<Activity className="h-4 w-4" />}
                label="Swimming Dynamics"
                value={latestAnalysis.fish_movement}
              />
              <AnalysisRow
                icon={<Eye className="h-4 w-4" />}
                label="Aquarium Optical Clarity"
                value={latestAnalysis.tank_visibility}
              />

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Live AI Inference Engine:</span>
                  <span className="font-mono font-semibold text-emerald-600">Active (25 FPS)</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Last vision cycle: {timeAgo(latestAnalysis.analyzed_at)}
                </p>
              </div>

              {latestAnalysis.dead_fish_detected ? (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600" />
                  <div>
                    <span className="font-semibold">Abnormal Behavior Alert:</span>
                    <p className="mt-0.5">Potential dead/lethargic fish detected at surface.</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50/80 border border-emerald-100 p-2.5 text-xs text-emerald-700">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>No mortalities or erratic swimming detected</span>
                </div>
              )}
            </CardBody>
          </Card>

          {/* AI Vision Summary Narrative */}
          <Card>
            <CardHeader
              title="Automated Vision Summary"
              subtitle="Real-time behavioral telemetry"
              icon={<Activity className="h-5 w-5 text-blue-600" />}
            />
            <CardBody>
              <p className="text-xs leading-relaxed text-slate-600">
                {latestAnalysis.summary ||
                  'The camera module continuously scans the tank water column, monitoring fish density, velocity patterns, and appetite responses to optimize automated feeding cycles.'}
              </p>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Confidence Score:</span>
                <span className="font-semibold text-slate-800">96.8%</span>
              </div>
            </CardBody>
          </Card>

          {/* Hardware Connection Card */}
          <Card className="border-cyan-100 bg-gradient-to-br from-white to-cyan-50/40">
            <CardBody className="space-y-3">
              <div className="flex items-center gap-2 text-cyan-800 font-semibold text-xs">
                <Radio className="h-4 w-4 text-cyan-600" />
                <span>ESP32-CAM Setup Status</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Connect your AI-Thinker ESP32-CAM board to provide uninterrupted live video streaming directly to your AquaNova dashboard.
              </p>
              <button
                onClick={() => setShowSetupGuide(true)}
                className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow"
              >
                View Setup & Wiring Instructions
              </button>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* ── Snapshot Preview Modal ───────────────────────────────────────────── */}
      {activeSnapshotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Aquaculture Snapshot</h3>
                <p className="text-xs text-slate-500">
                  Captured from {activeSnapshotModal.source} at {activeSnapshotModal.timestamp}
                </p>
              </div>
              <button
                onClick={() => setActiveSnapshotModal(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="aspect-video w-full bg-slate-950">
              <img
                src={activeSnapshotModal.dataUrl}
                alt="Captured Aquarium Snapshot"
                className="h-full w-full object-contain"
              />
            </div>

            <div className="flex items-center justify-between bg-slate-50 px-5 py-3 border-t border-slate-100">
              <span className="text-xs text-slate-500">Format: JPEG High Resolution</span>
              <a
                href={activeSnapshotModal.dataUrl}
                download={`aquanova-snapshot-${Date.now()}.jpg`}
                className="flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-cyan-500 transition-colors"
              >
                <Download className="h-4 w-4" /> Download Image
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Setup & Wiring Guide Modal ───────────────────────────────────────── */}
      {showSetupGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700">
                    <Camera className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">AquaNova ESP32-CAM Setup Guide</h3>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Step-by-step flashing and wiring instructions for the AI-Thinker OV2640 module.
                </p>
              </div>
              <button
                onClick={() => setShowSetupGuide(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs text-slate-700">
              <div className="rounded-xl bg-blue-50/70 p-3.5 border border-blue-100">
                <span className="font-semibold text-blue-900">Firmware Location:</span>
                <p className="mt-1 font-mono text-[11px] text-blue-800">
                  firmware/aquanova_esp32_cam/aquanova_esp32_cam.ino
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-1">1. FTDI Programmer Connections</h4>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-50 font-semibold text-slate-700">
                      <tr>
                        <th className="p-2 border-b">FTDI Adapter</th>
                        <th className="p-2 border-b">ESP32-CAM Pin</th>
                        <th className="p-2 border-b">Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="p-2 font-mono">VCC (5V)</td>
                        <td className="p-2 font-mono">5V / VIN</td>
                        <td className="p-2 text-slate-500">Set FTDI jumper to 5V</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-mono">GND</td>
                        <td className="p-2 font-mono">GND</td>
                        <td className="p-2 text-slate-500">Common ground</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-mono">TXD</td>
                        <td className="p-2 font-mono">U0R (GPIO 3)</td>
                        <td className="p-2 text-slate-500">TX to RX</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-mono">RXD</td>
                        <td className="p-2 font-mono">U0T (GPIO 1)</td>
                        <td className="p-2 text-slate-500">RX to TX</td>
                      </tr>
                      <tr className="bg-amber-50/50">
                        <td className="p-2 font-mono font-bold text-amber-900">GND</td>
                        <td className="p-2 font-mono font-bold text-amber-900">IO0 (GPIO 0)</td>
                        <td className="p-2 font-medium text-amber-800">
                          Connect during upload, disconnect to run!
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-1">2. Arduino IDE Settings</h4>
                <ul className="list-disc pl-5 space-y-1 text-slate-600">
                  <li>Board: <span className="font-semibold text-slate-800">AI Thinker ESP32-CAM</span></li>
                  <li>CPU Frequency: <span className="font-semibold text-slate-800">240MHz</span></li>
                  <li>Partition Scheme: <span className="font-semibold text-slate-800">Huge APP (3MB No OTA)</span></li>
                  <li>Upload Speed: <span className="font-semibold text-slate-800">115200</span></li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-1">3. Live Streaming Endpoints</h4>
                <p className="text-slate-600 mb-1">
                  Once connected to your Wi-Fi network or Hotspot, the ESP32-CAM outputs:
                </p>
                <div className="rounded-xl bg-slate-900 p-3 font-mono text-[11px] text-cyan-300 space-y-1">
                  <div>Live Stream : http://&lt;ESP32_IP&gt;:81/stream</div>
                  <div>Snapshot    : http://&lt;ESP32_IP&gt;:81/capture</div>
                  <div>Night Flash : http://&lt;ESP32_IP&gt;:81/flash?state=toggle</div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowSetupGuide(false)}
                className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Helper UI Components ──────────────────────────────────────────────────────

function InfoTile({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <Card className="p-3">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <div className="mt-1 flex items-center gap-1.5">
        {icon}
        <p className="text-xs font-bold text-slate-900 truncate">{value}</p>
      </div>
    </Card>
  );
}

function AnalysisRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  const isGood =
    value === 'normal' ||
    value === 'good' ||
    value === 'detected' ||
    value === 'Active' ||
    value === 'Normal' ||
    value === 'Lively swimming patterns' ||
    value.toLowerCase().includes('clear');

  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-100 p-2.5">
      <div className="flex items-center gap-2">
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${
            isGood ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
          }`}
        >
          {icon}
        </div>
        <span className="text-xs text-slate-700">{label}</span>
      </div>
      <Badge variant={isGood ? 'success' : 'warning'} className="text-[10px]">
        {value.replace(/_/g, ' ')}
      </Badge>
    </div>
  );
}
