import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ImageFile, Rect } from '../types';
import { parseImageMetadata, ParsedMetadata } from '../utils/metadata';
import { processImage, loadImage } from '../utils/imageProcessor';
import { createZip } from '../utils/zip';

// Tool definitions for the workspace switcher
const TABS = [
  { id: 'transform', label: 'Transform' },
  { id: 'crop', label: 'Crop' },
  { id: 'metadata', label: 'EXIF' },
];

const FORMAT_OPTIONS = [
  { value: 'png', label: 'PNG (Lossless)' },
  { value: 'jpeg', label: 'JPEG (Compressed)' },
  { value: 'webp', label: 'WebP (Optimized)' },
  { value: 'svg', label: 'SVG (Vector Wrapper)' },
  { value: 'bmp', label: 'BMP (Raw)' },
  { value: 'ico', label: 'ICO (Favicon)' },
  { value: 'gif', label: 'GIF (Static Frame)' },
];

// Inline icon for each tool
function ToolIcon({ id }: { id: string }) {
  const common = {
    width: 15,
    height: 15,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (id) {
    case 'transform':
      return (
        <svg {...common}>
          <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
        </svg>
      );
    case 'crop':
      return (
        <svg {...common}>
          <path d="M6.13 1L6 16a2 2 0 0 0 2 2h15" />
          <path d="M1 6.13L16 6a2 2 0 0 1 2 2v15" />
        </svg>
      );
    case 'metadata':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      );
    default:
      return null;
  }
}

