// Sharp stub - provides minimal interface to prevent errors
module.exports = function sharp() {
  return {
    resize: () => ({ toBuffer: () => Buffer.alloc(0) }),
    jpeg: () => ({ toBuffer: () => Buffer.alloc(0) }),
    png: () => ({ toBuffer: () => Buffer.alloc(0) }),
    webp: () => ({ toBuffer: () => Buffer.alloc(0) }),
    toBuffer: () => Buffer.alloc(0),
    toFile: () => Promise.resolve()
  };
};

// Export common Sharp functions as no-ops
module.exports.cache = () => {};
module.exports.concurrency = () => {};
module.exports.counters = () => ({});
module.exports.simd = () => {};
module.exports.versions = {
  vips: '8.0.0',
  sharp: '0.33.2'
};