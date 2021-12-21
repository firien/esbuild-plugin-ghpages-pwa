// PNG metadata
export default (buffer) => {
  // verify PNG header
  // https://en.wikipedia.org/wiki/Portable_Network_Graphics#File_header
  // 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
  if (buffer.readUInt32BE(0) === 2303741511 && buffer.readUInt32BE(4) === 218765834) {
    // assume IHDR starts at offset 16
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
      depth: buffer.readUInt8(24)
    }
  } else {
    throw 'invalid PNG file'
  }
}