export default function ImageToolkit() {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<string>('transform');
  const [backgroundFill, setBackgroundFill] = useState<string>('#ffffff');
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [parsedMeta, setParsedMeta] = useState<ParsedMetadata | null>(null);

  // Format Dropdown State
  const [isFormatDropdownOpen, setIsFormatDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Crop State
  const [cropRect, setCropRect] = useState<Rect | null>(null);
  const [cropAspectRatio, setCropAspectRatio] = useState<string>('free'); // 'free', '1:1', '16:9', '4:3'
  const [cropLayout, setCropLayout] = useState<{ imgW: number; imgH: number; offX: number; offY: number } | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const cropImgRef = useRef<HTMLImageElement>(null);
  const cropBoxRef = useRef<HTMLDivElement>(null);
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const [isResizingCrop, setIsResizingCrop] = useState<string | null>(null); // 'nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w'
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialCropRect, setInitialCropRect] = useState<Rect | null>(null);
  const [aspectRatioLocked, setAspectRatioLocked] = useState(true);

  const selectedImage = images.find(img => img.id === selectedId) || null;

  // Add files helper for Single image editor
  const handleAddFiles = useCallback(async (fileList: FileList) => {
    const newImages: ImageFile[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file.type.startsWith('image/')) continue;

      const id = Math.random().toString(36).substring(2, 9);
      const previewUrl = URL.createObjectURL(file);
      
      let originalWidth = 0;
      let originalHeight = 0;
      try {
        const img = await loadImage(file);
        originalWidth = img.naturalWidth;
        originalHeight = img.naturalHeight;
      } catch (err) {
        console.error('Failed to load image file dimensions:', err);
      }

      let initialFormat: 'png' | 'jpeg' | 'webp' | 'bmp' | 'ico' | 'gif' | 'svg' = 'png';
      if (file.type === 'image/jpeg' || file.type === 'image/jpg') initialFormat = 'jpeg';
      else if (file.type === 'image/webp') initialFormat = 'webp';
      else if (file.type === 'image/svg+xml') initialFormat = 'svg';
      else if (file.type === 'image/bmp') initialFormat = 'bmp';
      else if (file.type === 'image/gif') initialFormat = 'gif';

      newImages.push({
        id,
        file,
        name: file.name,
        size: file.size,
        previewUrl,
        originalWidth,
        originalHeight,
        targetWidth: originalWidth,
        targetHeight: originalHeight,
        targetFormat: initialFormat,
        targetQuality: 90,
        rotation: 0,
        flipH: false,
        flipV: false,
        cropRect: null,
        convertedBlob: null,
        convertedSize: null,
        status: 'pending',
        metadata: null,
      });
    }

    setImages(prev => {
      const updated = [...prev, ...newImages];
      if (updated.length > 0 && !selectedId) {
        setSelectedId(updated[0].id);
      }
      return updated;
    });
  }, [selectedId]);

  // Load and parse EXIF/metadata when selection changes
  useEffect(() => {
    if (selectedImage) {
      setParsedMeta(null);
      parseImageMetadata(selectedImage.file).then(meta => {
        setParsedMeta(meta);
      });
      setCropRect(selectedImage.cropRect);
    } else {
      setParsedMeta(null);
      setCropRect(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, activeSubTab, selectedImage?.id]);

  // Handle clicking outside dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsFormatDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Drag & Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleAddFiles(e.dataTransfer.files);
    }
  };

  // Clipboard Paste Handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
        handleAddFiles(e.clipboardData.files);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleAddFiles]);

  const updateSelected = <K extends keyof ImageFile>(key: K, val: ImageFile[K]) => {
    if (!selectedId) return;
    setImages(prev =>
      prev.map(img => (img.id === selectedId ? { ...img, [key]: val, status: 'pending' as const } : img))
    );
  };

  // Dimensions locked changes
  const handleResizeChange = (dimension: 'w' | 'h', val: number) => {
    if (!selectedImage) return;
    
    const maxDimension = 16384;
    const cleanVal = Math.min(Math.max(1, isNaN(val) ? 1 : val), maxDimension);
    
    const originalRatio = selectedImage.cropRect
      ? selectedImage.cropRect.width / selectedImage.cropRect.height
      : selectedImage.originalWidth / selectedImage.originalHeight;

    setImages(prev =>
      prev.map(img => {
        if (img.id !== selectedId) return img;
        if (dimension === 'w') {
          const nextHeight = aspectRatioLocked ? Math.round(cleanVal / originalRatio) : img.targetHeight;
          return { ...img, targetWidth: cleanVal, targetHeight: nextHeight, status: 'pending' };
        } else {
          const nextWidth = aspectRatioLocked ? Math.round(cleanVal * originalRatio) : img.targetWidth;
          return { ...img, targetHeight: cleanVal, targetWidth: nextWidth, status: 'pending' };
        }
      })
    );
  };

  const handleRotate = (dir: 'left' | 'right') => {
    if (!selectedImage) return;
    let nextRotation = selectedImage.rotation + (dir === 'left' ? -90 : 90);
    if (nextRotation < 0) nextRotation += 360;
    if (nextRotation >= 360) nextRotation -= 360;
    updateSelected('rotation', nextRotation);
  };

  // Process a single image
  const convertImage = async (img: ImageFile, fillBgColor: string = '#ffffff'): Promise<ImageFile> => {
    try {
      const result = await processImage(img, fillBgColor);
      return {
        ...img,
        convertedBlob: result.blob,
        convertedSize: result.blob.size,
        status: 'done',
      };
    } catch (err) {
      console.error(`Error processing image ${img.name}:`, err);
      return {
        ...img,
        status: 'error',
        error: err instanceof Error ? err.message : 'Processing failed',
      };
    }
  };

  // Run conversion for currently selected image and trigger download
  const handleDownloadSelected = async () => {
    if (!selectedImage) return;
    updateSelected('status', 'processing');
    
    const processed = await convertImage(selectedImage, backgroundFill);
    setImages(prev => prev.map(img => (img.id === processed.id ? processed : img)));

    if (processed.convertedBlob) {
      downloadBlob(processed.convertedBlob, getExportFilename(processed));
    }
  };

  // Process all Editor images sequentially and download Zip
  const handleConvertAll = async () => {
    if (images.length === 0) return;
    setIsProcessingAll(true);

    const updatedImages = [...images];
    const filesToZip: { name: string; blob: Blob }[] = [];

    for (let i = 0; i < updatedImages.length; i++) {
      updatedImages[i] = { ...updatedImages[i], status: 'processing' };
      setImages([...updatedImages]);

      const processed = await convertImage(updatedImages[i], backgroundFill);
      updatedImages[i] = processed;
      setImages([...updatedImages]);

      await new Promise(resolve => setTimeout(resolve, 50));

      if (processed.convertedBlob) {
        filesToZip.push({
          name: getExportFilename(processed),
          blob: processed.convertedBlob,
        });
      }
    }

    if (filesToZip.length > 0) {
      try {
        const zipBlob = await createZip(filesToZip);
        downloadBlob(zipBlob, 'DevTools-Batch-Export.zip');
      } catch (err) {
        console.error('Failed to create batch export ZIP file:', err);
      }
    }

    setIsProcessingAll(false);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getExportFilename = (img: ImageFile): string => {
    const dotIndex = img.name.lastIndexOf('.');
    const baseName = dotIndex !== -1 ? img.name.slice(0, dotIndex) : img.name;
    return `${baseName}-converted.${img.targetFormat}`;
  };

  const removeImage = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setImages(prev => {
      const filtered = prev.filter(img => img.id !== id);
      if (selectedId === id) {
        setSelectedId(filtered.length > 0 ? filtered[0].id : null);
      }
      return filtered;
    });
    const img = images.find(i => i.id === id);
    if (img) URL.revokeObjectURL(img.previewUrl);
  };

  const clearAll = () => {
    images.forEach(img => URL.revokeObjectURL(img.previewUrl));
    setImages([]);
    setSelectedId(null);
  };

  // Crop Dragger Logic
  const handleCropMouseDown = (e: React.MouseEvent | React.TouchEvent, type: string | null) => {
    // Only mouse events can preventDefault here; React registers touch
    // listeners as passive, so calling preventDefault on a touch event throws
    // a console warning. Scroll prevention for touch is handled by the
    // non-passive window 'touchmove' listener instead.
    if (!('touches' in e)) e.preventDefault();
    if (!selectedImage) return;

    const bounds = imageContainerRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const point = 'touches' in e ? e.touches[0] : e;
    const start = { x: point.clientX, y: point.clientY };

    if (type === 'drag') {
      setIsDraggingCrop(true);
      setDragStart(start);
      setInitialCropRect(cropRect || { x: 0, y: 0, width: selectedImage.originalWidth, height: selectedImage.originalHeight });
    } else if (type) {
      setIsResizingCrop(type);
      setDragStart(start);
      setInitialCropRect(cropRect || { x: 0, y: 0, width: selectedImage.originalWidth, height: selectedImage.originalHeight });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!selectedImage || !initialCropRect || !cropLayout) return;

      const point = 'touches' in e ? e.touches[0] : e;
      if (!point) return;
      // Prevent page scroll while dragging the crop box on touch devices
      if ('touches' in e && e.cancelable) e.preventDefault();

      // Scale from rendered (displayed) image size to original pixel space.
      const scaleX = selectedImage.originalWidth / cropLayout.imgW;
      const scaleY = selectedImage.originalHeight / cropLayout.imgH;

      const dx = (point.clientX - dragStart.x) * scaleX;
      const dy = (point.clientY - dragStart.y) * scaleY;

      if (isDraggingCrop) {
        let nextX = initialCropRect.x + dx;
        let nextY = initialCropRect.y + dy;

        if (nextX < 0) nextX = 0;
        if (nextY < 0) nextY = 0;
        if (nextX + initialCropRect.width > selectedImage.originalWidth) {
          nextX = selectedImage.originalWidth - initialCropRect.width;
        }
        if (nextY + initialCropRect.height > selectedImage.originalHeight) {
          nextY = selectedImage.originalHeight - initialCropRect.height;
        }

        setCropRect({ ...initialCropRect, x: Math.round(nextX), y: Math.round(nextY) });
      } else if (isResizingCrop) {
        let { x, y, width, height } = initialCropRect;

        if (isResizingCrop.includes('e')) {
          width = Math.max(10, width + dx);
          if (x + width > selectedImage.originalWidth) width = selectedImage.originalWidth - x;
        }
        if (isResizingCrop.includes('s')) {
          height = Math.max(10, height + dy);
          if (y + height > selectedImage.originalHeight) height = selectedImage.originalHeight - y;
        }
        if (isResizingCrop.includes('w')) {
          const possibleWidth = width - dx;
          if (possibleWidth > 10) {
            const nextX = x + dx;
            if (nextX >= 0) {
              x = nextX;
              width = possibleWidth;
            }
          }
        }
        if (isResizingCrop.includes('n')) {
          const possibleHeight = height - dy;
          if (possibleHeight > 10) {
            const nextY = y + dy;
            if (nextY >= 0) {
              y = nextY;
              height = possibleHeight;
            }
          }
        }

        if (cropAspectRatio !== 'free') {
          let ratio = 1;
          if (cropAspectRatio === '1:1') ratio = 1;
          else if (cropAspectRatio === '16:9') ratio = 16 / 9;
          else if (cropAspectRatio === '4:3') ratio = 4 / 3;

          if (isResizingCrop.includes('e') || isResizingCrop.includes('w')) {
            height = width / ratio;
          } else {
            width = height * ratio;
          }
        }

        setCropRect({
          x: Math.round(x),
          y: Math.round(y),
          width: Math.round(width),
          height: Math.round(height),
        });
      }
    };

    const handleMouseUp = () => {
      setIsDraggingCrop(false);
      setIsResizingCrop(null);
    };

    if (isDraggingCrop || isResizingCrop) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleMouseMove, { passive: false });
      window.addEventListener('touchend', handleMouseUp);
      window.addEventListener('touchcancel', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
      window.removeEventListener('touchcancel', handleMouseUp);
    };
  }, [isDraggingCrop, isResizingCrop, dragStart, initialCropRect, selectedImage, cropAspectRatio, cropLayout]);

  // Measure the rendered image so the crop overlay can be positioned from state
  // (reading the ref during render is unreliable — refs attach after commit).
  const measureCropLayout = useCallback(() => {
    const container = imageContainerRef.current;
    const imgEl = cropImgRef.current;
    if (!container || !imgEl) return;
    const imgW = imgEl.clientWidth;
    const imgH = imgEl.clientHeight;
    if (imgW === 0 || imgH === 0) return;
    setCropLayout({
      imgW,
      imgH,
      offX: (container.clientWidth - imgW) / 2,
      offY: (container.clientHeight - imgH) / 2,
    });
  }, []);

  // Keep the crop layout in sync while the crop tool is active (mount, image
  // change, tab switch, container/viewport resize).
  useEffect(() => {
    if (activeSubTab !== 'crop' || !selectedImage) {
      setCropLayout(null);
      return;
    }

    const raf = requestAnimationFrame(measureCropLayout);
    const onResize = () => measureCropLayout();
    window.addEventListener('resize', onResize);

    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined' && imageContainerRef.current) {
      observer = new ResizeObserver(() => measureCropLayout());
      observer.observe(imageContainerRef.current);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      observer?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubTab, selectedImage?.id, selectedImage?.previewUrl, measureCropLayout]);

  // Ensure a crop rectangle exists whenever the crop tool is active so the
  // selection overlay is always visible and adjustable. Start with a centered
  // inset region so the box sits inside the frame and all resize handles
  // (corners + edges) are visible rather than clipped at the image edges.
  useEffect(() => {
    if (activeSubTab === 'crop' && selectedImage && !cropRect) {
      const width = Math.round(selectedImage.originalWidth * 0.8);
      const height = Math.round(selectedImage.originalHeight * 0.8);
      setCropRect({
        x: Math.round((selectedImage.originalWidth - width) / 2),
        y: Math.round((selectedImage.originalHeight - height) / 2),
        width,
        height,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubTab, selectedImage?.id, cropRect]);

  const applyCrop = () => {
    if (!selectedImage || !cropRect) return;
    
    setImages(prev =>
      prev.map(img =>
        img.id === selectedId
          ? {
              ...img,
              cropRect,
              targetWidth: cropRect.width,
              targetHeight: cropRect.height,
              status: 'pending',
            }
          : img
      )
    );
  };

  const resetCrop = () => {
    if (!selectedImage) return;
    setCropRect(null);
    setImages(prev =>
      prev.map(img =>
        img.id === selectedId
          ? {
              ...img,
              cropRect: null,
              targetWidth: img.originalWidth,
              targetHeight: img.originalHeight,
              status: 'pending',
            }
          : img
      )
    );
  };

  // Convert bytes helper
  const renderSize = (bytes: number | null) => {
    if (bytes === null) return '—';
    return (bytes / 1024).toFixed(1) + ' KB';
  };

  const renderSavings = (img: ImageFile) => {
    if (!img.convertedSize) return null;
    const diff = img.size - img.convertedSize;
    const pct = ((diff / img.size) * 100).toFixed(0);
    if (diff <= 0) return <span className="text-text-muted">No saving</span>;
    return <span className="text-ok font-bold">-{pct}%</span>;
  };

  const hasFilesLoaded = images.length > 0;

  // ── Reusable UI fragments ──────────────────────────────────
  const sectionLabel = 'text-[9px] font-bold text-text-tertiary uppercase tracking-[0.15em]';
  const cardClass = 'rounded-xl border border-border-subtle bg-bg-primary/60 p-3.5';

  const exportSettings = selectedImage && (
    <div className={`${cardClass} space-y-4`}>
      <span className={sectionLabel}>Export</span>

      <div>
        <label className="block text-[9px] font-semibold text-text-secondary uppercase tracking-widest mb-1.5">Format</label>
        <div ref={dropdownRef} className="relative w-full">
          <button
            type="button"
            onClick={() => setIsFormatDropdownOpen(prev => !prev)}
            className="w-full flex items-center justify-between bg-bg-base border border-border-subtle hover:border-accent/60 rounded-lg px-2.5 py-2 text-[10px] font-semibold uppercase tracking-widest outline-none cursor-pointer text-left text-text-primary transition-colors"
          >
            <span>
              {FORMAT_OPTIONS.find(opt => opt.value === selectedImage.targetFormat)?.label || selectedImage.targetFormat.toUpperCase()}
            </span>
            <svg
              className={`w-3 h-3 text-text-tertiary transition-transform duration-200 ${isFormatDropdownOpen ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isFormatDropdownOpen && (
            <div className="absolute z-[100] left-0 right-0 mt-1.5 bg-bg-secondary border border-border-default rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.7)] overflow-hidden py-1 max-h-[180px] overflow-y-auto custom-scrollbar animate-fade-in">
              {FORMAT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    updateSelected('targetFormat', opt.value as 'png' | 'jpeg' | 'webp' | 'bmp' | 'ico' | 'gif' | 'svg');
                    setIsFormatDropdownOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-wider transition-colors
                    ${selectedImage.targetFormat === opt.value
                      ? 'bg-accent text-on-accent'
                      : 'text-text-secondary hover:bg-text-primary/[0.04] hover:text-text-primary'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {(selectedImage.targetFormat === 'jpeg' || selectedImage.targetFormat === 'webp') && (
        <div>
          <div className="flex justify-between text-[9px] font-semibold text-text-secondary uppercase tracking-widest mb-2">
            <span>Quality</span>
            <span className="text-accent-ink font-mono">{selectedImage.targetQuality}%</span>
          </div>
          <input
            type="range"
            min="10"
            max="100"
            value={selectedImage.targetQuality}
            onChange={(e) => updateSelected('targetQuality', parseInt(e.target.value))}
            className="w-full accent-accent"
          />
        </div>
      )}

      <div>
        <label className="block text-[9px] font-semibold text-text-secondary uppercase tracking-widest mb-1.5">Background Fill</label>
        <div className="flex gap-2">
          <input
            type="color"
            value={backgroundFill}
            onChange={(e) => setBackgroundFill(e.target.value)}
            className="w-9 h-8 rounded-lg border border-border-subtle bg-transparent cursor-pointer p-0"
          />
          <input
            type="text"
            value={backgroundFill.toUpperCase()}
            onChange={(e) => setBackgroundFill(e.target.value)}
            className="flex-1 bg-bg-base border border-border-subtle rounded-lg px-2.5 py-1.5 text-[10px] font-mono font-semibold focus:border-accent outline-none"
          />
        </div>
      </div>

      {selectedImage.targetFormat !== 'jpeg' && selectedImage.targetFormat !== 'svg' && (
        <div>
          <div className="flex justify-between text-[9px] font-semibold text-text-secondary uppercase tracking-widest mb-2">
            <span>BG Opacity</span>
            <span className="text-accent-ink font-mono">{selectedImage.bgOpacity !== undefined ? selectedImage.bgOpacity : 100}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={selectedImage.bgOpacity !== undefined ? selectedImage.bgOpacity : 100}
            onChange={(e) => updateSelected('bgOpacity', parseInt(e.target.value))}
            className="w-full accent-accent"
          />
        </div>
      )}
    </div>
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 pb-8 lg:pb-12 relative min-h-0"
    >
      {/* Ambient background glow */}
      <div className="absolute top-[6%] left-[14%] w-[420px] h-[420px] bg-accent/5 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[8%] right-[16%] w-[360px] h-[360px] bg-accent/[0.04] blur-[150px] rounded-full pointer-events-none" />

      {!hasFilesLoaded ? (
        /* ─────────────── Empty State / Dropzone ─────────────── */
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="relative z-10 flex flex-col items-center justify-center text-center rounded-3xl border border-dashed border-border-default hover:border-accent/50 bg-bg-primary/40 backdrop-blur-md transition-colors duration-300 px-6 py-8 sm:py-10 w-full max-w-4xl mx-auto min-h-[460px]"
        >
          <div className="w-16 h-16 rounded-2xl bg-bg-secondary border border-border-subtle flex items-center justify-center text-accent-ink mb-4 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="M21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
          </div>

          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary">
            Drop an image to begin
          </h2>
          <p className="text-sm text-text-secondary max-w-[420px] mt-2 mb-5 leading-relaxed">
            Convert, resize, crop, and inspect metadata. Everything runs 100% locally in your browser — no uploads.
          </p>

          <label className="px-7 py-3 bg-accent hover:bg-accent-dim text-on-accent rounded-full font-semibold text-sm transition-all duration-200 cursor-pointer shadow-[0_0_24px_rgba(215,207,190,0.28)] hover:scale-[1.02] active:scale-95">
            Browse files
            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files && handleAddFiles(e.target.files)}
            />
          </label>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
            {['Drag & Drop', 'Paste from clipboard', 'Batch ZIP export'].map(chip => (
              <span key={chip} className="px-3 py-1 rounded-full bg-bg-secondary border border-border-subtle text-[10px] font-mono uppercase tracking-widest text-text-tertiary">
                {chip}
              </span>
            ))}
          </div>
        </div>
      ) : (
        /* ─────────────── Studio Workspace ─────────────── */
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* ── Left rail: File queue ── */}
          <aside className="lg:col-span-3 flex flex-col rounded-2xl border border-border-subtle bg-bg-primary/60 backdrop-blur-md h-[320px] lg:h-[660px] overflow-hidden animate-fade-in shadow-2xl shadow-black/40">
            <div className="px-4 py-3.5 border-b border-border-subtle flex items-center justify-between">
              <span className="text-[10px] font-bold text-text-primary tracking-[0.15em] uppercase">
                Files <span className="text-accent-ink">({images.length})</span>
              </span>
              <button
                onClick={clearAll}
                className="text-[9px] font-bold text-text-tertiary hover:text-err uppercase tracking-widest transition-colors cursor-pointer"
              >
                Clear all
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2.5 space-y-2 custom-scrollbar">
              {images.map(img => {
                const isSelected = img.id === selectedId;
                return (
                  <div
                    key={img.id}
                    onClick={() => setSelectedId(img.id)}
                    className={`group flex items-center gap-3 p-2 rounded-xl border select-none transition-all duration-200 cursor-pointer
                      ${isSelected
                        ? 'bg-accent/[0.06] border-accent/40 shadow-[0_4px_14px_rgba(0,0,0,0.3)]'
                        : 'bg-transparent border-transparent hover:bg-text-primary/[0.03] hover:border-border-subtle'
                      }`}
                  >
                    <div className="w-11 h-11 rounded-lg border border-border-subtle bg-bg-base overflow-hidden shrink-0 relative">
                      <img src={img.previewUrl} alt={img.name} className="w-full h-full object-cover" />
                      {img.status === 'processing' && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <svg className="animate-spin text-accent-ink" width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" className="opacity-20" />
                            <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                          </svg>
                        </div>
                      )}
                      {img.status === 'done' && (
                        <div className="absolute bottom-0 right-0 bg-ok text-on-accent rounded-tl-md p-0.5">
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <h4 className={`text-[11px] font-semibold truncate transition-colors ${isSelected ? 'text-accent-ink' : 'text-text-primary group-hover:text-text-primary'}`}>
                        {img.name}
                      </h4>
                      <p className="text-[9px] text-text-tertiary font-mono flex flex-wrap items-center gap-1.5">
                        <span>{renderSize(img.size)}</span>
                        {img.convertedSize && (
                          <>
                            <span className="text-text-muted">→</span>
                            <span className="text-text-secondary font-semibold">{renderSize(img.convertedSize)}</span>
                            <span>{renderSavings(img)}</span>
                          </>
                        )}
                      </p>
                    </div>

                    <button
                      onClick={(e) => removeImage(img.id, e)}
                      className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-err p-1 transition-opacity duration-200 cursor-pointer"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                );
              })}

              <label className="flex items-center justify-center gap-2 mt-1 py-2.5 rounded-xl border border-dashed border-border-subtle hover:border-accent/50 text-text-tertiary hover:text-accent-ink text-[10px] font-semibold uppercase tracking-widest cursor-pointer transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add more
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files && handleAddFiles(e.target.files)}
                />
              </label>
            </div>

            <div className="p-3 border-t border-border-subtle">
              <button
                onClick={handleConvertAll}
                disabled={isProcessingAll || images.length === 0}
                className="w-full py-2.5 rounded-xl bg-bg-secondary border border-border-default hover:border-accent text-text-primary hover:text-accent-ink text-[11px] font-bold uppercase tracking-wider active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                {isProcessingAll ? 'Converting…' : 'Export all (ZIP)'}
              </button>
            </div>
          </aside>

          {/* ── Center: Canvas + tool switcher ── */}
          <section className="lg:col-span-6 flex flex-col rounded-2xl border border-border-subtle bg-bg-primary/50 backdrop-blur-md h-[400px] sm:h-[460px] lg:h-[660px] overflow-hidden animate-fade-in shadow-2xl shadow-black/40">
            {/* Tool switcher */}
            <div className="px-3 py-3 border-b border-border-subtle shrink-0">
              <div className="flex items-center gap-1 p-1 rounded-xl bg-bg-base border border-border-subtle">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSubTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer
                      ${activeSubTab === tab.id
                        ? 'bg-accent text-on-accent shadow-[0_2px_10px_rgba(215,207,190,0.25)]'
                        : 'text-text-tertiary hover:text-text-primary hover:bg-text-primary/[0.04]'
                      }`}
                  >
                    <ToolIcon id={tab.id} />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Canvas area */}
            <div className="flex-1 bg-bg-base p-5 flex items-center justify-center overflow-hidden relative min-h-0">
              {selectedImage ? (
                <>
                  {activeSubTab === 'metadata' ? (
                    <div className="w-full h-full overflow-y-auto space-y-3 text-[11px] custom-scrollbar animate-fade-in">
                      {parsedMeta ? (
                        <div className="space-y-3">
                          <div className={`${cardClass} space-y-2.5`}>
                            <span className={sectionLabel}>File Attributes</span>
                            <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
                              <div className="text-text-tertiary uppercase text-[9px]">Format</div>
                              <div className="text-text-primary font-semibold">{parsedMeta.format}</div>
                              <div className="text-text-tertiary uppercase text-[9px]">Mime Type</div>
                              <div className="text-text-primary font-semibold">{parsedMeta.mimeType}</div>
                              <div className="text-text-tertiary uppercase text-[9px]">Dimensions</div>
                              <div className="text-text-primary font-semibold">{parsedMeta.width} x {parsedMeta.height} px</div>
                            </div>
                          </div>

                          {parsedMeta.exif && Object.keys(parsedMeta.exif).length > 0 && (
                            <div className={`${cardClass} space-y-2.5`}>
                              <span className={sectionLabel}>EXIF Camera Parameters</span>
                              <div className="grid grid-cols-2 gap-y-2 gap-x-4 font-mono text-[10px]">
                                {Object.entries(parsedMeta.exif).map(([k, v]) => (
                                  <React.Fragment key={k}>
                                    <div className="text-text-tertiary uppercase text-[9px] truncate">{k}</div>
                                    <div className="text-text-primary font-semibold truncate" title={v}>{v}</div>
                                  </React.Fragment>
                                ))}
                              </div>
                            </div>
                          )}

                          {parsedMeta.pngChunks && Object.keys(parsedMeta.pngChunks).length > 0 && (
                            <div className={`${cardClass} space-y-2.5`}>
                              <span className={sectionLabel}>PNG Text Chunks</span>
                              <div className="grid grid-cols-2 gap-y-2 gap-x-4 font-mono text-[10px]">
                                {Object.entries(parsedMeta.pngChunks).map(([k, v]) => (
                                  <React.Fragment key={k}>
                                    <div className="text-text-tertiary uppercase text-[9px] truncate">{k}</div>
                                    <div className="text-text-primary font-semibold truncate" title={v}>{v}</div>
                                  </React.Fragment>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="py-12 text-center text-text-tertiary font-mono text-[10px] animate-pulse">
                          Reading metadata markers…
                        </div>
                      )}
                    </div>
                  ) : activeSubTab === 'crop' ? (
                    <div
                      ref={imageContainerRef}
                      className="relative w-full h-full flex items-center justify-center animate-fade-in"
                    >
                      <img
                        ref={cropImgRef}
                        src={selectedImage.previewUrl}
                        alt="Crop preview"
                        className="max-w-full max-h-full object-contain pointer-events-none select-none rounded-lg"
                        onLoad={measureCropLayout}
                      />

                      {cropRect && cropLayout && (
                        (() => {
                          const renderScaleX = cropLayout.imgW / selectedImage.originalWidth;
                          const renderScaleY = cropLayout.imgH / selectedImage.originalHeight;

                          const boxLeft = cropLayout.offX + cropRect.x * renderScaleX;
                          const boxTop = cropLayout.offY + cropRect.y * renderScaleY;
                          const boxWidth = cropRect.width * renderScaleX;
                          const boxHeight = cropRect.height * renderScaleY;

                          return (
                            <div
                              ref={cropBoxRef}
                              style={{
                                position: 'absolute',
                                left: `${boxLeft}px`,
                                top: `${boxTop}px`,
                                width: `${boxWidth}px`,
                                height: `${boxHeight}px`,
                                border: '1.5px dashed #D7CFBE',
                                boxShadow: '0 0 0 9999px rgba(0,0,0,0.72)',
                                touchAction: 'none',
                              }}
                              onMouseDown={(e) => handleCropMouseDown(e, 'drag')}
                              onTouchStart={(e) => handleCropMouseDown(e, 'drag')}
                            >
                              <div onMouseDown={(e) => { e.stopPropagation(); handleCropMouseDown(e, 'nw'); }} onTouchStart={(e) => { e.stopPropagation(); handleCropMouseDown(e, 'nw'); }} className="absolute -top-2 -left-2 w-4 h-4 sm:w-3 sm:h-3 bg-accent border border-black cursor-nwse-resize rounded-full touch-none" />
                              <div onMouseDown={(e) => { e.stopPropagation(); handleCropMouseDown(e, 'ne'); }} onTouchStart={(e) => { e.stopPropagation(); handleCropMouseDown(e, 'ne'); }} className="absolute -top-2 -right-2 w-4 h-4 sm:w-3 sm:h-3 bg-accent border border-black cursor-nesw-resize rounded-full touch-none" />
                              <div onMouseDown={(e) => { e.stopPropagation(); handleCropMouseDown(e, 'se'); }} onTouchStart={(e) => { e.stopPropagation(); handleCropMouseDown(e, 'se'); }} className="absolute -bottom-2 -right-2 w-4 h-4 sm:w-3 sm:h-3 bg-accent border border-black cursor-nwse-resize rounded-full touch-none" />
                              <div onMouseDown={(e) => { e.stopPropagation(); handleCropMouseDown(e, 'sw'); }} onTouchStart={(e) => { e.stopPropagation(); handleCropMouseDown(e, 'sw'); }} className="absolute -bottom-2 -left-2 w-4 h-4 sm:w-3 sm:h-3 bg-accent border border-black cursor-nesw-resize rounded-full touch-none" />

                              <div onMouseDown={(e) => { e.stopPropagation(); handleCropMouseDown(e, 'n'); }} onTouchStart={(e) => { e.stopPropagation(); handleCropMouseDown(e, 'n'); }} className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 sm:w-4 h-1.5 bg-accent/60 cursor-ns-resize rounded touch-none" />
                              <div onMouseDown={(e) => { e.stopPropagation(); handleCropMouseDown(e, 's'); }} onTouchStart={(e) => { e.stopPropagation(); handleCropMouseDown(e, 's'); }} className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 sm:w-4 h-1.5 bg-accent/60 cursor-ns-resize rounded touch-none" />
                              <div onMouseDown={(e) => { e.stopPropagation(); handleCropMouseDown(e, 'w'); }} onTouchStart={(e) => { e.stopPropagation(); handleCropMouseDown(e, 'w'); }} className="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-6 sm:h-4 bg-accent/60 cursor-ew-resize rounded touch-none" />
                              <div onMouseDown={(e) => { e.stopPropagation(); handleCropMouseDown(e, 'e'); }} onTouchStart={(e) => { e.stopPropagation(); handleCropMouseDown(e, 'e'); }} className="absolute -right-1 top-1/2 -translate-y-1/2 w-1.5 h-6 sm:h-4 bg-accent/60 cursor-ew-resize rounded touch-none" />
                            </div>
                          );
                        })()
                      )}
                    </div>
                  ) : (
                    <div className="relative w-full h-full flex items-center justify-center animate-fade-in">
                      <img
                        src={selectedImage.previewUrl}
                        alt="Live transform preview"
                        className="max-w-full max-h-full object-contain pointer-events-none select-none transition-transform duration-300 ease-out rounded-lg"
                        style={{
                          transform: `rotate(${selectedImage.rotation}deg) scaleX(${selectedImage.flipH ? -1 : 1}) scaleY(${selectedImage.flipV ? -1 : 1})`,
                        }}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-center gap-2">
                  <span className="text-text-tertiary text-xs">Select an image to preview.</span>
                </div>
              )}
            </div>

            {/* Canvas footer: file info */}
            {selectedImage && (
              <div className="px-4 py-2.5 border-t border-border-subtle flex items-center justify-between shrink-0 font-mono text-[9.5px]">
                <div className="min-w-0">
                  <span className="block text-[10px] font-semibold text-text-primary truncate">
                    {selectedImage.name}
                  </span>
                  <span className="block text-[9px] text-text-tertiary">
                    {selectedImage.originalWidth} × {selectedImage.originalHeight} px · ratio {(selectedImage.originalWidth / selectedImage.originalHeight).toFixed(2)}
                  </span>
                </div>
                <span className="text-[9px] bg-bg-secondary border border-border-subtle px-2 py-0.5 rounded text-text-tertiary uppercase shrink-0">
                  {selectedImage.file.type.split('/')[1]?.toUpperCase()}
                </span>
              </div>
            )}
          </section>

          {/* ── Right rail: Inspector ── */}
          <aside className="lg:col-span-3 flex flex-col rounded-2xl border border-border-subtle bg-bg-primary/60 backdrop-blur-md h-auto max-h-[540px] lg:h-[660px] lg:max-h-none overflow-hidden animate-fade-in shadow-2xl shadow-black/40">
            <div className="px-4 py-3.5 border-b border-border-subtle flex items-center justify-between shrink-0">
              <span className="text-[10px] font-bold text-text-primary tracking-[0.15em] uppercase">
                {TABS.find(t => t.id === activeSubTab)?.label} Settings
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0 custom-scrollbar">
              {selectedImage ? (
                <>
                  {/* Transform controls */}
                  {activeSubTab === 'transform' && (
                    <div className={`${cardClass} space-y-4 animate-fade-in`}>
                      <div className="flex items-center justify-between">
                        <span className={sectionLabel}>Resize</span>
                        <label className="flex items-center gap-1.5 text-[9px] font-bold text-text-secondary uppercase tracking-widest cursor-pointer">
                          <input
                            type="checkbox"
                            checked={aspectRatioLocked}
                            onChange={(e) => setAspectRatioLocked(e.target.checked)}
                            className="rounded bg-bg-base border-border-subtle text-accent-ink focus:ring-0 focus:ring-offset-0"
                          />
                          Lock
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[8px] font-semibold text-text-tertiary uppercase tracking-widest mb-1">Width</label>
                          <input
                            type="number"
                            value={selectedImage.targetWidth}
                            onChange={(e) => handleResizeChange('w', parseInt(e.target.value))}
                            className="w-full bg-bg-base border border-border-subtle rounded-lg px-2.5 py-1.5 text-[11px] font-semibold font-mono focus:border-accent outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] font-semibold text-text-tertiary uppercase tracking-widest mb-1">Height</label>
                          <input
                            type="number"
                            value={selectedImage.targetHeight}
                            onChange={(e) => handleResizeChange('h', parseInt(e.target.value))}
                            className="w-full bg-bg-base border border-border-subtle rounded-lg px-2.5 py-1.5 text-[11px] font-semibold font-mono focus:border-accent outline-none"
                          />
                        </div>
                      </div>

                      <div className="pt-1 space-y-2">
                        <span className={sectionLabel}>Orientation</span>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleRotate('left')}
                            className="py-2 bg-bg-base border border-border-subtle rounded-lg text-[9px] font-bold uppercase tracking-wider hover:border-accent text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                          >
                            Rotate L
                          </button>
                          <button
                            onClick={() => handleRotate('right')}
                            className="py-2 bg-bg-base border border-border-subtle rounded-lg text-[9px] font-bold uppercase tracking-wider hover:border-accent text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                          >
                            Rotate R
                          </button>
                          <button
                            onClick={() => updateSelected('flipH', !selectedImage.flipH)}
                            className={`py-2 border rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer
                              ${selectedImage.flipH
                                ? 'bg-accent text-on-accent border-accent'
                                : 'bg-bg-base border-border-subtle hover:border-accent text-text-secondary hover:text-text-primary'
                              }`}
                          >
                            Flip H
                          </button>
                          <button
                            onClick={() => updateSelected('flipV', !selectedImage.flipV)}
                            className={`py-2 border rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer
                              ${selectedImage.flipV
                                ? 'bg-accent text-on-accent border-accent'
                                : 'bg-bg-base border-border-subtle hover:border-accent text-text-secondary hover:text-text-primary'
                              }`}
                          >
                            Flip V
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Crop controls */}
                  {activeSubTab === 'crop' && (
                    <div className="space-y-3 animate-fade-in">
                      <div className={`${cardClass} space-y-3`}>
                        <span className={sectionLabel}>Aspect Ratio</span>
                        <div className="grid grid-cols-2 gap-2">
                          {['free', '1:1', '16:9', '4:3'].map(ratio => (
                            <button
                              key={ratio}
                              onClick={() => {
                                setCropAspectRatio(ratio);
                                if (ratio !== 'free') {
                                  let w = selectedImage.originalWidth;
                                  let h = selectedImage.originalHeight;
                                  if (ratio === '1:1') h = w;
                                  else if (ratio === '16:9') h = w / (16 / 9);
                                  else if (ratio === '4:3') h = w / (4 / 3);

                                  if (h > selectedImage.originalHeight) {
                                    h = selectedImage.originalHeight;
                                    if (ratio === '1:1') w = h;
                                    else if (ratio === '16:9') w = h * (16 / 9);
                                    else if (ratio === '4:3') w = h * (4 / 3);
                                  }
                                  setCropRect({ x: 0, y: 0, width: Math.round(w), height: Math.round(h) });
                                }
                              }}
                              className={`py-2 rounded-lg border text-[9px] uppercase font-bold tracking-wider transition-colors cursor-pointer
                                ${cropAspectRatio === ratio
                                  ? 'bg-accent text-on-accent border-accent'
                                  : 'border-border-subtle bg-bg-base text-text-secondary hover:text-text-primary hover:border-accent'
                                }`}
                            >
                              {ratio}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={applyCrop}
                          className="py-2.5 rounded-xl bg-ok/10 border border-ok/30 text-ok font-bold text-[10px] uppercase tracking-wider hover:bg-ok/20 transition-colors cursor-pointer"
                        >
                          Apply
                        </button>
                        <button
                          onClick={resetCrop}
                          className="py-2.5 rounded-xl bg-err/10 border border-err/30 text-err font-bold text-[10px] uppercase tracking-wider hover:bg-err/20 transition-colors cursor-pointer"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Shared export settings (all tools that export) */}
                  {exportSettings}
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-center text-text-tertiary text-xs">
                  Select a file to inspect.
                </div>
              )}
            </div>

            {/* Inspector footer: download */}
            {selectedImage && (
              <div className="p-3 border-t border-border-subtle shrink-0">
                <button
                  onClick={handleDownloadSelected}
                  disabled={selectedImage.status === 'processing'}
                  className="w-full py-2.5 bg-accent hover:bg-accent-dim text-on-accent text-[11px] font-bold uppercase tracking-wider rounded-xl transition-all shadow-[0_0_18px_rgba(215,207,190,0.28)] hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                >
                  {selectedImage.status === 'processing' ? 'Converting…' : 'Convert & Download'}
                </button>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
