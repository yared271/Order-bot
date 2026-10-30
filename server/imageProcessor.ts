import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { LayoutSettings, OrientationMode } from './types.js';
import { extractNameFromCard } from './nameExtractor.js';

export const DEFAULT_LAYOUT_SETTINGS: LayoutSettings = {
  mode: 'DEFAULT',
  widthCm: 8.95,
  heightCm: 5.70,
  sideGapPx: 54,
  downGapPx: 27,
  downGapLevel: 4,
  topMarginPx: 15,
  sideMarginPx: 20,
  format: 'PDF',
  dpi: 300,
  quality: 78
};

export const GAP_LEVELS: Record<number, number> = {
  1: 0,
  2: 10,
  3: 18,
  4: 27
};

export function cmToPx(cm: number, dpi = 300): number {
  return Math.round((cm / 2.54) * dpi);
}

/**
 * Intelligent Ethiopian ID Card analyzer:
 * Automatically detects whether an image is FRONT or BACK.
 * - BACK side has a massive square QR code covering ~40% of the right half, and NO Ethiopian flag.
 * - FRONT side has the Ethiopian flag (green, yellow, red stripe) in top-left and portrait photo.
 */
export async function detectCardSide(buffer: Buffer): Promise<'front' | 'back'> {
  try {
    const { data, info } = await sharp(buffer)
      .resize(300, 200, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info;

    // 1. Check right-half QR code density
    let qrDarkPixels = 0;
    let qrTotalSampled = 0;
    for (let y = Math.floor(height * 0.2); y < Math.floor(height * 0.85); y++) {
      for (let x = Math.floor(width * 0.52); x < Math.floor(width * 0.96); x++) {
        const idx = (y * width + x) * channels;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (lum < 75) qrDarkPixels++;
        qrTotalSampled++;
      }
    }
    const qrDarkRatio = qrDarkPixels / qrTotalSampled;

    // 2. Check top-left flag colors (Red stripe)
    let redFlagPixels = 0;
    for (let y = Math.floor(height * 0.05); y < Math.floor(height * 0.25); y++) {
      for (let x = Math.floor(width * 0.03); x < Math.floor(width * 0.28); x++) {
        const idx = (y * width + x) * channels;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        if (r > 130 && g < 90 && b < 90) redFlagPixels++;
      }
    }

    if (qrDarkRatio > 0.11 && redFlagPixels < 30) {
      return 'back';
    }
    return 'front';
  } catch (e) {
    return 'front';
  }
}

export async function processCardPair({
  frontBuffer,
  backBuffer,
  orientation,
  settings = DEFAULT_LAYOUT_SETTINGS
}: {
  frontBuffer: Buffer;
  backBuffer: Buffer;
  orientation: OrientationMode;
  settings?: LayoutSettings;
}): Promise<{ buffer: Buffer; mime: string; filename: string }> {
  // Auto-detect and ensure front is FRONT and back is BACK
  const side1 = await detectCardSide(frontBuffer);
  const side2 = await detectCardSide(backBuffer);
  let actualFront = frontBuffer;
  let actualBack = backBuffer;

  if (side1 === 'back' && side2 === 'front') {
    actualFront = backBuffer;
    actualBack = frontBuffer;
  }

  const cardW = cmToPx(settings.widthCm, settings.dpi);
  const cardH = cmToPx(settings.heightCm, settings.dpi);

  const sideGap = settings.sideGapPx;
  const topMargin = settings.topMarginPx;
  const sideMargin = settings.sideMarginPx;

  const canvasW = (cardW * 2) + sideGap + (sideMargin * 2);
  const canvasH = cardH + (topMargin * 2);

  let leftBuffer: Buffer;
  let rightBuffer: Buffer;

  if (orientation === 'normal') {
    leftBuffer = await sharp(actualFront)
      .resize(cardW, cardH, { fit: 'fill' })
      .toBuffer();
    rightBuffer = await sharp(actualBack)
      .resize(cardW, cardH, { fit: 'fill' })
      .toBuffer();
  } else if (orientation === 'reverse') {
    leftBuffer = await sharp(actualBack)
      .resize(cardW, cardH, { fit: 'fill' })
      .toBuffer();
    rightBuffer = await sharp(actualFront)
      .resize(cardW, cardH, { fit: 'fill' })
      .toBuffer();
  } else {
    // flip_reverse: horizontally mirror (.flop()) both cards, and swap sides
    leftBuffer = await sharp(actualBack)
      .resize(cardW, cardH, { fit: 'fill' })
      .flop()
      .toBuffer();
    rightBuffer = await sharp(actualFront)
      .resize(cardW, cardH, { fit: 'fill' })
      .flop()
      .toBuffer();
  }

  const leftX = sideMargin;
  const rightX = leftX + cardW + sideGap;

  const jpgBuffer = await sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })
    .composite([
      { input: leftBuffer, top: topMargin, left: leftX },
      { input: rightBuffer, top: topMargin, left: rightX }
    ])
    .jpeg({ quality: settings.quality || 78, mozjpeg: true })
    .toBuffer();

  const timestamp = Date.now();
  let baseFilename = `pub_1ids_${orientation}_${timestamp}`;

  // Automatically read English Full Name (First + Father + Grandfather) from Front ID card
  try {
    const personName = await extractNameFromCard(actualFront);
    if (personName && personName.length > 2) {
      baseFilename = `${personName}`;
    }
  } catch (e) {
    // Keep fallback baseFilename
  }

  if (settings.format === 'PDF') {
    const pdfDoc = await PDFDocument.create();
    const jpgImage = await pdfDoc.embedJpg(jpgBuffer);

    const ptWidth = (canvasW / settings.dpi) * 72;
    const ptHeight = (canvasH / settings.dpi) * 72;

    const page = pdfDoc.addPage([ptWidth, ptHeight]);
    page.drawImage(jpgImage, {
      x: 0,
      y: 0,
      width: ptWidth,
      height: ptHeight
    });

    const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
    return {
      buffer: Buffer.from(pdfBytes),
      mime: 'application/pdf',
      filename: `${baseFilename}.pdf`
    };
  }

  return {
    buffer: jpgBuffer,
    mime: 'image/jpeg',
    filename: `${baseFilename}.jpg`
  };
}

