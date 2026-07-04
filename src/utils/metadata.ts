export interface ParsedMetadata {
  format: string;
  width?: number;
  height?: number;
  mimeType: string;
  exif?: Record<string, string>;
  pngChunks?: Record<string, string>;
  other?: Record<string, string>;
}

export async function parseImageMetadata(file: File): Promise<ParsedMetadata> {
  const metadata: ParsedMetadata = {
    format: file.type.split('/')[1]?.toUpperCase() || 'UNKNOWN',
    mimeType: file.type,
    exif: {},
    pngChunks: {},
    other: {},
  };

  metadata.other!['File Name'] = file.name;
  metadata.other!['File Size'] = formatBytes(file.size);
  metadata.other!['Last Modified'] = new Date(file.lastModified).toLocaleString();

  try {
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);

    // Read dimensions via HTML Image loading as a reliable fallback/companion
    const dimensions = await getImageDimensions(file);
    metadata.width = dimensions.width;
    metadata.height = dimensions.height;

    if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
      parseJpegMetadata(view, metadata);
    } else if (file.type === 'image/png') {
      parsePngMetadata(buffer, metadata);
    } else if (file.type === 'image/webp') {
      parseWebpMetadata(view, metadata);
    }
  } catch (err) {
    console.warn('Metadata parsing failed or is incomplete:', err);
  }

  // Clean up empty metadata groups
  if (Object.keys(metadata.exif!).length === 0) delete metadata.exif;
  if (Object.keys(metadata.pngChunks!).length === 0) delete metadata.pngChunks;
  if (Object.keys(metadata.other!).length === 0) delete metadata.other;

  return metadata;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: 0, height: 0 });
    };
    img.src = url;
  });
}

// JPEG EXIF Parser
function parseJpegMetadata(view: DataView, metadata: ParsedMetadata) {
  if (view.getUint16(0, false) !== 0xFFD8) {
    return; // Not a valid JPEG
  }

  let offset = 2;
  const length = view.byteLength;

  while (offset < length) {
    const marker = view.getUint16(offset, false);
    
    // APP1 Marker (EXIF data is stored here)
    if (marker === 0xFFE1) {
      const exifHeaderOffset = offset + 4;
      
      // Verify Exif header signature "Exif\0\0"
      if (view.getUint32(exifHeaderOffset, false) === 0x45786966 && view.getUint16(exifHeaderOffset + 4, false) === 0x0000) {
        const tiffHeaderOffset = exifHeaderOffset + 6;
        parseTiffHeader(view, tiffHeaderOffset, metadata);
      }
      break;
    }
    
    // Skip segment
    const segmentLength = view.getUint16(offset + 2, false);
    offset += 2 + segmentLength;
    
    // Break if we hit SOS (Start of Scan) or other markers
    if (marker === 0xFFDA || marker === 0xFFD9) break;
  }
}

function parseTiffHeader(view: DataView, tiffHeaderOffset: number, metadata: ParsedMetadata) {
  const byteOrder = view.getUint16(tiffHeaderOffset, false);
  const isLittleEndian = byteOrder === 0x4949; // "II" (Intel) vs "MM" (Motorola)

  const magic = view.getUint16(tiffHeaderOffset + 2, !isLittleEndian);
  if (magic !== 0x002A) return; // Invalid TIFF

  const firstIfdOffset = view.getUint32(tiffHeaderOffset + 4, !isLittleEndian);
  const exifData: Record<string, string> = {};

  parseIfd(view, tiffHeaderOffset, tiffHeaderOffset + firstIfdOffset, isLittleEndian, exifData);
  metadata.exif = { ...metadata.exif, ...exifData };
}

