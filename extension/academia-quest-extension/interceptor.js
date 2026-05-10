/**
 * interceptor.js
 * Injected into page context (NOT extension context) via a <script> tag.
 * Wraps fetch + XHR to capture D2L API responses before they disappear.
 * Communicates back to content.js via CustomEvents on window.
 */
(function () {
  "use strict";

  const TAG = "[AQ-interceptor]";

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function isRelevantUrl(url) {
    if (!url || typeof url !== "string") return false;
    return (
      url.includes("/d2l/api/le/") ||
      url.includes("/d2l/api/lp/") ||
      url.includes("dropbox") ||
      url.includes("grades") ||
      url.includes("calendar") ||
      url.includes("CalendarEvent") ||
      url.includes("GradeObject") ||
      url.includes("assignments")
    );
  }

  function dispatch(url, data) {
    try {
      window.dispatchEvent(
        new CustomEvent("__aq_api_data__", {
          detail: { url, data },
        })
      );
    } catch (e) {
      // silently ignore
    }
  }

  // ─── fetch interceptor ───────────────────────────────────────────────────────

  const _fetch = window.fetch.bind(window);

  window.fetch = async function (...args) {
    const req = args[0];
    const url =
      typeof req === "string"
        ? req
        : req instanceof URL
        ? req.href
        : req instanceof Request
        ? req.url
        : "";

    const response = await _fetch(...args);

    if (isRelevantUrl(url)) {
      response
        .clone()
        .json()
        .then((data) => dispatch(url, data))
        .catch(() => {});
    }

    return response;
  };

  // ─── XHR interceptor ────────────────────────────────────────────────────────

  const _open = XMLHttpRequest.prototype.open;
  const _send = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__aq_url__ = url;
    return _open.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", function () {
      if (!isRelevantUrl(this.__aq_url__)) return;
      try {
        const data = JSON.parse(this.responseText);
        dispatch(this.__aq_url__, data);
      } catch (_) {}
    });
    return _send.apply(this, args);
  };

  console.log(TAG, "Network interceptor active.");
})();