export async function processBatchCards({
  fronts,
  backs,
  orientation,
  settings = DEFAULT_LAYOUT_SETTINGS
}: {
  fronts: Buffer[];
  backs: Buffer[];
  orientation: OrientationMode;
  settings?: LayoutSettings;
}): Promise<{ buffer: Buffer; mime: string; filename: string }> {
  const count = Math.min(fronts.length, backs.length);
  if (count <= 1) {
    return processCardPair({
      frontBuffer: fronts[0],
      backBuffer: backs[0],
      orientation,
      settings
    });
  }

  const cardW = cmToPx(settings.widthCm, settings.dpi);
  const cardH = cmToPx(settings.heightCm, settings.dpi);

  const canvasW = (cardW * 2) + settings.sideGapPx + (settings.sideMarginPx * 2);
  const canvasH = (count * cardH) + ((count - 1) * settings.downGapPx) + (settings.topMarginPx * 2);

  const compositeInputs: Array<{ input: Buffer; top: number; left: number }> = [];

  for (let i = 0; i < count; i++) {
    let curFront = fronts[i];
    let curBack = backs[i];

    // Auto-detect and swap if pair was inverted
    const s1 = await detectCardSide(curFront);
    const s2 = await detectCardSide(curBack);
    if (s1 === 'back' && s2 === 'front') {
      curFront = backs[i];
      curBack = fronts[i];
    }

    let leftBuf: Buffer;
    let rightBuf: Buffer;

    if (orientation === 'normal') {
      leftBuf = await sharp(curFront).resize(cardW, cardH, { fit: 'fill' }).toBuffer();
      rightBuf = await sharp(curBack).resize(cardW, cardH, { fit: 'fill' }).toBuffer();
    } else if (orientation === 'reverse') {
      leftBuf = await sharp(curBack).resize(cardW, cardH, { fit: 'fill' }).toBuffer();
      rightBuf = await sharp(curFront).resize(cardW, cardH, { fit: 'fill' }).toBuffer();
    } else {
      leftBuf = await sharp(curBack).resize(cardW, cardH, { fit: 'fill' }).flop().toBuffer();
      rightBuf = await sharp(curFront).resize(cardW, cardH, { fit: 'fill' }).flop().toBuffer();
    }

    const currentY = settings.topMarginPx + (i * (cardH + settings.downGapPx));
    const leftX = settings.sideMarginPx;
    const rightX = leftX + cardW + settings.sideGapPx;

    compositeInputs.push({ input: leftBuf, top: currentY, left: leftX });
    compositeInputs.push({ input: rightBuf, top: currentY, left: rightX });
  }

  const jpgBuffer = await sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })
    .composite(compositeInputs)
    .jpeg({ quality: settings.quality || 78, mozjpeg: true })
    .toBuffer();

  const timestamp = Date.now();
  let baseFilename = `pub_${count}ids_${orientation}_${timestamp}`;

  // Automatically read English Full Name from first Front ID card
  try {
    const personName = await extractNameFromCard(fronts[0]);
    if (personName && personName.length > 2) {
      baseFilename = count === 1 ? `${personName}` : `${personName}_and_${count - 1}_others`;
    }
  } catch (e) {
    // Keep fallback baseFilename
  }

  if (settings.format === 'PDF') {
    const pdfDoc = await PDFDocument.create();
    const jpgImage = await pdfDoc.embedJpg(jpgBuffer);

    const ptWidth = (canvasW / settings.dpi) * 72;
    const ptHeight = (canvasH / settings.dpi) * 72;

    const page = pdfDoc.addPage([ptWidth, ptHeight]);
    page.drawImage(jpgImage, {
      x: 0,
      y: 0,
      width: ptWidth,
      height: ptHeight
    });

    const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
    return {
      buffer: Buffer.from(pdfBytes),
      mime: 'application/pdf',
      filename: `${baseFilename}.pdf`
    };
  }

  return {
    buffer: jpgBuffer,
    mime: 'image/jpeg',
    filename: `${baseFilename}.jpg`
  };
}
