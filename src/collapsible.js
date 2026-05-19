/**
 * Collapsible Component
 *
 * Independent expand/collapse region. Each `.collapsible_wrap` owns a single
 * `.collapsible_trigger` and a single `.collapsible_content`. Clicking the
 * trigger toggles the content with a Web Animations API height tween.
 *
 * For grouped expand/collapse with "close previous" behavior, use
 * `accordion.js` instead — this module intentionally has no group logic.
 *
 * Per-wrap data attributes (all optional, all on `.collapsible_wrap`):
 *   - data-open-by-default="True"   start in the open state (no animation)
 *   - data-open-on-hover="True"     mouseenter on trigger also opens
 *                                    (close still requires a click)
 *   - data-duration="<seconds>"     override animation duration (default 0.3)
 *   - data-collapsible-id="<key>"   broadcast the `is-active` class onto every
 *                                    `[data-component="collapsible"]
 *                                     [data-collapsible-id="<key>"]` element
 *                                    on the page (one-way mirror, for styling)
 *
 * Nesting: a `.collapsible_wrap` inside another wrap's `.collapsible_content`
 * works — each wrap resolves only its own direct trigger and content, so
 * nested triggers don't toggle the outer wrap.
 *
 * Webflow markup:
 *   <div class="collapsible_wrap"
 *        data-open-by-default="True"
 *        data-open-on-hover="True"
 *        data-duration="0.4"
 *        data-collapsible-id="faq-1">
 *     <button class="collapsible_trigger">…</button>
 *     <div class="collapsible_content">…</div>
 *   </div>
 *
 *   <!-- anywhere else on the page -->
 *   <div data-component="collapsible" data-collapsible-id="faq-1">…</div>
 */

import { attrBool, attrNum } from "./utils.js";

// ── Module-level constants ───────────────────────────────────
const DEFAULT_DURATION_S = 0.3;
const EASING = "ease-in-out";

// ── Init ─────────────────────────────────────────────────────

/** Initialize all `.collapsible_wrap` elements. Safe to call multiple times. */
export function initCollapsible() {
  document
    .querySelectorAll(".collapsible_wrap")
    .forEach((wrapEl, wrapIndex) => {
      const wrap = /** @type {HTMLElement} */ (wrapEl);
      if (wrap.dataset.scriptInitialized) return;
      wrap.dataset.scriptInitialized = "true";

      // Resolve the trigger/content that belong to THIS wrap — skip any
      // descendants that live inside a nested .collapsible_wrap.
      const own = (selector) =>
        [...wrap.querySelectorAll(selector)].find(
          (el) => el.closest(".collapsible_wrap") === wrap,
        );

      const trigger = /** @type {HTMLElement | undefined} */ (
        own(".collapsible_trigger")
      );
      const content = /** @type {HTMLElement | undefined} */ (
        own(".collapsible_content")
      );

      if (!trigger || !content) {
        console.warn("Missing elements:", wrap);
        return;
      }

      const openByDefault = attrBool(wrap, "data-open-by-default");
      const openOnHover = attrBool(wrap, "data-open-on-hover");
      const rawDuration = attrNum(wrap, "data-duration", DEFAULT_DURATION_S);
      const durationMs =
        (rawDuration > 0 ? rawDuration : DEFAULT_DURATION_S) * 1000;

      trigger.id = `collapsible_trigger_${wrapIndex}`;
      content.id = `collapsible_content_${wrapIndex}`;
      trigger.setAttribute("aria-controls", content.id);
      content.setAttribute("aria-labelledby", trigger.id);
      trigger.setAttribute("aria-expanded", "false");
      content.style.display = "none";
      content.style.overflow = "hidden";

      // Re-query on each transition so mirrors injected later (CMS, modals,
      // etc.) still pick up state changes. Selector is built once at init.
      const mirrorId = wrap.getAttribute("data-collapsible-id");
      const mirrorSelector = mirrorId
        ? `[data-component="collapsible"][data-collapsible-id="${CSS.escape(mirrorId)}"]`
        : null;
      const getMirrors = () =>
        mirrorSelector ? document.querySelectorAll(mirrorSelector) : [];

      /** @type {Animation | null} */
      let currentAnimation = null;

      // Commit the in-flight animation's current value to inline style, then
      // cancel it — lets the next animation resume from where this one was
      // visually, rather than snapping back to the underlying inline value.
      const stopCurrent = () => {
        if (!currentAnimation) return 0;
        try {
          currentAnimation.commitStyles();
        } catch (_) {
          /* commitStyles fails if the element is detached — ignore */
        }
        currentAnimation.cancel();
        currentAnimation = null;
        return parseFloat(content.style.height) || 0;
      };

      const animateTo = (fromPx, toPx, onDone) => {
        content.style.height = `${fromPx}px`;
        const anim = content.animate(
          [{ height: `${fromPx}px` }, { height: `${toPx}px` }],
          { duration: durationMs, easing: EASING, fill: "forwards" },
        );
        currentAnimation = anim;
        anim.onfinish = () => {
          if (currentAnimation !== anim) return;
          currentAnimation = null;
          onDone();
        };
      };

      const open = (instant = false) => {
        wrap.classList.add("is-active");
        trigger.setAttribute("aria-expanded", "true");
        getMirrors().forEach((m) => m.classList.add("is-active"));

        const from = stopCurrent();
        content.style.display = "block";

        if (instant) {
          content.style.height = "";
          return;
        }

        content.style.height = "auto";
        const to = content.scrollHeight;

        animateTo(from, to, () => {
          content.style.height = "";
        });
      };

      const close = () => {
        if (!wrap.classList.contains("is-active")) return;
        wrap.classList.remove("is-active");
        trigger.setAttribute("aria-expanded", "false");
        getMirrors().forEach((m) => m.classList.remove("is-active"));

        const from = currentAnimation
          ? stopCurrent()
          : content.getBoundingClientRect().height;

        animateTo(from, 0, () => {
          content.style.height = "";
          content.style.display = "none";
        });
      };

      const toggle = () => {
        if (wrap.classList.contains("is-active")) close();
        else open();
      };

      if (openByDefault) open(true);

      trigger.addEventListener("click", toggle);
      if (openOnHover) trigger.addEventListener("mouseenter", () => open());
    });
}

// ── Auto-boot ────────────────────────────────────────────────
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCollapsible, {
    once: true,
  });
} else {
  initCollapsible();
}
