// App Launcher — click-to-open with platform-aware routing.
//
// Desktop → opens the webapp URL in a new tab.
// iOS (iPhone, iPad, iPod — including iPadOS 13+ masquerading as desktop
//   Safari) → attempts to open the native app; falls back to the App Store
//   if the app isn't installed.
//
// Usage: add data attributes to any clickable element in Webflow.
//
//   <a
//     data-app-launch
//     data-app-desktop-url="https://app.example.com"
//     data-app-ios-url="https://example.com/app-link"       <!-- Universal Link (preferred) -->
//     OR
//     data-app-ios-scheme="myapp://home"                    <!-- Custom URL scheme -->
//     data-app-ios-store="https://apps.apple.com/app/id..." <!-- Required when using scheme -->
//   >Open app</a>
//
// If the iOS app has Universal Links set up (Associated Domains entitlement
// pointing at your site), `data-app-ios-url` is cleaner — iOS opens the app
// if installed, otherwise lands on the HTTPS URL, no timer hacks needed.
// Custom schemes require the scheme + store pair so we can fall back when
// the scheme silently fails (iOS Safari doesn't surface scheme errors).

const SCHEME_FALLBACK_DELAY = 1500;

// iPadOS 13+ with Safari in "request desktop site" (the default) reports
// userAgent as Macintosh. `maxTouchPoints > 1` distinguishes it from a Mac.
function isIOS() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return true;
  return false;
}

function openInNewTab(url) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function openIosUniversalLink(url) {
  window.location.href = url;
}

// Try the custom scheme; if the browser is still visible after the delay,
// the app likely isn't installed — redirect to the App Store.
function openIosSchemeWithStoreFallback(scheme, storeUrl) {
  let appOpened = false;
  const onVisibilityChange = () => {
    if (document.hidden) appOpened = true;
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  window.location.href = scheme;

  setTimeout(() => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    if (!appOpened && !document.hidden) {
      window.location.href = storeUrl;
    }
  }, SCHEME_FALLBACK_DELAY);
}

function launch({ desktopUrl, iosUrl, iosScheme, iosStoreUrl }) {
  if (isIOS()) {
    if (iosUrl) return openIosUniversalLink(iosUrl);
    if (iosScheme && iosStoreUrl) {
      return openIosSchemeWithStoreFallback(iosScheme, iosStoreUrl);
    }
    console.warn(
      "[app-launcher] iOS device but no data-app-ios-url or data-app-ios-scheme + data-app-ios-store configured",
    );
    return;
  }
  if (desktopUrl) return openInNewTab(desktopUrl);
  console.warn("[app-launcher] Desktop device but no data-app-desktop-url configured");
}

function wireLaunchers() {
  document.querySelectorAll("[data-app-launch]").forEach((el) => {
    if (el.dataset.appLaunchInit) return;
    el.dataset.appLaunchInit = "true";
    el.addEventListener("click", (e) => {
      e.preventDefault();
      launch({
        desktopUrl: el.dataset.appDesktopUrl,
        iosUrl: el.dataset.appIosUrl,
        iosScheme: el.dataset.appIosScheme,
        iosStoreUrl: el.dataset.appIosStore,
      });
    });
  });
}

window.Webflow = window.Webflow || [];
window.Webflow.push(wireLaunchers);
