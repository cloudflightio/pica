// Web Worker wrapper for image resize function

'use strict';

module.exports = function () {
  const MathLib = require('./mathlib');

  let mathLib;

  /* eslint-disable no-undef */
  onmessage = function (ev) {
    let tileOpts = ev.data.opts;
    let returnBitmap = false;

    if (!tileOpts.src && tileOpts.srcBitmap) {
      let canvas = new OffscreenCanvas(tileOpts.width, tileOpts.height);
      let ctx = canvas.getContext('2d');
      ctx.drawImage(tileOpts.srcBitmap, 0, 0);
      tileOpts.src = ctx.getImageData(0, 0, tileOpts.width, tileOpts.height).data;
      canvas.width = canvas.height = 0;
      canvas = null;
      tileOpts.srcBitmap.close();
      tileOpts.srcBitmap = null;
      // Temporary force out data to typed array, because Chrome have artefacts
      // https://github.com/nodeca/pica/issues/223
      // returnBitmap = true;
    }

    if (!mathLib) mathLib = new MathLib(ev.data.features);

    // Use multimath's sync auto-init. Avoid Promise use in old browsers,
    // because polyfills are not propagated to webworker.
    let data = mathLib.resizeAndUnsharp(tileOpts);

    // In a new Chrome version (104.*) a memory leak was introduced where the transferred ArrayBuffer does not get GCed.
    // https://bugs.chromium.org/p/chromium/issues/detail?id=1356332&q=transferable&can=2
    // To work around this, we just send it back again. Then GC kicks in as it should:
    // https://stackoverflow.com/questions/72480480/memory-leak-javascript-passing-array-buffer-to-web-worker-using-transferable
    let transfer = [ tileOpts.src.buffer ];

    if (returnBitmap) {
      let toImageData = new ImageData(new Uint8ClampedArray(data), tileOpts.toWidth, tileOpts.toHeight);
      let canvas = new OffscreenCanvas(tileOpts.toWidth, tileOpts.toHeight);
      let ctx = canvas.getContext('2d');

      ctx.putImageData(toImageData, 0, 0);

      createImageBitmap(canvas).then(bitmap => {
        transfer.push(bitmap);
        postMessage({ bitmap }, transfer);
      });
    } else {
      transfer.push(data.buffer);
      postMessage({ data }, transfer);
    }
  };
};
