/**
 * Modal Component
 *
 * Activates `<dialog data-modal-element="dialog">` elements with Web Animations
 * API open/close animations. The `data-wf--modal--variant` attribute picks the
 * animation style — "side-panel", "full-screen", or default (centered).
 *
 * Triggers:
 *   - Elements: [data-modal-trigger="<id>"]
 *   - Anchors:  a[href="#<id>"]
 *   - URL:      ?modal-id=<id> on initial load (param is stripped after open)
 *
 * Optional integrations (detected at runtime — no hard dependency):
 *   - lenis for scroll-lock
 *
 * Exposes a global registry at `window.bruce.modal`:
 *   open(id), closeAll(), list (per-id { open, close })
 *
 * Webflow markup (style with whatever classes you want):
 *   <dialog data-modal-element="dialog"
 *           data-modal-target="my-id"
 *           data-wf--modal--variant="side-panel">
 *     <div data-modal-element="backdrop" data-modal-close></div>
 *     <div data-modal-element="content">
 *       <div data-modal-element="slot">…</div>
 *     </div>
 *   </dialog>
 */

const M = {
  dialog: '[data-modal-element="dialog"]',
  backdrop: '[data-modal-element="backdrop"]',
  content: '[data-modal-element="content"]',
  slot: '[data-modal-element="slot"]',
};

const VARIANT = {
  SIDE_PANEL: "side-panel",
  FULL_SCREEN: "full-screen",
};

const EASING_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";

