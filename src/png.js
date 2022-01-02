// PNG metadata
export default (buffer) => {
  // verify PNG header
  // https://en.wikipedia.org/wiki/Portable_Network_Graphics#File_header
  if (buffer.readUInt32BE(0) === 0x89504E47 && buffer.readUInt32BE(4) === 0x0D0A1A0A) {
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
