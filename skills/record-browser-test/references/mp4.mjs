const find = (buf, type, start, end) => {
  const at = buf.indexOf(type, start);
  if (at < 4 || at >= end) throw new Error(`MP4 atom not found: ${type}`);
  return at - 4;
};

export const patchDuration = (input, seconds) => {
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error(`invalid duration: ${seconds}`);
  const buf = Buffer.from(input);
  const moov = find(buf, 'moov', 0, buf.length);
  const end = moov + buf.readUInt32BE(moov);
  const header = type => {
    const start = find(buf, type, moov, end) + 8;
    if (buf[start] !== 1) throw new Error(`${type} is not version 1; only the 64-bit layout is supported`);
    return start;
  };
  const mvhd = header('mvhd');
  const tkhd = header('tkhd');
  const mdhd = header('mdhd');
  const movieScale = buf.readUInt32BE(mvhd + 4 + 16);
  const trackScale = buf.readUInt32BE(mdhd + 4 + 16);
  buf.writeBigUInt64BE(BigInt(Math.round(seconds * movieScale)), mvhd + 4 + 20);
  buf.writeBigUInt64BE(BigInt(Math.round(seconds * movieScale)), tkhd + 4 + 24);
  buf.writeBigUInt64BE(BigInt(Math.round(seconds * trackScale)), mdhd + 4 + 20);
  return buf;
};