function parseIfd(
  view: DataView,
  tiffHeaderOffset: number,
  ifdOffset: number,
  isLittleEndian: boolean,
  exifData: Record<string, string>
) {
  if (ifdOffset >= view.byteLength) return;
  const numEntries = view.getUint16(ifdOffset, !isLittleEndian);

  let entryOffset = ifdOffset + 2;
  const exifSubIfdOffsets: number[] = [];
  const gpsIfdOffsets: number[] = [];

  for (let i = 0; i < numEntries; i++) {
    if (entryOffset + 12 > view.byteLength) break;

    const tag = view.getUint16(entryOffset, !isLittleEndian);
    const type = view.getUint16(entryOffset + 2, !isLittleEndian);
    const count = view.getUint32(entryOffset + 4, !isLittleEndian);
    const valueOffset = view.getUint32(entryOffset + 8, !isLittleEndian);

    const val = readTiffTagValue(view, tiffHeaderOffset, type, count, entryOffset + 8, valueOffset, isLittleEndian);

    // Map common tags
    if (tag === 0x010F) exifData['Camera Maker'] = String(val).trim();
    else if (tag === 0x0110) exifData['Camera Model'] = String(val).trim();
    else if (tag === 0x0132) exifData['Date Modified'] = String(val).trim();
    else if (tag === 0x0131) exifData['Software'] = String(val).trim();
    else if (tag === 0x013B) exifData['Artist'] = String(val).trim();
    else if (tag === 0x0213) exifData['YCbCr Positioning'] = String(val);
    else if (tag === 0x0112) {
      const orientMap: Record<number, string> = {
        1: 'Normal (Horizontal)',
        2: 'Mirror Horizontal',
        3: 'Rotate 180',
        4: 'Mirror Vertical',
        5: 'Mirror Horizontal + Rotate 270',
        6: 'Rotate 90',
        7: 'Mirror Horizontal + Rotate 90',
        8: 'Rotate 270',
      };
      exifData['Orientation'] = orientMap[Number(val)] || `Unknown (${val})`;
    }
    // Sub-IFD pointers
    else if (tag === 0x8769) {
      exifSubIfdOffsets.push(valueOffset);
    }
    // GPS Info IFD pointer
    else if (tag === 0x8825) {
      gpsIfdOffsets.push(valueOffset);
    }

    entryOffset += 12;
  }

  // Parse EXIF Sub-IFD
  for (const offset of exifSubIfdOffsets) {
    parseSubIfd(view, tiffHeaderOffset, tiffHeaderOffset + offset, isLittleEndian, exifData);
  }

  // Parse GPS IFD
  for (const offset of gpsIfdOffsets) {
    parseGpsIfd(view, tiffHeaderOffset, tiffHeaderOffset + offset, isLittleEndian, exifData);
  }
}

function parseSubIfd(
  view: DataView,
  tiffHeaderOffset: number,
  subIfdOffset: number,
  isLittleEndian: boolean,
  exifData: Record<string, string>
) {
  if (subIfdOffset >= view.byteLength) return;
  const numEntries = view.getUint16(subIfdOffset, !isLittleEndian);
  let entryOffset = subIfdOffset + 2;

  for (let i = 0; i < numEntries; i++) {
    if (entryOffset + 12 > view.byteLength) break;

    const tag = view.getUint16(entryOffset, !isLittleEndian);
    const type = view.getUint16(entryOffset + 2, !isLittleEndian);
    const count = view.getUint32(entryOffset + 4, !isLittleEndian);
    const valueOffset = view.getUint32(entryOffset + 8, !isLittleEndian);

    const val = readTiffTagValue(view, tiffHeaderOffset, type, count, entryOffset + 8, valueOffset, isLittleEndian);

    if (tag === 0x9003) exifData['Date Created'] = String(val).trim();
    else if (tag === 0x9004) exifData['Digitization Date'] = String(val).trim();
    else if (tag === 0x920A) exifData['Focal Length'] = val + ' mm';
    else if (tag === 0x829D) exifData['F-Number'] = 'f/' + val;
    else if (tag === 0x829A) exifData['Exposure Time'] = val + ' sec';
    else if (tag === 0x8827) exifData['ISO Speed'] = String(val);
    else if (tag === 0x9204) exifData['Exposure Bias'] = val + ' EV';
    else if (tag === 0x9207) {
      const meteringMap: Record<number, string> = {
        0: 'Unknown', 1: 'Average', 2: 'Center Weighted Average', 3: 'Spot',
        4: 'Multi-Spot', 5: 'Pattern', 6: 'Partial', 255: 'Other',
      };
      exifData['Metering Mode'] = meteringMap[Number(val)] || `Unknown (${val})`;
    } else if (tag === 0x9209) {
      const flashVal = Number(val);
      exifData['Flash'] = (flashVal & 1) ? 'Fired' : 'Did not fire';
    } else if (tag === 0xA433) exifData['Lens Maker'] = String(val).trim();
    else if (tag === 0xA434) exifData['Lens Model'] = String(val).trim();

    entryOffset += 12;
  }
}

