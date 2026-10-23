/*
 * Marin Links center-image sizing and scan-safety checks.
 *
 * The QR encoder exposes its module grid and Reed-Solomon block layout. This
 * module uses those facts to keep protected QR structures intact and to limit
 * changed data symbols to a conservative share of each block's correction
 * capacity. Browser tests also decode the finished PNG with independent QR
 * readers.
 */

(() => {
  "use strict";

  const QUIET_ZONE_MODULES = 4;
  const MAX_BACKING_WIDTH_FRACTION = 0.30;
  const MAX_BACKING_HEIGHT_FRACTION = 0.30;
  const MAX_BACKING_AREA_FRACTION = 0.08;
  const IMAGE_PADDING_MODULES = 1;
  const MIN_IMAGE_LONG_SIDE_MODULES = 4;
  const CANDIDATE_STEP_MODULES = 0.5;
  const FINAL_SAFETY_REDUCTION = 0.08;
  const SAFE_CORRECTION_FRACTION = 0.65;
  const TEST_MODULE_SIZES = Object.freeze([5, 9]);
  const SVG_EMBEDDED_IMAGE_MAX_SIDE = 1600;

  function makeCanvas() {
    return document.createElement("canvas");
  }

  function getContext(canvas, options = {}) {
    const context = canvas.getContext("2d", options);
    if (!context) throw new Error("Canvas is not available.");
    return context;
  }

  function roundedRectPath(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.lineTo(x + width - r, y);
    context.quadraticCurveTo(x + width, y, x + width, y + r);
    context.lineTo(x + width, y + height - r);
    context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    context.lineTo(x + r, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - r);
    context.lineTo(x, y + r);
    context.quadraticCurveTo(x, y, x + r, y);
    context.closePath();
  }

  function buildModuleMaps(qr, errorCorrectLevel) {
    const moduleCount = qr.getModuleCount();
    let protectedModules;
    const codewordByModule = Array.from(
      { length: moduleCount },
      () => Array(moduleCount).fill(-2)
    );

    const probe = new window.MarinQrCode.QRCode(qr.typeNumber, errorCorrectLevel);
    probe.dataCache = qr.dataCache.slice();
    probe.mapData = function mapData(data) {
      protectedModules = this.modules.map((row) => row.map((value) => value !== null));

      let increment = -1;
      let row = moduleCount - 1;
      let bitIndex = 7;
      let byteIndex = 0;

      for (let column = moduleCount - 1; column > 0; column -= 2) {
        if (column === 6) column -= 1;

        while (true) {
          for (let offset = 0; offset < 2; offset += 1) {
            const x = column - offset;
            if (this.modules[row][x] !== null) continue;
            codewordByModule[row][x] = byteIndex < data.length ? byteIndex : -1;
            bitIndex -= 1;
            if (bitIndex < 0) {
              byteIndex += 1;
              bitIndex = 7;
            }
          }

          row += increment;
          if (row < 0 || row >= moduleCount) {
            row -= increment;
            increment = -increment;
            break;
          }
        }
      }
    };
    probe.makeImpl(false, 0);

    if (!protectedModules) {
      throw new Error("QR structure could not be inspected.");
    }

    return { protectedModules, codewordByModule };
  }

  function buildCodewordBlocks(typeNumber, errorCorrectLevel) {
    const rsBlocks = window.MarinQrCode.QRRSBlock.getRSBlocks(
      typeNumber,
      errorCorrectLevel
    );
    const codewordBlocks = [];
    const blockLimits = rsBlocks.map((block) => {
      const correctionCapacity = Math.floor((block.totalCount - block.dataCount) / 2);
      return Object.freeze({
        correctionCapacity,
        safeLimit: Math.max(1, Math.floor(correctionCapacity * SAFE_CORRECTION_FRACTION))
      });
    });

    const maxDataCount = Math.max(...rsBlocks.map((block) => block.dataCount));
    const maxErrorCount = Math.max(
      ...rsBlocks.map((block) => block.totalCount - block.dataCount)
    );

    for (let position = 0; position < maxDataCount; position += 1) {
      rsBlocks.forEach((block, blockIndex) => {
        if (position < block.dataCount) codewordBlocks.push(blockIndex);
      });
    }

    for (let position = 0; position < maxErrorCount; position += 1) {
      rsBlocks.forEach((block, blockIndex) => {
        if (position < block.totalCount - block.dataCount) {
          codewordBlocks.push(blockIndex);
        }
      });
    }

    return { rsBlocks, codewordBlocks, blockLimits };
  }

  // The small square-in-square marks that help phones correct a tilted code. A logo may cover
  // these. Finder, timing, format, and version modules are never covered.
  function buildAlignmentMap(typeNumber, moduleCount) {
    const alignment = Array.from({ length: moduleCount }, () => Array(moduleCount).fill(false));
    const positions = window.MarinQrCode.QRUtil.getPatternPosition(typeNumber);
    const last = positions.length - 1;
    positions.forEach((centerRow, rowIndex) => {
      positions.forEach((centerColumn, columnIndex) => {
        // The three corners with a finder pattern have no alignment pattern.
        const atFinder = (rowIndex === 0 && columnIndex === 0)
          || (rowIndex === 0 && columnIndex === last)
          || (rowIndex === last && columnIndex === 0);
        if (atFinder) return;
        for (let row = centerRow - 2; row <= centerRow + 2; row += 1) {
          for (let column = centerColumn - 2; column <= centerColumn + 2; column += 1) {
            if (row >= 0 && column >= 0 && row < moduleCount && column < moduleCount) {
              alignment[row][column] = true;
            }
          }
        }
      });
    });
    return alignment;
  }

  function createModel(qr, errorCorrectLevel) {
    const moduleCount = qr.getModuleCount();
    const maps = buildModuleMaps(qr, errorCorrectLevel);
    const blocks = buildCodewordBlocks(qr.typeNumber, errorCorrectLevel);
    const originalModules = Array.from(
      { length: moduleCount },
      (_, row) => Array.from(
        { length: moduleCount },
        (_, column) => qr.isDark(row, column)
      )
    );

    if (blocks.codewordBlocks.length !== qr.dataCache.length) {
      throw new Error("QR correction data could not be inspected.");
    }

    return Object.freeze({
      qr,
      typeNumber: qr.typeNumber,
      moduleCount,
      errorCorrectLevel,
      originalModules,
      protectedModules: maps.protectedModules,
      alignmentModules: buildAlignmentMap(qr.typeNumber, moduleCount),
      codewordByModule: maps.codewordByModule,
      codewordBlocks: blocks.codewordBlocks,
      blockLimits: blocks.blockLimits
    });
  }

  function drawBaseQr(context, model, color, moduleSize, transparentBackground = false) {
    const { moduleCount, originalModules } = model;
    const canvasSize = (moduleCount + (QUIET_ZONE_MODULES * 2)) * moduleSize;
    context.clearRect(0, 0, canvasSize, canvasSize);
    if (!transparentBackground) {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvasSize, canvasSize);
    }
    context.fillStyle = color;
    context.imageSmoothingEnabled = false;

    for (let row = 0; row < moduleCount; row += 1) {
      let runStart = -1;
      for (let column = 0; column <= moduleCount; column += 1) {
        const dark = column < moduleCount && originalModules[row][column];
        if (dark && runStart < 0) runStart = column;
        if (!dark && runStart >= 0) {
          context.fillRect(
            (runStart + QUIET_ZONE_MODULES) * moduleSize,
            (row + QUIET_ZONE_MODULES) * moduleSize,
            (column - runStart) * moduleSize,
            moduleSize
          );
          runStart = -1;
        }
      }
    }
  }

  function moduleIntersectsRect(row, column, x, y, width, height) {
    return column < x + width
      && column + 1 > x
      && row < y + height
      && row + 1 > y;
  }

  function drawLogo(context, model, preparedImage, plan, color, moduleSize) {
    const qrStart = QUIET_ZONE_MODULES * moduleSize;
    const backingX = qrStart + (plan.backingX * moduleSize);
    const backingY = qrStart + (plan.backingY * moduleSize);
    const backingWidth = plan.backingWidth * moduleSize;
    const backingHeight = plan.backingHeight * moduleSize;
    const imageX = qrStart + (plan.imageX * moduleSize);
    const imageY = qrStart + (plan.imageY * moduleSize);
    const imageWidth = plan.imageWidth * moduleSize;
    const imageHeight = plan.imageHeight * moduleSize;

    context.save();
    context.fillStyle = "#ffffff";
    roundedRectPath(
      context,
      backingX,
      backingY,
      backingWidth,
      backingHeight,
      Math.max(moduleSize * 0.75, Math.min(backingWidth, backingHeight) * 0.08)
    );
    context.fill();

    roundedRectPath(
      context,
      imageX,
      imageY,
      imageWidth,
      imageHeight,
      Math.max(moduleSize * 0.3, Math.min(imageWidth, imageHeight) * 0.06)
    );
    context.clip();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(preparedImage.canvas, imageX, imageY, imageWidth, imageHeight);
    context.restore();

    // Restore every QR structure module covered by the white backing or image, except
    // alignment patterns, so nothing is layered over the logo. This keeps finder, timing,
    // format, and version modules intact (a logo of this size never reaches them).
    const minColumn = Math.max(0, Math.floor(plan.backingX) - 1);
    const maxColumn = Math.min(
      model.moduleCount - 1,
      Math.ceil(plan.backingX + plan.backingWidth) + 1
    );
    const minRow = Math.max(0, Math.floor(plan.backingY) - 1);
    const maxRow = Math.min(
      model.moduleCount - 1,
      Math.ceil(plan.backingY + plan.backingHeight) + 1
    );

    context.imageSmoothingEnabled = false;
    for (let row = minRow; row <= maxRow; row += 1) {
      for (let column = minColumn; column <= maxColumn; column += 1) {
        if (!model.protectedModules[row][column] || model.alignmentModules[row][column]) continue;
        if (!moduleIntersectsRect(
          row,
          column,
          plan.backingX,
          plan.backingY,
          plan.backingWidth,
          plan.backingHeight
        )) continue;
        context.fillStyle = model.originalModules[row][column] ? color : "#ffffff";
        context.fillRect(
          qrStart + (column * moduleSize),
          qrStart + (row * moduleSize),
          moduleSize,
          moduleSize
        );
      }
    }
  }

  function render(
    canvas,
    model,
    color,
    preparedImage,
    plan,
    targetSize = 2048,
    { transparentBackground = false } = {}
  ) {
    const totalModules = model.moduleCount + (QUIET_ZONE_MODULES * 2);
    const moduleSize = Math.max(1, Math.floor(targetSize / totalModules));
    const canvasSize = totalModules * moduleSize;
    canvas.width = canvasSize;
    canvas.height = canvasSize;

    // Always create an alpha-capable context so the background option can be
    // changed after the first render. White output is painted explicitly.
    const context = getContext(canvas, { alpha: true, willReadFrequently: false });
    drawBaseQr(context, model, color, moduleSize, transparentBackground);
    if (preparedImage && plan) {
      drawLogo(context, model, preparedImage, plan, color, moduleSize);
    }

    return Object.freeze({ moduleSize, canvasSize, transparentBackground });
  }

  function escapeXml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  }

  function formatNumber(value) {
    return Number(value.toFixed(4)).toString();
  }

  function makeModulePath(model, predicate, bounds = {}) {
    const minRow = Math.max(0, bounds.minRow ?? 0);
    const maxRow = Math.min(model.moduleCount - 1, bounds.maxRow ?? model.moduleCount - 1);
    const minColumn = Math.max(0, bounds.minColumn ?? 0);
    const maxColumn = Math.min(
      model.moduleCount - 1,
      bounds.maxColumn ?? model.moduleCount - 1
    );
    const commands = [];

    for (let row = minRow; row <= maxRow; row += 1) {
      let runStart = -1;
      for (let column = minColumn; column <= maxColumn + 1; column += 1) {
        const included = column <= maxColumn && predicate(row, column);
        if (included && runStart < 0) runStart = column;
        if (!included && runStart >= 0) {
          const x = runStart + QUIET_ZONE_MODULES;
          const y = row + QUIET_ZONE_MODULES;
          const width = column - runStart;
          commands.push(`M${x} ${y}h${width}v1h-${width}z`);
          runStart = -1;
        }
      }
    }

    return commands.join("");
  }

  function preparedImageDataUrl(preparedImage) {
    const scale = Math.min(
      1,
      SVG_EMBEDDED_IMAGE_MAX_SIDE / Math.max(preparedImage.width, preparedImage.height)
    );
    if (scale >= 1) return preparedImage.canvas.toDataURL("image/png");

    const width = Math.max(1, Math.round(preparedImage.width * scale));
    const height = Math.max(1, Math.round(preparedImage.height * scale));
    const canvas = makeCanvas();
    canvas.width = width;
    canvas.height = height;
    const context = getContext(canvas, { alpha: true });
    context.clearRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(preparedImage.canvas, 0, 0, width, height);
    return canvas.toDataURL("image/png");
  }

  function toSvg(
    model,
    color,
    preparedImage,
    plan,
    { transparentBackground = false, finalUrl = "" } = {}
  ) {
    const totalModules = model.moduleCount + (QUIET_ZONE_MODULES * 2);
    const title = "Marin Links code";
    const description = finalUrl
      ? `QR code for ${finalUrl}`
      : "QR code for the final link.";
    const lines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalModules} ${totalModules}" width="2048" height="2048" role="img" aria-labelledby="marin-links-title marin-links-description" data-background="${transparentBackground ? "transparent" : "white"}">`,
      `  <title id="marin-links-title">${escapeXml(title)}</title>`,
      `  <desc id="marin-links-description">${escapeXml(description)}</desc>`
    ];

    if (!transparentBackground) {
      lines.push(`  <rect id="qr-background" width="${totalModules}" height="${totalModules}" fill="#ffffff"/>`);
    }

    const basePath = makeModulePath(
      model,
      (row, column) => model.originalModules[row][column]
    );
    if (basePath) {
      lines.push(`  <path id="qr-modules" d="${basePath}" fill="${escapeXml(color)}" shape-rendering="crispEdges"/>`);
    }

    if (preparedImage && plan) {
      const backingX = QUIET_ZONE_MODULES + plan.backingX;
      const backingY = QUIET_ZONE_MODULES + plan.backingY;
      const imageX = QUIET_ZONE_MODULES + plan.imageX;
      const imageY = QUIET_ZONE_MODULES + plan.imageY;
      const backingRadius = Math.max(
        0.75,
        Math.min(plan.backingWidth, plan.backingHeight) * 0.08
      );
      const imageRadius = Math.max(
        0.3,
        Math.min(plan.imageWidth, plan.imageHeight) * 0.06
      );
      const bounds = {
        minRow: Math.floor(plan.backingY) - 1,
        maxRow: Math.ceil(plan.backingY + plan.backingHeight) + 1,
        minColumn: Math.floor(plan.backingX) - 1,
        maxColumn: Math.ceil(plan.backingX + plan.backingWidth) + 1
      };
      const coveredProtected = (row, column) => (
        model.protectedModules[row][column]
        && !model.alignmentModules[row][column]
        && moduleIntersectsRect(
          row,
          column,
          plan.backingX,
          plan.backingY,
          plan.backingWidth,
          plan.backingHeight
        )
      );
      const lightProtectedPath = makeModulePath(
        model,
        (row, column) => coveredProtected(row, column) && !model.originalModules[row][column],
        bounds
      );
      const darkProtectedPath = makeModulePath(
        model,
        (row, column) => coveredProtected(row, column) && model.originalModules[row][column],
        bounds
      );
      const imageData = preparedImageDataUrl(preparedImage);

      lines.push(
        "  <defs>",
        `    <clipPath id="marin-links-logo-clip"><rect x="${formatNumber(imageX)}" y="${formatNumber(imageY)}" width="${formatNumber(plan.imageWidth)}" height="${formatNumber(plan.imageHeight)}" rx="${formatNumber(imageRadius)}"/></clipPath>`,
        "  </defs>",
        `  <rect id="logo-backing" x="${formatNumber(backingX)}" y="${formatNumber(backingY)}" width="${formatNumber(plan.backingWidth)}" height="${formatNumber(plan.backingHeight)}" rx="${formatNumber(backingRadius)}" fill="#ffffff"/>`,
        `  <image id="center-image" x="${formatNumber(imageX)}" y="${formatNumber(imageY)}" width="${formatNumber(plan.imageWidth)}" height="${formatNumber(plan.imageHeight)}" href="${imageData}" preserveAspectRatio="none" clip-path="url(#marin-links-logo-clip)"/>`
      );
      if (lightProtectedPath) {
        lines.push(`  <path d="${lightProtectedPath}" fill="#ffffff" shape-rendering="crispEdges"/>`);
      }
      if (darkProtectedPath) {
        lines.push(`  <path d="${darkProtectedPath}" fill="${escapeXml(color)}" shape-rendering="crispEdges"/>`);
      }
    }

    lines.push("</svg>");
    return `${lines.join("\n")}\n`;
  }

  function makeCandidate(model, preparedImage, longSide) {
    const ratio = preparedImage.width / preparedImage.height;
    let imageWidth;
    let imageHeight;

    if (ratio >= 1) {
      imageWidth = longSide;
      imageHeight = longSide / ratio;
    } else {
      imageHeight = longSide;
      imageWidth = longSide * ratio;
    }

    const backingWidth = imageWidth + (IMAGE_PADDING_MODULES * 2);
    const backingHeight = imageHeight + (IMAGE_PADDING_MODULES * 2);
    return Object.freeze({
      longSide,
      backingWidth,
      backingHeight,
      backingX: (model.moduleCount - backingWidth) / 2,
      backingY: (model.moduleCount - backingHeight) / 2,
      imageWidth,
      imageHeight,
      imageX: (model.moduleCount - imageWidth) / 2,
      imageY: (model.moduleCount - imageHeight) / 2
    });
  }

  function candidateFitsLimits(model, candidate) {
    const maxWidth = model.moduleCount * MAX_BACKING_WIDTH_FRACTION;
    const maxHeight = model.moduleCount * MAX_BACKING_HEIGHT_FRACTION;
    const maxArea = model.moduleCount * model.moduleCount * MAX_BACKING_AREA_FRACTION;
    return candidate.backingWidth <= maxWidth
      && candidate.backingHeight <= maxHeight
      && candidate.backingWidth * candidate.backingHeight <= maxArea;
  }

  function findMaximumLongSide(model, preparedImage) {
    let maximum = 0;
    const limit = model.moduleCount * Math.max(
      MAX_BACKING_WIDTH_FRACTION,
      MAX_BACKING_HEIGHT_FRACTION
    );
    for (let longSide = MIN_IMAGE_LONG_SIDE_MODULES; longSide <= limit; longSide += 0.25) {
      const candidate = makeCandidate(model, preparedImage, longSide);
      if (candidateFitsLimits(model, candidate)) maximum = longSide;
    }
    return maximum;
  }

  function channelToLinear(value) {
    const channel = value / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  }

  function pixelLuminance(data, index) {
    return (0.2126 * channelToLinear(data[index]))
      + (0.7152 * channelToLinear(data[index + 1]))
      + (0.0722 * channelToLinear(data[index + 2]));
  }

  function colorLuminance(hex) {
    const red = parseInt(hex.slice(1, 3), 16);
    const green = parseInt(hex.slice(3, 5), 16);
    const blue = parseInt(hex.slice(5, 7), 16);
    const data = new Uint8ClampedArray([red, green, blue, 255]);
    return pixelLuminance(data, 0);
  }

  function moduleLooksDark(pixels, canvasWidth, moduleSize, row, column, threshold) {
    const baseX = (column + QUIET_ZONE_MODULES) * moduleSize;
    const baseY = (row + QUIET_ZONE_MODULES) * moduleSize;
    const fractions = [0.28, 0.5, 0.72];
    let luminance = 0;
    let samples = 0;

    fractions.forEach((yFraction) => {
      fractions.forEach((xFraction) => {
        const x = Math.min(
          canvasWidth - 1,
          Math.max(0, Math.floor(baseX + (moduleSize * xFraction)))
        );
        const y = Math.min(
          canvasWidth - 1,
          Math.max(0, Math.floor(baseY + (moduleSize * yFraction)))
        );
        const index = ((y * canvasWidth) + x) * 4;
        luminance += pixelLuminance(pixels, index);
        samples += 1;
      });
    });

    return (luminance / samples) < threshold;
  }

  function verifyAtSize(model, preparedImage, candidate, color, moduleSize) {
    const canvas = makeCanvas();
    const totalModules = model.moduleCount + (QUIET_ZONE_MODULES * 2);
    const canvasSize = totalModules * moduleSize;
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const context = getContext(canvas, { alpha: false, willReadFrequently: true });
    drawBaseQr(context, model, color, moduleSize);
    drawLogo(context, model, preparedImage, candidate, color, moduleSize);

    const imageData = context.getImageData(0, 0, canvasSize, canvasSize);
    const threshold = (1 + colorLuminance(color)) / 2;
    const changedByBlock = model.blockLimits.map(() => new Set());
    let changedModules = 0;

    for (let row = 0; row < model.moduleCount; row += 1) {
      for (let column = 0; column < model.moduleCount; column += 1) {
        const codewordIndex = model.codewordByModule[row][column];
        if (codewordIndex < 0) continue;
        const effectiveDark = moduleLooksDark(
          imageData.data,
          canvasSize,
          moduleSize,
          row,
          column,
          threshold
        );
        if (effectiveDark === model.originalModules[row][column]) continue;
        changedModules += 1;
        const blockIndex = model.codewordBlocks[codewordIndex];
        if (Number.isInteger(blockIndex)) {
          changedByBlock[blockIndex].add(codewordIndex);
        }
      }
    }

    const blockUsage = changedByBlock.map((items, blockIndex) => Object.freeze({
      changedCodewords: items.size,
      safeLimit: model.blockLimits[blockIndex].safeLimit,
      correctionCapacity: model.blockLimits[blockIndex].correctionCapacity,
      usage: items.size / model.blockLimits[blockIndex].safeLimit
    }));
    const valid = blockUsage.every((block) => block.changedCodewords <= block.safeLimit);
    const maximumUsage = blockUsage.length
      ? Math.max(...blockUsage.map((block) => block.usage))
      : 0;

    return Object.freeze({
      valid,
      moduleSize,
      changedModules,
      maximumUsage,
      blockUsage
    });
  }

  function abortError() {
    const error = new Error("QR image check was replaced by a newer request.");
    error.name = "AbortError";
    return error;
  }

  function yieldToBrowser() {
    return new Promise((resolve) => window.setTimeout(resolve, 0));
  }

  async function verifyCandidate(model, preparedImage, candidate, color, shouldCancel) {
    const checks = [];
    for (const moduleSize of TEST_MODULE_SIZES) {
      if (shouldCancel?.()) throw abortError();
      checks.push(verifyAtSize(model, preparedImage, candidate, color, moduleSize));
      await yieldToBrowser();
    }
    return Object.freeze({
      valid: checks.every((check) => check.valid),
      checks,
      maximumUsage: Math.max(...checks.map((check) => check.maximumUsage))
    });
  }

  async function findLargestLogoPlan(
    model,
    preparedImage,
    color,
    { shouldCancel } = {}
  ) {
    const maximumLongSide = findMaximumLongSide(model, preparedImage);
    if (maximumLongSide < MIN_IMAGE_LONG_SIDE_MODULES) return null;

    let passing = null;
    let attempts = 0;
    for (
      let longSide = maximumLongSide;
      longSide >= MIN_IMAGE_LONG_SIDE_MODULES;
      longSide -= CANDIDATE_STEP_MODULES
    ) {
      if (shouldCancel?.()) throw abortError();
      const candidate = makeCandidate(model, preparedImage, longSide);
      const verification = await verifyCandidate(
        model,
        preparedImage,
        candidate,
        color,
        shouldCancel
      );
      attempts += 1;
      if (verification.valid) {
        passing = { candidate, verification };
        break;
      }
      if (attempts % 3 === 0) await yieldToBrowser();
    }

    if (!passing) return null;

    const reduction = Math.max(
      CANDIDATE_STEP_MODULES,
      passing.candidate.longSide * FINAL_SAFETY_REDUCTION
    );
    let finalLongSide = Math.max(
      MIN_IMAGE_LONG_SIDE_MODULES,
      passing.candidate.longSide - reduction
    );
    let finalCandidate = makeCandidate(model, preparedImage, finalLongSide);
    let finalVerification = await verifyCandidate(
      model,
      preparedImage,
      finalCandidate,
      color,
      shouldCancel
    );

    while (!finalVerification.valid && finalLongSide > MIN_IMAGE_LONG_SIDE_MODULES) {
      finalLongSide = Math.max(
        MIN_IMAGE_LONG_SIDE_MODULES,
        finalLongSide - CANDIDATE_STEP_MODULES
      );
      finalCandidate = makeCandidate(model, preparedImage, finalLongSide);
      finalVerification = await verifyCandidate(
        model,
        preparedImage,
        finalCandidate,
        color,
        shouldCancel
      );
    }

    if (!finalVerification.valid) return null;
    return Object.freeze({
      ...finalCandidate,
      attempts,
      maximumTestedLongSide: maximumLongSide,
      verification: finalVerification
    });
  }

  window.MarinQrSafety = Object.freeze({
    createModel,
    findLargestLogoPlan,
    render,
    toSvg,
    constants: Object.freeze({
      quietZoneModules: QUIET_ZONE_MODULES,
      maxBackingWidthFraction: MAX_BACKING_WIDTH_FRACTION,
      maxBackingHeightFraction: MAX_BACKING_HEIGHT_FRACTION,
      maxBackingAreaFraction: MAX_BACKING_AREA_FRACTION,
      safeCorrectionFraction: SAFE_CORRECTION_FRACTION,
      svgEmbeddedImageMaxSide: SVG_EMBEDDED_IMAGE_MAX_SIDE
    })
  });
})();
