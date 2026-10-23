import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Image as ImageIcon,
  RotateCw,
  FlipHorizontal,
  Download,
  Send,
  Sparkles,
  Layers,
  Check,
  Eye,
  Sliders,
  FileText
} from 'lucide-react';
import { LayoutSettings, OrientationMode, Language } from '../types.js';
import { translations } from '../locales.js';

interface CardStudioProps {
  settings: LayoutSettings;
  setSettings: React.Dispatch<React.SetStateAction<LayoutSettings>>;
  lang: Language;
  targetChatId: string;
}

export const CardStudio: React.FC<CardStudioProps> = ({
  settings,
  setSettings,
  lang,
  targetChatId
}) => {
  const t = translations[lang];

  // Images state
  const [frontUrl, setFrontUrl] = useState<string>('/assets/aistudio/sample_front.jpg');
  const [backUrl, setBackUrl] = useState<string>('/assets/aistudio/sample_back.jpg');
  const [orientation, setOrientation] = useState<OrientationMode>('normal');
  const [showGuides, setShowGuides] = useState<boolean>(true);

  // Status & loading
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frontInputRef = useRef<HTMLInputElement | null>(null);
  const backInputRef = useRef<HTMLInputElement | null>(null);

  // Load sample Ethiopian ID cards
  const handleLoadSample = () => {
    setFrontUrl('/assets/aistudio/sample_front.jpg');
    setBackUrl('/assets/aistudio/sample_back.jpg');
  };

  // Handle file uploads
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isFront: boolean) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          if (isFront) {
            setFrontUrl(event.target.result as string);
          } else {
            setBackUrl(event.target.result as string);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Render on HTML5 Canvas
  useEffect(() => {
    if (!frontUrl || !backUrl) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgFront = new Image();
    const imgBack = new Image();

    let loadedCount = 0;
    const onImgLoad = () => {
      loadedCount++;
      if (loadedCount === 2) {
        drawCanvas(ctx, canvas, imgFront, imgBack);
      }
    };

    imgFront.crossOrigin = 'anonymous';
    imgBack.crossOrigin = 'anonymous';

    imgFront.onload = onImgLoad;
    imgBack.onload = onImgLoad;

    imgFront.src = frontUrl;
    imgBack.src = backUrl;
  }, [frontUrl, backUrl, orientation, settings, showGuides]);

  const drawCanvas = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    imgFront: HTMLImageElement,
    imgBack: HTMLImageElement
  ) => {
    // 300 DPI calculations
    const dpi = settings.dpi || 300;
    const cardW = Math.round((settings.widthCm / 2.54) * dpi);
    const cardH = Math.round((settings.heightCm / 2.54) * dpi);

    const sideGap = settings.sideGapPx;
    const topMargin = settings.topMarginPx;
    const sideMargin = settings.sideMarginPx;

    const totalW = (cardW * 2) + sideGap + (sideMargin * 2);
    const totalH = cardH + (topMargin * 2);

    canvas.width = totalW;
    canvas.height = totalH;

    // Fill white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, totalW, totalH);

    const leftX = sideMargin;
    const leftY = topMargin;
    const rightX = leftX + cardW + sideGap;
    const rightY = topMargin;

    // Determine left and right cards based on orientation
    let leftImg = imgFront;
    let rightImg = imgBack;
    let shouldFlip = false;

    if (orientation === 'normal') {
      leftImg = imgFront;
      rightImg = imgBack;
      shouldFlip = false;
    } else if (orientation === 'reverse') {
      leftImg = imgBack;
      rightImg = imgFront;
      shouldFlip = false;
    } else if (orientation === 'flip_reverse') {
      leftImg = imgBack;
      rightImg = imgFront;
      shouldFlip = true;
    }

    // Function to draw an image, optionally flipped horizontally
    const drawCard = (img: HTMLImageElement, x: number, y: number, flip: boolean) => {
      ctx.save();
      if (flip) {
        ctx.translate(x + cardW, y);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, cardW, cardH);
      } else {
        ctx.drawImage(img, x, y, cardW, cardH);
      }
      ctx.restore();
    };

    drawCard(leftImg, leftX, leftY, shouldFlip);
    drawCard(rightImg, rightX, rightY, shouldFlip);

    // Optional cut guides and measurement labels
    if (showGuides) {
      ctx.save();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);

      // Border around left card
      ctx.strokeRect(leftX, leftY, cardW, cardH);
      // Border around right card
      ctx.strokeRect(rightX, rightY, cardW, cardH);

      // Label
      ctx.fillStyle = '#64748b';
      ctx.font = '24px sans-serif';
      ctx.setLineDash([]);
      
      const leftTag = orientation === 'normal' ? 'FRONT' : 'BACK';
      const rightTag = orientation === 'normal' ? 'BACK' : 'FRONT';
      const flipTag = shouldFlip ? ' [FLIPPED]' : '';

      ctx.fillText(`${leftTag}${flipTag} (${settings.widthCm} x ${settings.heightCm} cm)`, leftX + 15, leftY + cardH - 20);
      ctx.fillText(`${rightTag}${flipTag} (${settings.widthCm} x ${settings.heightCm} cm)`, rightX + 15, rightY + cardH - 20);
      ctx.restore();
    }
  };

  // Download High-Res JPG directly from canvas or server
  const handleDownloadJpg = async () => {
    setIsRendering(true);
    try {
      const res = await fetch('/api/render-layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frontBase64: frontUrl,
          backBase64: backUrl,
          orientation,
          format: 'JPG',
          widthCm: settings.widthCm,
          heightCm: settings.heightCm,
          sideGapPx: settings.sideGapPx,
          downGapPx: settings.downGapPx,
          topMarginPx: settings.topMarginPx,
          sideMarginPx: settings.sideMarginPx,
          dpi: settings.dpi,
          returnJson: 'true'
        })
      });
      const data = await res.json();
      if (data.ok && data.dataUrl) {
        const link = document.createElement('a');
        link.download = data.filename || `pub_1ids_${orientation}_300dpi.jpg`;
        link.href = data.dataUrl;
        link.click();
      } else {
        // Fallback to client canvas
        const canvas = canvasRef.current;
        if (canvas) {
          const a = document.createElement('a');
          a.download = `pub_1ids_${orientation}_300dpi.jpg`;
          a.href = canvas.toDataURL('image/jpeg', 0.98);
          a.click();
        }
      }
    } catch (err) {
      console.error(err);
      const canvas = canvasRef.current;
      if (canvas) {
        const a = document.createElement('a');
        a.download = `pub_1ids_${orientation}_300dpi.jpg`;
        a.href = canvas.toDataURL('image/jpeg', 0.98);
        a.click();
      }
    } finally {
      setIsRendering(false);
    }
  };

  // Download Print PDF
  const handleDownloadPdf = async () => {
    setIsRendering(true);
    try {
      const res = await fetch('/api/render-layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frontBase64: frontUrl,
          backBase64: backUrl,
          orientation,
          format: 'PDF',
          widthCm: settings.widthCm,
          heightCm: settings.heightCm,
          sideGapPx: settings.sideGapPx,
          downGapPx: settings.downGapPx,
          topMarginPx: settings.topMarginPx,
          sideMarginPx: settings.sideMarginPx,
          dpi: settings.dpi
        })
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pub_1ids_${orientation}_300dpi.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRendering(false);
    }
  };

  // Dispatch to Telegram
  const handleDispatchTelegram = async () => {
    setIsRendering(true);
    setDispatchStatus(null);
    try {
      const res = await fetch('/api/bot/dispatch-to-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: targetChatId,
          frontBase64: frontUrl,
          backBase64: backUrl,
          orientation,
          format: settings.format,
          widthCm: settings.widthCm,
          heightCm: settings.heightCm,
          sideGapPx: settings.sideGapPx,
          downGapPx: settings.downGapPx,
          topMarginPx: settings.topMarginPx,
          sideMarginPx: settings.sideMarginPx,
          dpi: settings.dpi,
          quality: settings.quality || 78
        })
      });
      const data = await res.json();
      if (data.ok) {
        setDispatchStatus(`✅ Sent ${data.filename} (${data.sizeKb} KB) to Telegram Chat ${targetChatId}!`);
      } else {
        setDispatchStatus(`⚠️ ${data.error || 'Failed to dispatch'}`);
      }
    } catch (err: any) {
      setDispatchStatus(`❌ Error: ${err.message}`);
    } finally {
      setIsRendering(false);
      setTimeout(() => setDispatchStatus(null), 6000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Sample Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            {t.studioTab}
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            {lang === 'am'
              ? 'መታወቂያዎችን በማስገባት በኖርማል፣ በሪቨርስ ወይም በፍሊፕ+ሪቨርስ አቅጣጫ 300 DPI ጥራት ያለው ሌይአውት ያመንጩ'
              : 'Compose high-resolution 300 DPI layouts in Normal, Reverse, or Flip+Reverse orientations'}
          </p>
        </div>

        <button
          onClick={handleLoadSample}
          className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-medium transition cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{t.loadSampleId}</span>
        </button>
      </div>

      {/* Card Upload Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Front Card */}
        <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              {t.frontCard} (1/1)
            </span>
            <button
              onClick={() => frontInputRef.current?.click()}
              className="text-xs text-zinc-400 hover:text-white transition flex items-center gap-1 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              {t.changePhoto}
            </button>
            <input
              ref={frontInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileUpload(e, true)}
            />
          </div>

          <div
            onClick={() => frontInputRef.current?.click()}
            className="group relative aspect-[1.57/1] rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800 flex items-center justify-center cursor-pointer hover:border-emerald-500/50 transition"
          >
            {frontUrl ? (
              <img
                src={frontUrl}
                alt="Front Card"
                className="w-full h-full object-contain p-1"
              />
            ) : (
              <div className="text-center p-4">
                <ImageIcon className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-xs text-zinc-400">{t.uploadFront}</p>
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-xs font-medium text-white">
              {t.changePhoto}
            </div>
          </div>
        </div>

        {/* Back Card */}
        <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              {t.backCard} (1/1)
            </span>
            <button
              onClick={() => backInputRef.current?.click()}
              className="text-xs text-zinc-400 hover:text-white transition flex items-center gap-1 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              {t.changePhoto}
            </button>
            <input
              ref={backInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileUpload(e, false)}
            />
          </div>

          <div
            onClick={() => backInputRef.current?.click()}
            className="group relative aspect-[1.57/1] rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800 flex items-center justify-center cursor-pointer hover:border-cyan-500/50 transition"
          >
            {backUrl ? (
              <img
                src={backUrl}
                alt="Back Card"
                className="w-full h-full object-contain p-1"
              />
            ) : (
              <div className="text-center p-4">
                <ImageIcon className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-xs text-zinc-400">{t.uploadBack}</p>
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-xs font-medium text-white">
              {t.changePhoto}
            </div>
          </div>
        </div>
      </div>

      {/* Orientation Selector - Matching user screenshot 2 */}
      <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-3">
          {t.orientationTitle}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Normal */}
          <button
            onClick={() => setOrientation('normal')}
            className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
              orientation === 'normal'
                ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-lg shadow-emerald-950/30'
                : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-sm flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-400" />
                {t.normal}
              </span>
              {orientation === 'normal' && <Check className="w-4 h-4 text-emerald-400" />}
            </div>
            <p className="text-[11px] text-zinc-400">{t.normalDesc}</p>
          </button>

          {/* Reverse */}
          <button
            onClick={() => setOrientation('reverse')}
            className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
              orientation === 'reverse'
                ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-lg shadow-emerald-950/30'
                : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-sm flex items-center gap-1.5">
                <RotateCw className="w-4 h-4 text-cyan-400" />
                {t.reverse}
              </span>
              {orientation === 'reverse' && <Check className="w-4 h-4 text-emerald-400" />}
            </div>
            <p className="text-[11px] text-zinc-400">{t.reverseDesc}</p>
          </button>

          {/* Flip + Reverse */}
          <button
            onClick={() => setOrientation('flip_reverse')}
            className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
              orientation === 'flip_reverse'
                ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-lg shadow-emerald-950/30'
                : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-sm flex items-center gap-1.5">
                <FlipHorizontal className="w-4 h-4 text-amber-400" />
                {t.flipReverse}
              </span>
              {orientation === 'flip_reverse' && <Check className="w-4 h-4 text-emerald-400" />}
            </div>
            <p className="text-[11px] text-zinc-400">{t.flipReverseDesc}</p>
          </button>
        </div>
      </div>

      {/* Live Canvas Preview */}
      <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
              {lang === 'am' ? 'የቀጥታ ማሳያ (Live Preview)' : 'Live Composite Preview'}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
              {settings.widthCm} x {settings.heightCm} cm • Gap: {settings.sideGapPx}px • Top: {settings.topMarginPx}px
            </span>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showGuides}
                onChange={(e) => setShowGuides(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-800 text-emerald-500 focus:ring-0"
              />
              <span>{lang === 'am' ? 'የመቁረጫ መስመር አሳይ' : 'Cut Guides'}</span>
            </label>
            <span className="text-xs text-emerald-400 font-mono font-medium">
              300 DPI
            </span>
          </div>
        </div>

        {/* Canvas Display */}
        <div className="overflow-x-auto rounded-xl bg-zinc-950 p-4 border border-zinc-800/80 flex items-center justify-center min-h-[220px]">
          <canvas
            ref={canvasRef}
            className="max-h-[380px] w-auto max-w-full rounded shadow-2xl object-contain"
          />
        </div>
      </div>

      {/* Action Bar (Download & Dispatch to Telegram) */}
      <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadJpg}
              disabled={isRendering}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-lg shadow-emerald-950/40"
            >
              <Download className="w-4 h-4" />
              <span>{t.downloadJpg}</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={isRendering}
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 active:scale-95 disabled:opacity-50 text-zinc-200 border border-zinc-700 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{t.downloadPdf}</span>
            </button>
          </div>

          <button
            onClick={handleDispatchTelegram}
            disabled={isRendering}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-lg shadow-blue-950/40"
          >
            <Send className="w-4 h-4" />
            <span>{t.sendToTelegram}</span>
          </button>
        </div>

        {dispatchStatus && (
          <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-medium text-emerald-300 animate-fadeIn">
            {dispatchStatus}
          </div>
        )}
      </div>
    </div>
  );
};