function parseGpsIfd(
  view: DataView,
  tiffHeaderOffset: number,
  gpsIfdOffset: number,
  isLittleEndian: boolean,
  exifData: Record<string, string>
) {
  if (gpsIfdOffset >= view.byteLength) return;
  const numEntries = view.getUint16(gpsIfdOffset, !isLittleEndian);
  let entryOffset = gpsIfdOffset + 2;

  let latRef = '';
  let lonRef = '';
  let latVal: number[] | null = null;
  let lonVal: number[] | null = null;

  for (let i = 0; i < numEntries; i++) {
    if (entryOffset + 12 > view.byteLength) break;

    const tag = view.getUint16(entryOffset, !isLittleEndian);
    const type = view.getUint16(entryOffset + 2, !isLittleEndian);
    const count = view.getUint32(entryOffset + 4, !isLittleEndian);
    const valueOffset = view.getUint32(entryOffset + 8, !isLittleEndian);

    const val = readTiffTagValue(view, tiffHeaderOffset, type, count, entryOffset + 8, valueOffset, isLittleEndian);

    if (tag === 0x0001) latRef = String(val).trim(); // 'N' or 'S'
    else if (tag === 0x0002) latVal = val as number[]; // [deg, min, sec]
    else if (tag === 0x0003) lonRef = String(val).trim(); // 'E' or 'W'
    else if (tag === 0x0004) lonVal = val as number[]; // [deg, min, sec]
    else if (tag === 0x0006) exifData['GPS Altitude'] = val + ' meters';

    entryOffset += 12;
  }

  if (latVal && latRef) {
    const latDeg = latVal[0] + latVal[1]/60 + latVal[2]/3600;
    exifData['GPS Latitude'] = `${latDeg.toFixed(6)}° ${latRef} (${latVal[0]}° ${latVal[1]}' ${latVal[2]}")`;
  }
  if (lonVal && lonRef) {
    const lonDeg = lonVal[0] + lonVal[1]/60 + lonVal[2]/3600;
    exifData['GPS Longitude'] = `${lonDeg.toFixed(6)}° ${lonRef} (${lonVal[0]}° ${lonVal[1]}' ${lonVal[2]}")`;
  }
}

function readTiffTagValue(
  view: DataView,
  tiffHeaderOffset: number,
  type: number,
  count: number,
  inlineOffset: number,
  valueOffset: number,
  isLittleEndian: boolean
): string | number | number[] | null {
  // Types: 1=BYTE, 2=ASCII, 3=SHORT, 4=LONG, 5=RATIONAL, 7=UNDEFINED, 9=SLONG, 10=SRATIONAL
  const sizeMap: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
  const typeSize = sizeMap[type] || 1;
  const totalSize = typeSize * count;
  const actualOffset = totalSize <= 4 ? inlineOffset : tiffHeaderOffset + valueOffset;

  if (actualOffset + totalSize > view.byteLength) return null;

  if (type === 2) {
    // ASCII string
    let str = '';
    for (let i = 0; i < totalSize - 1; i++) {
      const charCode = view.getUint8(actualOffset + i);
      if (charCode === 0) break;
      str += String.fromCharCode(charCode);
    }
    return str;
  }

  if (type === 3) {
    // SHORT (16-bit)
    if (count === 1) return view.getUint16(actualOffset, !isLittleEndian);
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push(view.getUint16(actualOffset + i * 2, !isLittleEndian));
    }
    return arr;
  }

  if (type === 4) {
    // LONG (32-bit)
    if (count === 1) return view.getUint32(actualOffset, !isLittleEndian);
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push(view.getUint32(actualOffset + i * 4, !isLittleEndian));
    }
    return arr;
  }

  if (type === 5 || type === 10) {
    // RATIONAL (numerator, denominator)
    const readRatio = (offset: number) => {
      const num = type === 5 ? view.getUint32(offset, !isLittleEndian) : view.getInt32(offset, !isLittleEndian);
      const den = type === 5 ? view.getUint32(offset + 4, !isLittleEndian) : view.getInt32(offset + 4, !isLittleEndian);
      return den === 0 ? 0 : num / den;
    };
    if (count === 1) return readRatio(actualOffset);
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push(readRatio(actualOffset + i * 8));
    }
    return arr;
  }

  return null;
}

