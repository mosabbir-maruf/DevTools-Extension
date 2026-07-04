function makeCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
}

const crc32Table = makeCrc32Table();

function calculateCrc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ crc32Table[(crc ^ data[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function getDosTime(date: Date): { time: number; date: number } {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);
  const time = (hours << 11) | (minutes << 5) | seconds;

  const year = date.getFullYear() - 1980;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const d = (year << 9) | (month << 5) | day;

  return { time, date: d };
}

export async function createZip(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const parts: Uint8Array[] = [];
  const centralDirectoryHeaders: Uint8Array[] = [];
  let currentOffset = 0;
  
  const encoder = new TextEncoder();
  const now = new Date();
  const { time: dosTime, date: dosDate } = getDosTime(now);

  for (const file of files) {
    const arrayBuffer = await file.blob.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);
    const fileNameBytes = encoder.encode(file.name);
    
    const crc = calculateCrc32(fileData);
    const size = fileData.length;

    // ── Local File Header ─────────────────────────────────────────
    const localHeader = new Uint8Array(30 + fileNameBytes.length);
    const view = new DataView(localHeader.buffer);

    view.setUint32(0, 0x04034b50, true); // Local file header signature
    view.setUint16(4, 10, true);         // Version needed to extract (1.0)
    view.setUint16(6, 0, true);          // General purpose bit flag (0)
    view.setUint16(8, 0, true);          // Compression method (0 = Store / No compression)
    view.setUint16(10, dosTime, true);   // Last mod file time
    view.setUint16(12, dosDate, true);   // Last mod file date
    view.setUint32(14, crc, true);       // CRC-32
    view.setUint32(18, size, true);      // Compressed size
    view.setUint32(22, size, true);      // Uncompressed size
    view.setUint16(26, fileNameBytes.length, true); // File name length
    view.setUint16(28, 0, true);         // Extra field length
    localHeader.set(fileNameBytes, 30);

    parts.push(localHeader);
    parts.push(fileData);

    // ── Central Directory File Header ─────────────────────────────
    const cdHeader = new Uint8Array(46 + fileNameBytes.length);
    const cdView = new DataView(cdHeader.buffer);

    cdView.setUint32(0, 0x02014b50, true); // Central directory file header signature
    cdView.setUint16(4, 20, true);         // Version made by
    cdView.setUint16(6, 10, true);         // Version needed to extract
    cdView.setUint16(8, 0, true);          // General purpose bit flag
    cdView.setUint16(10, 0, true);         // Compression method
    cdView.setUint16(12, dosTime, true);   // Last mod file time
    cdView.setUint16(14, dosDate, true);   // Last mod file date
    cdView.setUint32(16, crc, true);       // CRC-32
    cdView.setUint32(20, size, true);      // Compressed size
    cdView.setUint32(24, size, true);      // Uncompressed size
    cdView.setUint16(28, fileNameBytes.length, true); // File name length
    cdView.setUint16(30, 0, true);         // Extra field length
    cdView.setUint16(32, 0, true);         // File comment length
    cdView.setUint16(34, 0, true);         // Disk number start
    cdView.setUint16(36, 0, true);         // Internal file attributes
    cdView.setUint32(38, 0, true);         // External file attributes
    cdView.setUint32(42, currentOffset, true); // Relative offset of local header
    cdHeader.set(fileNameBytes, 46);

    centralDirectoryHeaders.push(cdHeader);

    // Update offset for next file
    currentOffset += localHeader.length + fileData.length;
  }

  // Calculate central directory details
  const cdOffset = currentOffset;
  let cdSize = 0;
  for (const cdh of centralDirectoryHeaders) {
    parts.push(cdh);
    cdSize += cdh.length;
  }

  // ── End of Central Directory Record ───────────────────────────
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);

  eocdView.setUint32(0, 0x06054b50, true); // End of central directory signature
  eocdView.setUint16(4, 0, true);          // Number of this disk
  eocdView.setUint16(6, 0, true);          // Disk where central directory starts
  eocdView.setUint16(8, files.length, true); // Number of central directory records on this disk
  eocdView.setUint16(10, files.length, true); // Total number of central directory records
  eocdView.setUint32(12, cdSize, true);     // Size of central directory
  eocdView.setUint32(16, cdOffset, true);   // Offset of central directory start
  eocdView.setUint16(20, 0, true);          // Comment length

  parts.push(eocd);

  return new Blob(parts as BlobPart[], { type: 'application/zip' });
}
