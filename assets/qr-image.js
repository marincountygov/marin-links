/*
 * Marin Links image preparation.
 * Images are read and prepared in memory. Nothing is uploaded or stored.
 */

(() => {
  "use strict";

  const ALPHA_THRESHOLD = 8;

  function makeCanvas(width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  function getContext(canvas, options = {}) {
    const context = canvas.getContext("2d", options);
    if (!context) throw new Error("Canvas is not available.");
    return context;
  }

  function findVisibleBounds(imageData, width, height) {
    let left = width;
    let top = height;
    let right = -1;
    let bottom = -1;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const alpha = imageData[((y * width) + x) * 4 + 3];
        if (alpha <= ALPHA_THRESHOLD) continue;
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }

    if (right < left || bottom < top) return null;
    return {
      x: left,
      y: top,
      width: right - left + 1,
      height: bottom - top + 1
    };
  }

  function prepare(image) {
    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;
    if (!sourceWidth || !sourceHeight) {
      throw new Error("The image has no visible size.");
    }

    const source = makeCanvas(sourceWidth, sourceHeight);
    const sourceContext = getContext(source, { willReadFrequently: true });
    sourceContext.clearRect(0, 0, sourceWidth, sourceHeight);
    sourceContext.drawImage(image, 0, 0, sourceWidth, sourceHeight);

    const pixels = sourceContext.getImageData(0, 0, sourceWidth, sourceHeight);
    const bounds = findVisibleBounds(pixels.data, sourceWidth, sourceHeight);
    if (!bounds) {
      throw new Error("The image is blank.");
    }

    const canvas = makeCanvas(bounds.width, bounds.height);
    const context = getContext(canvas);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      source,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      0,
      0,
      bounds.width,
      bounds.height
    );

    return Object.freeze({
      canvas,
      width: bounds.width,
      height: bounds.height,
      sourceWidth,
      sourceHeight,
      trimmed: bounds.x !== 0
        || bounds.y !== 0
        || bounds.width !== sourceWidth
        || bounds.height !== sourceHeight,
      bounds: Object.freeze({ ...bounds })
    });
  }

  window.MarinQrImage = Object.freeze({ prepare });
})();