// PNG Chunk Parser
function parsePngMetadata(buffer: ArrayBuffer, metadata: ParsedMetadata) {
  const bytes = new Uint8Array(buffer);
  
  // Verify PNG signature
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4E || bytes[3] !== 0x47) return;

  let offset = 8;
  const len = bytes.length;

  while (offset + 8 < len) {
    const chunkLength = (bytes[offset] << 24) | (bytes[offset+1] << 16) | (bytes[offset+2] << 8) | bytes[offset+3];
    const chunkType = String.fromCharCode(bytes[offset+4], bytes[offset+5], bytes[offset+6], bytes[offset+7]);
    
    const dataOffset = offset + 8;
    if (dataOffset + chunkLength > len) break;

    if (chunkType === 'IHDR') {
      const view = new DataView(buffer, dataOffset, chunkLength);
      const w = view.getUint32(0, false);
      const h = view.getUint32(4, false);
      const depth = view.getUint8(8);
      const colorType = view.getUint8(9);
      
      metadata.pngChunks!['Width'] = `${w} px`;
      metadata.pngChunks!['Height'] = `${h} px`;
      metadata.pngChunks!['Bit Depth'] = String(depth);
      const colorMap: Record<number, string> = {
        0: 'Grayscale', 2: 'Truecolor (RGB)', 3: 'Indexed-color',
        4: 'Grayscale + Alpha', 6: 'Truecolor + Alpha (RGBA)',
      };
      metadata.pngChunks!['Color Type'] = colorMap[colorType] || `Unknown (${colorType})`;
    } else if (chunkType === 'tEXt') {
      let key = '';
      let idx = dataOffset;
      const end = dataOffset + chunkLength;
      
      // Read key (null-terminated)
      while (idx < end && bytes[idx] !== 0) {
        key += String.fromCharCode(bytes[idx]);
        idx++;
      }
      idx++; // skip null
      
      let val = '';
      while (idx < end) {
        val += String.fromCharCode(bytes[idx]);
        idx++;
      }
      if (key && val) {
        metadata.pngChunks![key] = val;
      }
    }

    offset += 8 + chunkLength + 4; // Length(4) + Type(4) + Data(N) + CRC(4)
  }
}

// WebP VP8X Chunk Parser
function parseWebpMetadata(view: DataView, metadata: ParsedMetadata) {
  if (view.byteLength < 30) return;
  // RIFF WebP header check
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  const webp = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
  
  if (riff !== 'RIFF' || webp !== 'WEBP') return;

  const chunkType = String.fromCharCode(view.getUint8(12), view.getUint8(13), view.getUint8(14), view.getUint8(15));
  if (chunkType === 'VP8X') {
    const flags = view.getUint8(20);
    const hasICC = !!(flags & 32);
    const hasAlpha = !!(flags & 16);
    const hasEXIF = !!(flags & 8);
    const hasXMP = !!(flags & 4);
    const hasAnimation = !!(flags & 2);

    metadata.other!['Has Animation'] = hasAnimation ? 'Yes' : 'No';
    metadata.other!['Has Transparency'] = hasAlpha ? 'Yes' : 'No';
    metadata.other!['Has ICC Profile'] = hasICC ? 'Yes' : 'No';
    metadata.other!['Has EXIF'] = hasEXIF ? 'Yes' : 'No';
    metadata.other!['Has XMP Metadata'] = hasXMP ? 'Yes' : 'No';
  }
}
