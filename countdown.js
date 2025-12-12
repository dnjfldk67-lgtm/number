(function () {
  const GSAP_CDN = "https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js";

  function loadScript(src, cb, errCb) {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => cb && cb();
    s.onerror = (e) => errCb && errCb(e);
    document.head.appendChild(s);
  }

  function ensureGSAP() {
    return new Promise((resolve, reject) => {
      if (window.gsap) return resolve(window.gsap);
      loadScript(GSAP_CDN, () => resolve(window.gsap), reject);
    });
  }

  function $(id) { return document.getElementById(id); }

  function dispatchDoneEvent() {
    try {
      document.dispatchEvent(new CustomEvent("countdown:done"));
    } catch (_) {
      const evt = document.createEvent("Event");
      evt.initEvent("countdown:done", true, true);
      document.dispatchEvent(evt);
    }
  }

  function countdown321({ overlayEl, numEl, onDone }) {
    overlayEl.style.display = "grid";

    const tl = window.gsap.timeline({
      defaults: { ease: "power2.out" },
      onComplete: () => {
        overlayEl.style.display = "none";
        onDone && onDone();
      },
    });

    [3, 2, 1].forEach((n) => {
      tl.call(() => { numEl.textContent = String(n); })
        .fromTo(numEl, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.18 })
        .to(numEl, { opacity: 0, scale: 1.25, duration: 0.22 }, "+=0.38");
    });

    return tl;
  }

  let running = false;

  async function init() {
    const startBtn = $("startBtn");
    const overlay = $("cdOverlay");
    const numEl = $("cdNum");

    if (!startBtn || !overlay || !numEl) {
      console.error("[Countdown321] 필요한 DOM이 없습니다: startBtn/cdOverlay/cdNum");
      return;
    }

    await ensureGSAP();

    startBtn.addEventListener("click", () => {
      if (running) return;
      running = true;

      countdown321({
        overlayEl: overlay,
        numEl,
        onDone: () => {
          running = false;

          // 1) 전역 콜백
          if (typeof window.afterCountdown === "function") {
            try { window.afterCountdown(); } catch (e) { console.error(e); }
          }

          // 2) 커스텀 이벤트
          dispatchDoneEvent();
        },
      });
    });
  }

  window.Countdown321 = { init };
})();
