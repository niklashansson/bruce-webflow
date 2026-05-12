/**
 * Visual Video Component
 *
 * Plyr-based video player with:
 * - Lazy-loading (IntersectionObserver + Swiper-aware deferral)
 * - Aspect-ratio-aware cover sizing across all Lumos variants
 * - State broadcasting to opt-in parent scopes via [data-video="component"]
 * - Source-aspect override for vertical content (Shorts, Reels)
 *
 * Usage in Webflow:
 *   <div class="video_wrap"
 *        data-src="https://youtu.be/..."
 *        data-source-aspect="16/9"   (optional, defaults to 16:9)
 *        data-autoplay                (optional)
 *        data-muted                   (optional, implied by autoplay)
 *        data-loop                    (optional)
 *        data-controls="none|minimal|full"  (default: full)
 *        data-captions="https://.../captions.vtt"  (optional)
 *   >
 *     <div class="video_player"></div>
 *     <div class="video_poster">
 *       <img class="video_poster_image" src="..." />
 *     </div>
 *   </div>
 *
 * Optional parent scope (e.g. on a testimonial card):
 *   <div data-video="component"> ... </div>
 *
 * The scope receives data-video-state="idle|playing|paused|ended"
 * and can style its children accordingly.
 */

// ── Module-level constants ───────────────────────────────────
const DEFAULT_ASPECT = 16 / 9;
const LAZY_ROOT_MARGIN = "200px";
const SWIPER_ACTIVE_CLASSES = [
  "swiper-slide-active",
  "swiper-slide-visible",
  "swiper-slide-next",
  "swiper-slide-prev",
];

const CONTROLS_MAP = {
  full: [
    "play",
    "progress",
    "current-time",
    "mute",
    "volume",
    "captions",
    "settings",
    "pip",
    "airplay",
    "fullscreen",
  ],
  minimal: ["play", "progress", "mute", "fullscreen"],
  none: [],
};

