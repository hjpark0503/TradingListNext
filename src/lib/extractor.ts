'use client';

const COL_GAP_THRESHOLD = 15;

interface TextItem {
  str: string;
  transform: number[];
  width?: number;
}

interface PositionedItem {
  str: string;
  x: number;
  y: number;
  width: number;
}

function clusterPdfTextItemsToLines(items: TextItem[], yThreshold = 8): string[] {
  const positioned: PositionedItem[] = [];
  for (const it of items) {
    if (!it.str || it.str.trim() === '') continue;
    const tr = it.transform;
    positioned.push({ str: it.str, x: tr[4], y: tr[5], width: it.width || 0 });
  }
  positioned.sort((a, b) => {
    if (Math.abs(a.y - b.y) > yThreshold) return b.y - a.y;
    return a.x - b.x;
  });

  const lines: string[] = [];
  let bucket: PositionedItem[] = [];
  let bucketY: number | null = null;

  function bucketToLine(bkt: PositionedItem[]): string {
    bkt.sort((a, b) => a.x - b.x);
    let result = '';
    for (let k = 0; k < bkt.length; k++) {
      if (k === 0) {
        result += bkt[k].str;
      } else {
        const gap = bkt[k].x - (bkt[k - 1].x + bkt[k - 1].width);
        result += (gap > COL_GAP_THRESHOLD ? '\t' : ' ') + bkt[k].str;
      }
    }
    return result.replace(/ {2,}/g, ' ').trim();
  }

  for (const p of positioned) {
    if (bucketY === null || Math.abs(p.y - bucketY) <= yThreshold) {
      bucket.push(p);
      if (bucketY === null) bucketY = p.y;
    } else {
      lines.push(bucketToLine(bucket));
      bucket = [p];
      bucketY = p.y;
    }
  }
  if (bucket.length) lines.push(bucketToLine(bucket));
  return lines;
}

export async function extractLogicalLinesFromPdf(arrayBuffer: ArrayBuffer): Promise<string[]> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;
  const allLines: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const pageLines = clusterPdfTextItemsToLines(content.items as TextItem[], 8);
    allLines.push(...pageLines);
  }
  return allLines;
}

export function isLikelyImageOnlyPdf(lines: string[]): boolean {
  const joined = lines.join('').replace(/\s/g, '');
  if (joined.length < 40) return true;
  const unreadable = joined.replace(/[a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ.,\-+()%$/\\]/g, '');
  return unreadable.length / joined.length > 0.35;
}

export async function extractLogicalLinesViaOcr(
  arrayBuffer: ArrayBuffer,
  onStatus?: (msg: string) => void
): Promise<string[]> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

  const { createWorker } = await import('tesseract.js');

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;
  const allLines: string[] = [];

  const worker = await createWorker('kor+eng', 1, {
    workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
    langPath: 'https://tessdata.projectnaptha.com/4.0.0_best',
    corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1',
    logger: (m: { status: string; progress?: number }) => {
      if (!onStatus || !m.status) return;
      if (m.status === 'recognizing text' && m.progress != null) {
        onStatus(`글자 인식 중… ${Math.round(m.progress * 100)}%`);
      }
    },
  });

  try {
    for (let p = 1; p <= pdf.numPages; p++) {
      onStatus?.(`페이지 ${p} / ${pdf.numPages} OCR 중…`);
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 2.5 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (page.render as any)({ canvasContext: ctx, viewport }).promise;
      const result = await worker.recognize(canvas);
      const text = result.data?.text || '';
      text.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (trimmed) allLines.push(trimmed);
      });
    }
  } finally {
    await worker.terminate();
  }
  return allLines;
}
