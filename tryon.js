/**
 * Saubhagya - Virtual Try-On (WebAR, on-device)
 * 2D-sprite approach: MediaPipe FaceMesh tracks face landmarks, the product's
 * transparent cutout (images/tryon/<SKU>.png) is pinned to the earlobes
 * (earrings) or draped below the chin (necklaces), scaled + rotated to head
 * movement. Camera never leaves the device - no upload, no server.
 *
 * Public API: window.SJTryOn.open(product)   product = D1 row (sku, name, category, image)
 *             window.SJTryOn.supported(product) -> bool (cutout may still 404 at load)
 *
 * Lazy: MediaPipe (~2-3MB) loads only on first open().
 */
(function () {
  'use strict';
  var MP_SRC = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js';
  var mpLoading = null;
  var els = {};            // overlay DOM refs
  var running = false;
  var faceMesh = null, camStream = null, rafId = null;
  var sprite = null, spriteReady = false;
  var product = null, mode = 'ear';
  var userScale = 1, userDrop = 0;   // slider state
  var lastLm = null;

  // FaceMesh landmark indices (normalized). Selfie view is CSS-mirrored, so we
  // draw in the model's native coord space and let CSS flip it to match video.
  var L_EAR = 132, R_EAR = 361, L_OVAL = 234, R_OVAL = 454, CHIN = 152,
      L_EYE = 33, R_EYE = 263, FOREHEAD = 10;

  function categoryMode(p) {
    return (p && p.category === 'Necklace') ? 'neck' : 'ear';
  }
  function cutoutUrl(p) {
    var sku = (p && (p.sku || p.id)) || '';
    return 'images/tryon/' + encodeURIComponent(sku) + '.png';
  }

  window.SJTryOn = {
    supported: function () {
      return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    },
    open: open
  };

  function loadMediaPipe() {
    if (window.FaceMesh) return Promise.resolve();
    if (mpLoading) return mpLoading;
    mpLoading = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = MP_SRC; s.crossOrigin = 'anonymous';
      s.onload = function () { res(); };
      s.onerror = function () { rej(new Error('mp-load')); };
      document.head.appendChild(s);
    });
    return mpLoading;
  }

  function buildOverlay() {
    if (els.root) return;
    var r = document.createElement('div');
    r.className = 'sj-tryon';
    r.innerHTML =
      '<div class="sj-to-stage">' +
        '<video class="sj-to-video" playsinline muted autoplay></video>' +
        '<canvas class="sj-to-canvas"></canvas>' +
        '<div class="sj-to-status" role="status"></div>' +
        '<button class="sj-to-close" aria-label="Close try-on">&times;</button>' +
        '<div class="sj-to-brand">Saubhagya · Virtual Try-On</div>' +
      '</div>' +
      '<div class="sj-to-panel">' +
        '<div class="sj-to-row"><span>Size</span>' +
          '<input type="range" class="sj-to-size" min="50" max="180" value="100" aria-label="Jewellery size"></div>' +
        '<div class="sj-to-row"><span>Position</span>' +
          '<input type="range" class="sj-to-drop" min="-40" max="60" value="0" aria-label="Jewellery position"></div>' +
        '<div class="sj-to-btns">' +
          '<button class="sj-to-cap">📸 Capture</button>' +
          '<button class="sj-to-add">Add to Bag</button>' +
        '</div>' +
        '<div class="sj-to-priv">🔒 Your camera runs only on your device. Nothing is recorded or uploaded.</div>' +
      '</div>';
    document.body.appendChild(r);
    els = {
      root: r,
      stage: r.querySelector('.sj-to-stage'),
      video: r.querySelector('.sj-to-video'),
      canvas: r.querySelector('.sj-to-canvas'),
      status: r.querySelector('.sj-to-status'),
      size: r.querySelector('.sj-to-size'),
      drop: r.querySelector('.sj-to-drop'),
      cap: r.querySelector('.sj-to-cap'),
      add: r.querySelector('.sj-to-add')
    };
    els.ctx = els.canvas.getContext('2d');
    r.querySelector('.sj-to-close').addEventListener('click', close);
    els.size.addEventListener('input', function () { userScale = this.value / 100; });
    els.drop.addEventListener('input', function () { userDrop = this.value / 100; });
    els.cap.addEventListener('click', capture);
    els.add.addEventListener('click', function () {
      if (window.SJ_TRYON_ADD) window.SJ_TRYON_ADD(product);
      close();
    });
    document.addEventListener('keydown', escClose);
  }
  function escClose(e) { if (e.key === 'Escape' && running) close(); }

  function setStatus(msg, err) {
    if (!els.status) return;
    els.status.textContent = msg || '';
    els.status.style.display = msg ? 'block' : 'none';
    els.status.classList.toggle('err', !!err);
  }

  function open(p) {
    product = p; mode = categoryMode(p); userScale = 1; userDrop = 0;
    buildOverlay();
    els.root.classList.add('on');
    document.documentElement.style.overflow = 'hidden';
    running = true;
    setStatus('Loading try-on…');
    // load sprite
    spriteReady = false; sprite = new Image(); sprite.crossOrigin = 'anonymous';
    sprite.onload = function () { spriteReady = true; };
    sprite.onerror = function () { spriteReady = false; };
    sprite.src = cutoutUrl(p);

    if (!window.SJTryOn.supported()) { setStatus('Camera not supported on this browser.', true); return; }

    loadMediaPipe().then(startCamera).then(startTracking).catch(function (e) {
      if (e && e.name === 'NotAllowedError') setStatus('Camera permission was blocked. Allow camera access and reopen.', true);
      else if (e && e.name === 'NotFoundError') setStatus('No camera found on this device.', true);
      else if (e && e.message === 'mp-load') setStatus('Could not load the try-on engine. Check your connection.', true);
      else setStatus('Try-on could not start. ' + ((e && e.message) || ''), true);
    });
  }

  function startCamera() {
    return navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } }, audio: false
    }).then(function (stream) {
      camStream = stream;
      els.video.srcObject = stream;
      return els.video.play().catch(function () {});
    });
  }

  function startTracking() {
    setStatus('Point your face at the camera…');
    faceMesh = new window.FaceMesh({ locateFile: function (f) { return 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/' + f; } });
    faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
    faceMesh.onResults(onResults);
    var loop = function () {
      if (!running) return;
      if (els.video.readyState >= 2) {
        faceMesh.send({ image: els.video }).catch(function () {});
      }
      rafId = requestAnimationFrame(loop);
    };
    loop();
  }

  function fitCanvas() {
    var vw = els.video.videoWidth, vh = els.video.videoHeight;
    if (!vw || !vh) return false;
    if (els.canvas.width !== vw || els.canvas.height !== vh) {
      els.canvas.width = vw; els.canvas.height = vh;
    }
    return true;
  }

  function onResults(res) {
    if (!running || !fitCanvas()) return;
    var ctx = els.ctx, W = els.canvas.width, H = els.canvas.height;
    ctx.clearRect(0, 0, W, H);
    var lms = res.multiFaceLandmarks && res.multiFaceLandmarks[0];
    if (!lms) { setStatus('Move into the frame - no face detected.'); return; }
    setStatus('');
    lastLm = lms;
    if (!spriteReady) return;
    drawJewellery(ctx, lms, W, H);
  }

  function px(lm, W, H) { return { x: lm.x * W, y: lm.y * H }; }

  function drawJewellery(ctx, lms, W, H) {
    var lo = px(lms[L_OVAL], W, H), ro = px(lms[R_OVAL], W, H);
    var faceW = Math.hypot(ro.x - lo.x, ro.y - lo.y);
    var le = px(lms[L_EYE], W, H), re = px(lms[R_EYE], W, H);
    var roll = Math.atan2(re.y - le.y, re.x - le.x);   // head tilt

    if (mode === 'neck') {
      var chin = px(lms[CHIN], W, H);
      var fh = Math.hypot(chin.y - px(lms[FOREHEAD], W, H).y, chin.x - px(lms[FOREHEAD], W, H).x);
      var cx = chin.x, cy = chin.y + fh * (0.42 + userDrop);
      var w = faceW * 1.85 * userScale;
      var h = w * (sprite.height / sprite.width);
      blit(ctx, sprite, cx, cy, w, h, roll, 0.5, 0.0);   // anchor top-center
    } else {
      // earrings: draw one half of the pair on each earlobe
      var lE = px(lms[L_EAR], W, H), rE = px(lms[R_EAR], W, H);
      var drop = faceW * (0.06 + userDrop);
      var ew = faceW * 0.30 * userScale;
      var halfW = sprite.width / 2, sh = sprite.height;
      var eh = ew * (sh / halfW);
      // left earlobe uses the sprite's left half, right uses right half
      blitCrop(ctx, sprite, 0, 0, halfW, sh, lE.x, lE.y + drop, ew, eh, roll, 0.5, 0.0);
      blitCrop(ctx, sprite, halfW, 0, halfW, sh, rE.x, rE.y + drop, ew, eh, roll, 0.5, 0.0);
    }
  }

  // draw whole image, anchored (ax,ay) in 0..1 of its box, rotated by rot
  function blit(ctx, img, x, y, w, h, rot, ax, ay) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.drawImage(img, -w * ax, -h * ay, w, h); ctx.restore();
  }
  // draw a source-cropped region of the image
  function blitCrop(ctx, img, sx, sy, sw, sh, x, y, w, h, rot, ax, ay) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.drawImage(img, sx, sy, sw, sh, -w * ax, -h * ay, w, h); ctx.restore();
  }

  function capture() {
    if (!fitCanvas()) return;
    var W = els.canvas.width, H = els.canvas.height;
    var out = document.createElement('canvas'); out.width = W; out.height = H;
    var o = out.getContext('2d');
    // mirror to match the selfie view, then composite video + jewellery
    o.translate(W, 0); o.scale(-1, 1);
    o.drawImage(els.video, 0, 0, W, H);
    o.drawImage(els.canvas, 0, 0);
    o.setTransform(1, 0, 0, 1, 0, 0);
    // watermark
    o.font = '600 ' + Math.round(H * 0.028) + 'px Montserrat, sans-serif';
    o.fillStyle = 'rgba(255,255,255,.85)';
    o.fillText('Saubhagya', W * 0.04, H * 0.95);
    var url = out.toDataURL('image/png');
    var a = document.createElement('a');
    a.href = url; a.download = 'saubhagya-tryon-' + ((product && (product.sku || product.id)) || 'look') + '.png';
    a.click();
    setStatus('Saved your look 📸');
    setTimeout(function () { if (running) setStatus(''); }, 1600);
  }

  function close() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId), rafId = null;
    if (faceMesh && faceMesh.close) { try { faceMesh.close(); } catch (e) {} }
    faceMesh = null;
    if (camStream) { camStream.getTracks().forEach(function (t) { t.stop(); }); camStream = null; }
    if (els.video) els.video.srcObject = null;
    if (els.root) els.root.classList.remove('on');
    document.documentElement.style.overflow = '';
  }
})();
