export type ScreenshotMode = 'fullpage' | 'visible' | 'selected';

export type ExportFormat = 'png' | 'jpeg' | 'webp' | 'pdf';

export type Orientation = 'portrait' | 'landscape';

export type ActiveTool = 'screenshot' | 'fonts' | 'colors' | 'images' | 'meta' | 'website';

export interface ImageFile {
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl: string;
  originalWidth: number;
  originalHeight: number;
  targetWidth: number;
  targetHeight: number;
  targetFormat: 'png' | 'jpeg' | 'webp' | 'bmp' | 'ico' | 'gif' | 'svg';
  targetQuality: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  cropRect: Rect | null;
  convertedBlob: Blob | null;
  convertedSize: number | null;
  status: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
  bgOpacity?: number;
}

export interface FontInfo {
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
  color: string;
  fontStyle: string;
  textTransform: string;
  element: string;
}

export interface ColorInfo {
  hex: string;
  rgb: string;
  hsl: string;
  source: 'eyedropper' | 'element';
  timestamp: number;
}

export interface DevicePreset {
  id: string;
  name: string;
  width: number;
  height: number;
  dpr: number;
  category: 'desktop' | 'mobile' | 'tablet';
}

export interface CaptureOptions {
  mode: ScreenshotMode;
  format: ExportFormat;
  quality: number;
  devicePreset?: DevicePreset;
  customWidth?: number;
  customHeight?: number;
  customDpr?: number;
  orientation: Orientation;
}

export interface CaptureResult {
  dataUrl: string;
  width: number;
  height: number;
  format: ExportFormat;
  url?: string;
  title?: string;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageInfo {
  scrollWidth: number;
  scrollHeight: number;
  clientWidth: number;
  clientHeight: number;
  devicePixelRatio: number;
  scrollX?: number;
  scrollY?: number;
}

export interface MetadataPayload {
  standard: {
    title: string;
    description: string;
    keywords: string;
    author: string;
    robots: string;
    canonical: string;
    language: string;
    charset: string;
    themeColor: string;
    viewport: string;
  };
  og: {
    title: string;
    description: string;
    image: string;
    url: string;
    type: string;
    site_name: string;
    locale: string;
    video: string;
    audio: string;
  };
  twitter: {
    title: string;
    description: string;
    image: string;
    card: string;
    site: string;
    creator: string;
  };
  icons: {
    favicon: string;
    appleTouchIcon: string;
    maskIcon: string;
    shortcutIcon: string;
  };
  seo: {
    canonical: string;
    alternates: { hreflang: string; href: string }[];
    index: boolean;
    follow: boolean;
  };
  pwa: {
    manifest: string;
    themeColor: string;
    backgroundColor: string;
  };
  structuredData: Record<string, unknown>[];
}
