/**
 * Intercom Triggers
 *
 * Lets any Webflow button/link open the Intercom Messenger. Intercom's snippet
 * (installed via Site settings → Custom code or the Intercom Webflow app)
 * exposes `window.Intercom`; this module just routes clicks to it.
 *
 * Markup:
 *   <a href="mailto:hello@bruce.app" data-intercom="new-message"
 *      data-intercom-message="Hi! I have a question about…">Chat with us</a>
 *
 * Values for data-intercom:
 *   - "new-message"  open the composer for a NEW conversation
 *                    (data-intercom-message prefills the text — handy for
 *                    giving support context per button)
 *   - "messages"     open the conversations list
 *   - anything else  open the Messenger home
 *
 * Keep a real href (mailto / contact page) as the fallback: if Intercom is
 * blocked (ad-blocker, consent not given) or hasn't loaded, the click falls
 * through to it untouched. The listener is delegated so it survives CMS
 * re-renders and an Intercom script that loads after ours — availability is
 * checked at click time, not at init. Pre-boot, `window.Intercom` is
 * Intercom's queue stub, so calls made early are replayed after boot.
 */

const TRIGGER = "[data-intercom]";

document.addEventListener("click", (e) => {
  const target = /** @type {Element | null} */ (e.target);
  const el = target?.closest?.(TRIGGER);
  if (!el) return;
  const intercom = window.Intercom;
  if (typeof intercom !== "function") return;

  e.preventDefault();
  const action = el.getAttribute("data-intercom");
  if (action === "new-message") {
    const message = el.getAttribute("data-intercom-message") || undefined;
    intercom("showNewMessage", message);
  } else if (action === "messages") {
    intercom("showSpace", "messages");
  } else {
    intercom("show");
  }
});
