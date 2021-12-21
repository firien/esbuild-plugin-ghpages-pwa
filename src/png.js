// PNG metadata
export default (buffer) => {
  // verify PNG sig
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
