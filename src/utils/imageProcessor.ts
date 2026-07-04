import { ImageFile } from '../types';

export interface ProcessedResult {
  blob: Blob;
  width: number;
  height: number;
}

export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

export async function processImage(
  imageFile: ImageFile,
  backgroundFillColor: string = '#ffffff'
): Promise<ProcessedResult> {
  const img = await loadImage(imageFile.file);

  // Initialize source rect based on crop
  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;

  if (imageFile.cropRect) {
    sx = imageFile.cropRect.x;
    sy = imageFile.cropRect.y;
    sw = imageFile.cropRect.width;
    sh = imageFile.cropRect.height;
  }

  // Determine post-crop canvas size
  const dw = imageFile.targetWidth;
  const dh = imageFile.targetHeight;

  // Swap target dimensions if rotated 90 or 270 degrees
  const isRotated90or270 = imageFile.rotation === 90 || imageFile.rotation === 270;
  const canvasW = isRotated90or270 ? dh : dw;
  const canvasH = isRotated90or270 ? dw : dh;

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get 2D canvas context');
  }

  // Disable smoothing for sharp conversions/resizing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 1. Apply Transformations (Translate to center, Rotate, Flip, Draw)
  //    Draw onto a transparent canvas first; the background fill is composited
  //    behind it afterwards (step 2).
  ctx.save();
  ctx.translate(canvasW / 2, canvasH / 2);

  // Apply Rotation
  if (imageFile.rotation !== 0) {
    ctx.rotate((imageFile.rotation * Math.PI) / 180);
  }

  // Apply Flips
  const scaleX = imageFile.flipH ? -1 : 1;
  const scaleY = imageFile.flipV ? -1 : 1;
  if (imageFile.flipH || imageFile.flipV) {
    ctx.scale(scaleX, scaleY);
  }

  // Draw scaled image centered at origin (using post-crop width dw and height dh)
  ctx.drawImage(img, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();

  // 2. Composite the background fill BEHIND the drawn image.
  //    Using 'destination-over' means the fill only appears where the canvas is
  //    transparent, so transparent source areas take the fill color (or stay
  //    transparent for alpha formats when opacity is 0).
  const noAlphaFormat = imageFile.targetFormat === 'jpeg' || imageFile.targetFormat === 'bmp';
  let bgFillStyle: string | null = null;

  if (noAlphaFormat) {
    // JPEG/BMP cannot store transparency; always flatten onto a solid color.
    bgFillStyle = backgroundFillColor;
  } else {
    const opacity = imageFile.bgOpacity !== undefined ? imageFile.bgOpacity : 100;
    if (opacity > 0) {
      const r = parseInt(backgroundFillColor.slice(1, 3), 16);
      const g = parseInt(backgroundFillColor.slice(3, 5), 16);
      const b = parseInt(backgroundFillColor.slice(5, 7), 16);
      bgFillStyle = `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
    }
  }

  if (bgFillStyle) {
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = bgFillStyle;
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.globalCompositeOperation = 'source-over';
  }

  // If SVG wrapper is requested, wrap canvas data directly
  if (imageFile.targetFormat === 'svg') {
    const dataUrl = canvas.toDataURL('image/png');
    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}">
  <image width="${canvasW}" height="${canvasH}" xlink:href="${dataUrl}" />
</svg>`;
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    return {
      blob,
      width: canvasW,
      height: canvasH,
    };
  }

  // Determine export MIME type
  let mimeType = 'image/png';
  if (imageFile.targetFormat === 'jpeg') mimeType = 'image/jpeg';
  else if (imageFile.targetFormat === 'webp') mimeType = 'image/webp';
  else if (imageFile.targetFormat === 'bmp') mimeType = 'image/bmp';
  else if (imageFile.targetFormat === 'gif') mimeType = 'image/gif';
  else if (imageFile.targetFormat === 'ico') mimeType = 'image/png'; // PNG embedded inside ICO is browser standard

  // Convert to Blob (with quality parameter if applicable)
  const quality = imageFile.targetQuality / 100;
  
  const blob = await new Promise<Blob>((resolve, reject) => {
    if (imageFile.targetFormat === 'jpeg' || imageFile.targetFormat === 'webp') {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error('Canvas toBlob returned null'));
        },
        mimeType,
        quality
      );
    } else {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error('Canvas toBlob returned null'));
        },
        mimeType
      );
    }
  });

  return {
    blob,
    width: canvasW,
    height: canvasH,
  };
}