// Per-variant animation specs in the OPEN direction. Each entry pairs an
// element with the keyframes that take it from its closed pose to its open
// pose. Closing reverses the same animations in place via playbackRate.
function buildSpecs(variant, backdrop, content, slot) {
  if (variant === VARIANT.SIDE_PANEL) {
    return [
      backdrop && {
        el: backdrop,
        kf: [{ opacity: 0 }, { opacity: 1 }],
        opts: { duration: 300, easing: EASING_OUT },
      },
      content && {
        el: content,
        kf: [{ transform: "translateX(100%)" }, { transform: "translateX(0)" }],
        opts: { duration: 300, easing: EASING_OUT },
      },
    ].filter(Boolean);
  }
  if (variant === VARIANT.FULL_SCREEN) {
    return [
      // Backdrop stays hidden for full-screen — the content covers the viewport.
      backdrop && {
        el: backdrop,
        kf: [{ opacity: 0 }, { opacity: 0 }],
        opts: { duration: 200 },
      },
      content && {
        el: content,
        kf: [{ opacity: 0 }, { opacity: 1 }],
        opts: { duration: 200, easing: EASING_OUT },
      },
      slot && {
        el: slot,
        kf: [
          { opacity: 0, transform: "translateY(2rem)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        opts: { duration: 200, delay: 100, easing: EASING_OUT },
      },
    ].filter(Boolean);
  }
  // default — centered. Subtle fade + small rise from below.
  return [
    backdrop && {
      el: backdrop,
      kf: [{ opacity: 0 }, { opacity: 1 }],
      opts: { duration: 300, easing: EASING_OUT },
    },
    content && {
      el: content,
      kf: [
        { opacity: 0, transform: "translateY(8px) scale(0.97)" },
        { opacity: 1, transform: "translateY(0) scale(1)" },
      ],
      opts: { duration: 300, easing: EASING_OUT },
    },
  ].filter(Boolean);
}

// ── Global registry ──────────────────────────────────────────
/** @type {any} */ (window).bruce ||= {};
const modalSystem = /** @type {any} */ ((window).bruce.modal ??= {
  list: {},
  open(id) {
    this.list[id]?.open?.();
  },
  closeAll() {
    Object.values(this.list).forEach((m) => m.close?.());
  },
});

// ── Delegated trigger click ──────────────────────────────────
// One document-level listener routes every [data-modal-trigger] / a[href="#id"]
// click to the matching modal — adding a per-modal listener inside initModals
// would multiply work on every page click.
let triggerListenerAttached = false;
function attachTriggerListener() {
  if (triggerListenerAttached) return;
  triggerListenerAttached = true;
  document.addEventListener("click", (e) => {
    const target = /** @type {Element | null} */ (e.target);
    if (!target) return;
    const trigger = target.closest("[data-modal-trigger], a[href^='#']");
    if (!trigger) return;
    const id =
      trigger.getAttribute("data-modal-trigger") ||
      trigger.getAttribute("href")?.slice(1);
    if (!id || !modalSystem.list[id]) return;
    if (trigger.tagName === "A") e.preventDefault();
    modalSystem.open(id);
  });
}

// ── Init ─────────────────────────────────────────────────────

/** Initialize all modal dialogs. Safe to call multiple times. */
export function initModals() {
  attachTriggerListener();
  document.querySelectorAll(M.dialog).forEach((modal) => {
    const el = /** @type {HTMLDialogElement} */ (modal);
    if (el.dataset.scriptInitialized) return;
    el.dataset.scriptInitialized = "true";

    const modalId = el.getAttribute("data-modal-target");
    const variant = el.getAttribute("data-wf--modal--variant");
    const contentEl = /** @type {HTMLElement | null} */ (
      el.querySelector(M.content)
    );
    // Anchor the default-variant scale to the bottom edge so the content
    // rises upward into place. No effect on translate-only variants.
    if (contentEl) contentEl.style.transformOrigin = "center bottom";
    const specs = buildSpecs(
      variant,
      el.querySelector(M.backdrop),
      contentEl,
      el.querySelector(M.slot),
    );
    const scrollResetEls = el.querySelectorAll("[data-modal-scroll]");
    let lastFocusedElement;

    /** @type {Animation[]} */
    let animations = [];
    /** @type {"open" | "close" | null} */
    let direction = null;
    // Bumped on every playClose so any stacked `.finished` handler from an
    // earlier call can detect that it's stale and bail — prevents resetModal
    // from running twice (duplicate modal-close events, duplicate focus).
    let closeToken = 0;

    const playOpen = () => {
      if (direction === "open") return;
      if (direction === "close") {
        animations.forEach((a) => {
          a.playbackRate = 1;
        });
        direction = "open";
        return;
      }
      animations = specs.map((s) =>
        s.el.animate(s.kf, { ...s.opts, fill: "forwards" }),
      );
      direction = "open";
    };

    const playClose = (onComplete) => {
      if (direction === "close") return; // an in-flight close handler will finish it
      if (direction === "open") {
        animations.forEach((a) => {
          a.playbackRate = -1;
        });
      } else {
        animations = specs.map((s) =>
          s.el.animate([s.kf[1], s.kf[0]], { ...s.opts, fill: "forwards" }),
        );
      }
      direction = "close";

      if (animations.length === 0) {
        onComplete();
        return;
      }
      const myToken = ++closeToken;
      Promise.all(animations.map((a) => a.finished.catch(() => null))).then(
        () => {
          if (myToken !== closeToken || direction !== "close") return;
          // Call onComplete (which hides the dialog) BEFORE cancelling so the
          // user never sees the brief frame where animation effects are
          // released but the dialog is still visible.
          onComplete();
          animations.forEach((a) => a.cancel());
          animations = [];
          direction = null;
        },
      );
    };

    function resetModal() {
      if (typeof lenis !== "undefined" && lenis.start) lenis.start();
      else document.body.style.overflow = "";
      el.close();
      if (lastFocusedElement) lastFocusedElement.focus();
      window.dispatchEvent(
        new CustomEvent("modal-close", { detail: { modal: el } }),
      );
    }

    function openModal() {
      if (typeof lenis !== "undefined" && lenis.stop) lenis.stop();
      else document.body.style.overflow = "hidden";
      lastFocusedElement = document.activeElement;
      el.showModal();
      playOpen();
      scrollResetEls.forEach((s) => (s.scrollTop = 0));
      window.dispatchEvent(
        new CustomEvent("modal-open", { detail: { modal: el } }),
      );
    }

    function closeModal() {
      playClose(resetModal);
    }

    // Open via ?modal-id=… on initial load, then strip the param.
    if (
      modalId &&
      new URLSearchParams(location.search).get("modal-id") === modalId
    ) {
      openModal();
      const url = new URL(location.href);
      url.searchParams.delete("modal-id");
      history.replaceState({}, "", url);
    }

    el.addEventListener("cancel", (e) => {
      e.preventDefault();
      closeModal();
    });
    el.addEventListener("click", (e) => {
      if (/** @type {Element} */ (e.target).closest("[data-modal-close]"))
        closeModal();
    });

    if (modalId) {
      modalSystem.list[modalId] = { open: openModal, close: closeModal };
    }
  });
}

// ── Auto-boot ────────────────────────────────────────────────
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initModals, { once: true });
} else {
  initModals();
}