// Pre-compiled regexes
const RE_YOUTUBE = /youtube\.com|youtu\.be/;
const RE_VIMEO = /vimeo\.com/;
const RE_YT_ID =
  /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([^?&#]+)/;
const RE_VIMEO_ID = /vimeo\.com\/(?:video\/)?(\d+)/;

// ── Types ────────────────────────────────────────────────────
/** @typedef {'youtube' | 'vimeo' | 'html5'} Provider */
/** @typedef {'idle' | 'playing' | 'paused' | 'ended'} VideoState */

// ── Helpers ──────────────────────────────────────────────────

/**
 * @param {string} url
 * @returns {Provider}
 */
function detectProvider(url) {
  if (RE_YOUTUBE.test(url)) return "youtube";
  if (RE_VIMEO.test(url)) return "vimeo";
  return "html5";
}

/**
 * @param {string} url
 * @param {Provider} prov
 * @returns {string}
 */
function extractEmbedId(url, prov) {
  if (prov === "youtube") return (url.match(RE_YT_ID) || [])[1] || "";
  if (prov === "vimeo") return (url.match(RE_VIMEO_ID) || [])[1] || "";
  return url;
}

/**
 * Parses a "W/H" aspect string into a number.
 * @param {string | null} str
 * @param {number} fallback
 * @returns {number}
 */
function parseAspect(str, fallback) {
  if (!str || !str.includes("/")) return fallback;
  const parts = str.split("/");
  const w = parseFloat(parts[0]);
  const h = parseFloat(parts[1]);
  return w > 0 && h > 0 ? w / h : fallback;
}

/**
 * @param {string} src
 * @returns {string}
 */
function getMimeType(src) {
  const ext = src.split(".").pop().split("?")[0].toLowerCase();
  if (ext === "webm") return "video/webm";
  if (ext === "ogg") return "video/ogg";
  return "video/mp4";
}

/**
 * @param {HTMLElement} slide
 * @returns {boolean}
 */
function isSwiperSlideActive(slide) {
  for (const cls of SWIPER_ACTIVE_CLASSES) {
    if (slide.classList.contains(cls)) return true;
  }
  return false;
}

// ── Init a single component ──────────────────────────────────

/**
 * @param {HTMLElement} component
 */
function initComponent(component) {
  if (component.dataset.scriptInitialized) return;
  component.dataset.scriptInitialized = "true";

  const playerWrapper = component.querySelector(".video_player");
  if (!playerWrapper) {
    console.warn("Visual Video: .video_player element missing");
    return;
  }

  const posterEl = component.querySelector(".video_poster");
  const scope = component.closest("[data-video='component']");
  const swiperSlide = component.closest(".swiper-slide");

  // ── Props ──────────────────────────────────────────────
  const src = component.getAttribute("data-src") || "";
  if (!src) return;

  const captions = component.getAttribute("data-captions") || "";
  const autoplay = component.hasAttribute("data-autoplay");
  const muted = component.hasAttribute("data-muted") || autoplay;
  const loop = component.hasAttribute("data-loop");
  const controlsValue = component.getAttribute("data-controls") || "full";
  const controlsList = CONTROLS_MAP[controlsValue] || CONTROLS_MAP.full;

  const provider = detectProvider(src);
  const embedId = extractEmbedId(src, provider);
  let videoAspect = parseAspect(
    component.getAttribute("data-source-aspect"),
    DEFAULT_ASPECT,
  );

  // ── State broadcaster ──────────────────────────────────
  /** @type {VideoState | null} */
  let currentState = null;

  /** @param {VideoState} state */
  const setVideoState = (state) => {
    if (state === currentState) return; // skip redundant DOM writes
    currentState = state;
    component.setAttribute("data-video-state", state);
    if (scope) scope.setAttribute("data-video-state", state);
  };

  setVideoState(autoplay ? "playing" : "idle");

  // ── Deferred init: choose strategy based on context ────
  // Strategy A: Inside a Swiper slide → init only when slide
  //   becomes active/visible.
  // Strategy B: Standalone → IntersectionObserver with 200px
  //   margin. Init before the user reaches the video.

  let initialized = false;
  const initOnce = () => {
    if (initialized) return;
    initialized = true;
    initPlayer();
  };

  if (swiperSlide) {
    if (isSwiperSlideActive(swiperSlide)) {
      initOnce();
    } else {
      const slideObserver = new MutationObserver(() => {
        if (isSwiperSlideActive(swiperSlide)) {
          initOnce();
          slideObserver.disconnect();
        }
      });
      slideObserver.observe(swiperSlide, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }
  } else {
    const ioObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            initOnce();
            ioObserver.disconnect();
            break;
          }
        }
      },
      { rootMargin: LAZY_ROOT_MARGIN },
    );
    ioObserver.observe(component);
  }

  // ── Initialize Plyr ────────────────────────────────────
  function initPlayer() {
    /** @type {HTMLElement} */
    let targetEl;

    if (provider === "youtube" || provider === "vimeo") {
      targetEl = document.createElement("div");
      targetEl.dataset.plyrProvider = provider;
      targetEl.dataset.plyrEmbedId = embedId;
    } else {
      targetEl = document.createElement("video");
      targetEl.setAttribute("playsinline", "");
      if (controlsList.length) targetEl.setAttribute("controls", "");

      const sourceEl = document.createElement("source");
      sourceEl.src = src;
      sourceEl.type = getMimeType(src);
      targetEl.appendChild(sourceEl);

      if (captions) {
        const track = document.createElement("track");
        track.kind = "captions";
        track.src = captions;
        track.srclang = "en";
        track.label = "English";
        track.default = true;
        targetEl.appendChild(track);
      }
    }

    playerWrapper.insertBefore(targetEl, playerWrapper.firstChild);

    const player = new Plyr(targetEl, {
      controls: controlsList,
      autoplay,
      muted,
      loop: { active: loop },
      playsinline: true,
      // ratio omitted — wrap dictates aspect, JS handles cover
      youtube: {
        noCookie: true,
        rel: 0,
        showinfo: 0,
        iv_load_policy: 3,
        modestbranding: 1,
        controls: 0,
        disablekb: 1,
        playsinline: 1,
        fs: 0,
        cc_load_policy: 0,
        hl: "en",
        enablejsapi: 1,
      },
      vimeo: {
        byline: false,
        portrait: false,
        title: false,
        transparent: false,
        dnt: true,
      },
    });

    // ── Cover sizing ─────────────────────────────────────
    /** @type {HTMLElement | null} */
    let mediaEl = null;
    let lastW = 0;
    let lastH = 0;
    let rafId = 0;

    const findMediaEl = () => {
      mediaEl = playerWrapper.querySelector("iframe, video");
      return mediaEl;
    };

    const computeAndApply = () => {
      rafId = 0;
      if (!mediaEl && !findMediaEl()) return;

      const rect = component.getBoundingClientRect();
      const wW = rect.width;
      const wH = rect.height;
      if (!wW || !wH) return;

      // Skip if dimensions unchanged
      if (wW === lastW && wH === lastH) return;
      lastW = wW;
      lastH = wH;

      const wrapAspect = wW / wH;
      let tW;
      let tH;
      if (wrapAspect > videoAspect) {
        tW = wW;
        tH = wW / videoAspect;
      } else {
        tH = wH;
        tW = wH * videoAspect;
      }

      // Single style write (one reflow)
      mediaEl.style.cssText +=
        `position:absolute;top:50%;left:50%;` +
        `width:${tW}px;height:${tH}px;` +
        `max-width:none;transform:translate(-50%,-50%);`;
    };

    // rAF-batched scheduler
    const scheduleApply = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(computeAndApply);
    };

    const forceApply = () => {
      lastW = 0;
      lastH = 0;
      scheduleApply();
    };

    forceApply(); // also try synchronously, before Plyr signals ready

    player.on("ready", async () => {
      findMediaEl();
      forceApply();
      if (!autoplay) setVideoState("idle");

      // Vimeo: ask the embed for real source dimensions so cover-sizing
      // uses the actual aspect, not the declared one.
      if (provider === "vimeo") {
        try {
          const embed = /** @type {any} */ (player).embed;
          if (embed && embed.getVideoWidth && embed.getVideoHeight) {
            const [w, h] = await Promise.all([
              embed.getVideoWidth(),
              embed.getVideoHeight(),
            ]);
            if (w > 0 && h > 0) {
              videoAspect = w / h;
              forceApply();
            }
          }
        } catch (_) {
          /* silent */
        }
      }
    });

    // HTML5: auto-detect true source aspect via loadedmetadata
    if (provider === "html5") {
      const v = /** @type {HTMLVideoElement | null} */ (
        playerWrapper.querySelector("video")
      );
      if (v) {
        v.addEventListener(
          "loadedmetadata",
          () => {
            if (v.videoWidth && v.videoHeight) {
              videoAspect = v.videoWidth / v.videoHeight;
              forceApply();
            }
          },
          { once: true },
        );
      }
    }

    // ResizeObserver — re-fits on any wrap size change
    const ro = new ResizeObserver(scheduleApply);
    ro.observe(component);

    player.on("playing", () => setVideoState("playing"));
    player.on("pause", () => setVideoState("paused"));
    player.on("ended", () => {
      setVideoState("ended");
      if (posterEl) posterEl.classList.remove("is-active");
    });

    // ── Poster ───────────────────────────────────────────
    if (posterEl) {
      posterEl.addEventListener("click", () => player.play(), {
        passive: true,
      });
      player.on("playing", () => posterEl.classList.add("is-active"));
      if (autoplay) posterEl.classList.add("is-active");
    }

    // ── Cleanup ──────────────────────────────────────────
    player.on("destroy", () => {
      ro.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    });

    // Expose Plyr instance for external access
    /** @type {any} */ (component)._plyr = player;
  }
}

// ── Public API ───────────────────────────────────────────────

/**
 * Initialize all .video_wrap components currently in the DOM.
 * Safe to call multiple times — already-initialized components are skipped.
 */
export function initVisualVideos() {
  document.querySelectorAll(".video_wrap").forEach((el) => {
    initComponent(/** @type {HTMLElement} */ (el));
  });
}

/**
 * Initialize a specific .video_wrap element. Useful for dynamically inserted
 * components (e.g. after fetching CMS items via Finsweet List Load).
 *
 * @param {HTMLElement} element
 */
export function initVisualVideo(element) {
  if (element && element.classList.contains("video_wrap")) {
    initComponent(element);
  }
}

// ── Auto-boot ────────────────────────────────────────────────
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initVisualVideos, {
    once: true,
  });
} else {
  initVisualVideos();
}
