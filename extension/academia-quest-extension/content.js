/**
 * content.js
 * Runs in the extension context on every *.brightspace.com page.
 *
 * Responsibilities:
 *   1. Inject interceptor.js into page context (to capture fetch/XHR)
 *   2. DOM scrape the current page for assignments / grades
 *   3. Forward everything to background.js for storage + sync
 */

"use strict";

const AQ = (() => {
  // ─── Constants ────────────────────────────────────────────────────────────

  const LOG = (...a) => console.log("[AQ]", ...a);
  const INIT_DELAY_MS = 1800; // wait for Brightspace's Angular to render
  const NAV_DEBOUNCE_MS = 1200;

  // ─── Inject page-context interceptor ─────────────────────────────────────

  function injectInterceptor() {
    if (document.getElementById("__aq_interceptor__")) return; // already injected

    const s = document.createElement("script");
    s.id = "__aq_interceptor__";
    s.src = chrome.runtime.getURL("interceptor.js");
    s.type = "text/javascript";
    (document.head || document.documentElement).prepend(s);
    LOG("Interceptor injected.");
  }

  // ─── URL / page helpers ───────────────────────────────────────────────────

  function getPageType() {
    const p = window.location.pathname + window.location.search;
    if (p.includes("/d2l/lms/dropbox/")) return "dropbox";
    if (p.includes("/d2l/lms/grades/")) return "grades";
    if (p.includes("/d2l/le/calendar")) return "calendar";
    if (p.match(/\/d2l\/home\/?\d*/)) return "home";
    if (p.includes("/d2l/lp/ouHome")) return "courseHome";
    return "other";
  }

  function getCourseId() {
    const fromQuery = window.location.search.match(/[?&]ou=(\d+)/);
    if (fromQuery) return fromQuery[1];
    const fromPath = window.location.pathname.match(/\/(\d{5,})\//);
    if (fromPath) return fromPath[1];
    return "0";
  }

  function getCourseName() {
    const selectors = [
      ".d2l-navigation-s-course-name",
      "d2l-navigation-link-text",
      ".vui-breadcrumb li:last-child a",
      "[class*='course-name']",
      "h1.d2l-page-title",
      ".d2l-course-image-tile-header",
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el?.textContent?.trim()) return el.textContent.trim();
    }
    // Fallback: first part of <title>
    return document.title.split(/[-|–]/)[0].trim() || "Unknown Course";
  }

  // ─── Date parsing ─────────────────────────────────────────────────────────

  const MONTHS = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
    jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
    sep: 9, oct: 10, nov: 11, dec: 12,
  };

  function parseDate(str) {
    if (!str) return null;
    str = str.trim();

    // ISO: 2026-05-15T23:59:00
    const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

    // "May 15, 2026" or "May 15 2026"
    const long = str.match(/([a-z]+)\s+(\d{1,2}),?\s+(\d{4})/i);
    if (long) {
      const m = MONTHS[long[1].toLowerCase()];
      if (m) return `${long[3]}-${String(m).padStart(2, "0")}-${String(long[2]).padStart(2, "0")}`;
    }

    // "15/05/2026" or "05/15/2026"
    const slash = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slash) return `${slash[3]}-${slash[2].padStart(2, "0")}-${slash[1].padStart(2, "0")}`;

    // try native Date
    const d = new Date(str);
    if (!isNaN(d)) return d.toISOString().split("T")[0];

    return null;
  }

  function extractDateFromText(text) {
    if (!text) return null;
    const patterns = [
      /([A-Za-z]+ \d{1,2},\s*\d{4})/,
      /(\d{4}-\d{2}-\d{2})/,
      /(\d{1,2}\/\d{1,2}\/\d{4})/,
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) return parseDate(m[1]);
    }
    return null;
  }

  // ─── DOM Scrapers ─────────────────────────────────────────────────────────

  /** Scrape the Dropbox / Assignments list page */
  function scrapeDropbox() {
    const courseId = getCourseId();
    const courseName = getCourseName();
    const results = [];

    // Strategy A: <table> rows (classic Brightspace)
    document.querySelectorAll("table tbody tr, .d2l-grid tbody tr").forEach((row) => {
      const anchor = row.querySelector("a[href*='dropbox'], a[href*='submit'], td:first-child a");
      if (!anchor) return;
      const title = anchor.textContent.trim();
      if (!title) return;

      let dueDate = null;
      let status = "pending";

      row.querySelectorAll("td").forEach((td) => {
        const t = td.textContent.trim();
        if (!dueDate) dueDate = extractDateFromText(t);
        if (/submitted|graded|completed/i.test(t)) status = "submitted";
      });

      results.push(makeAssignment({ courseId, courseName, title, dueDate, status, url: anchor.href, src: "dom_dropbox_table" }));
    });

    // Strategy B: card / list view (newer Brightspace UI)
    document.querySelectorAll("[class*='d2l-card'], [class*='folder-content']").forEach((card) => {
      const anchor = card.querySelector("a");
      const title = anchor?.textContent?.trim() || card.querySelector("h2, h3, [class*='title']")?.textContent?.trim();
      if (!title) return;

      const allText = card.textContent;
      const dueDate = extractDateFromText(allText);
      const status = /submitted|completed|graded/i.test(allText) ? "submitted" : "pending";

      results.push(makeAssignment({ courseId, courseName, title, dueDate, status, url: anchor?.href, src: "dom_dropbox_card" }));
    });

    return dedupe(results);
  }

  /** Scrape the Grades page */
  function scrapeGrades() {
    const courseId = getCourseId();
    const courseName = getCourseName();
    const results = [];

    document.querySelectorAll("table tbody tr").forEach((row) => {
      const cells = [...row.querySelectorAll("td")];
      if (cells.length < 2) return;

      const title = cells[0]?.textContent?.trim();
      if (!title || /grade item|item name/i.test(title)) return;

      let grade = null, maxGrade = null, percentage = null;

      cells.forEach((td) => {
        const t = td.textContent.trim();
        // "84 / 100"
        const pts = t.match(/^([\d.]+)\s*\/\s*([\d.]+)$/);
        if (pts) { grade = parseFloat(pts[1]); maxGrade = parseFloat(pts[2]); return; }
        // "84.5 %"
        const pct = t.match(/^([\d.]+)\s*%$/);
        if (pct && percentage === null) { percentage = parseFloat(pct[1]); }
      });

      if (grade !== null || percentage !== null) {
        results.push({
          id: `grade_${courseId}_${slugify(title)}`,
          courseId,
          course: courseName,
          title,
          grade,
          maxGrade,
          percentage: percentage ?? (maxGrade ? +(grade / maxGrade * 100).toFixed(1) : null),
          source: "dom_grades",
        });
      }
    });

    return results;
  }

  /** Scrape upcoming work widget on home/course pages */
  function scrapeUpcomingWork() {
    const results = [];

    // "d2l-upcoming-assessments", "upcoming-assignments" etc.
    const containers = document.querySelectorAll(
      "[class*='upcoming'], [class*='assessment'], d2l-upcoming-assessments, [data-widget-name*='upcomingEvents']"
    );

    containers.forEach((container) => {
      container.querySelectorAll("li, [class*='item'], [class*='row']").forEach((item) => {
        const anchor = item.querySelector("a");
        const title = anchor?.textContent?.trim() || item.querySelector("h3, [class*='title']")?.textContent?.trim();
        if (!title) return;

        const dueDate = extractDateFromText(item.textContent);
        const courseEl = item.querySelector("[class*='course'], [class*='org-unit']");
        const courseName = courseEl?.textContent?.trim() || "Unknown";

        results.push(makeAssignment({
          courseId: "0",
          courseName,
          title,
          dueDate,
          status: "pending",
          url: anchor?.href,
          src: "dom_upcoming",
        }));
      });
    });

    return dedupe(results);
  }

  // ─── API response handler ──────────────────────────────────────────────────

  function handleApiData(url, data) {
    if (!data) return;

    // ── Calendar events ──────────────────────────────────────────────────────
    if (url.includes("calendar") || url.includes("CalendarEvent")) {
      const events =
        data.CalendarEvents ?? data.Objects ?? data.Items ??
        (Array.isArray(data) ? data : []);

      const assignments = events
        .filter((e) => e && (e.EventType === 1 || e.AssociatedEntity || e.DropboxId))
        .map((e) =>
          makeAssignment({
            courseId: String(e.OrgUnitId ?? e.OrgUnit ?? 0),
            courseName: e.OrgUnitName ?? e.CourseName ?? "Unknown",
            title: e.Title ?? e.Name,
            dueDate: parseDate(e.EndDateTime ?? e.DueDate),
            status: "pending",
            url: e.Url ?? null,
            src: "api_calendar",
          })
        );

      if (assignments.length) send("ASSIGNMENTS_FOUND", { assignments });
    }

    // ── Dropbox folders ──────────────────────────────────────────────────────
    if (url.includes("dropbox")) {
      const folders = data.Objects ?? data.Items ?? (Array.isArray(data) ? data : []);
      const assignments = folders.map((f) =>
        makeAssignment({
          courseId: String(f.OrgUnitId ?? f.OrgUnit ?? getCourseId()),
          courseName: f.OrgUnitName ?? getCourseName(),
          title: f.Name ?? f.Title,
          dueDate: parseDate(f.DueDate ?? f.EndDate),
          status: f.Status === 2 || f.IsSubmitted ? "submitted" : "pending",
          grade: f.Score ?? null,
          maxGrade: f.MaxScore ?? null,
          url: null,
          src: "api_dropbox",
        })
      );
      if (assignments.length) send("ASSIGNMENTS_FOUND", { assignments });
    }

    // ── Grade objects ────────────────────────────────────────────────────────
    if (url.includes("grade") || url.includes("Grade")) {
      const items = data.Objects ?? data.Items ?? (Array.isArray(data) ? data : []);
      const grades = items
        .filter((g) => g && g.PointsNumerator != null)
        .map((g) => ({
          id: `grade_${g.OrgUnitId ?? 0}_${g.GradeObjectId ?? g.Id}`,
          courseId: String(g.OrgUnitId ?? 0),
          course: g.OrgUnitName ?? "Unknown",
          title: g.GradeObjectName ?? g.Name ?? "Grade Item",
          grade: g.PointsNumerator,
          maxGrade: g.PointsDenominator,
          percentage: g.DisplayedGrade ?? null,
          source: "api_grades",
        }));
      if (grades.length) send("GRADES_FOUND", { grades });
    }

    // ── News/announcements (ignore, no useful data) ──────────────────────────
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function makeAssignment({ courseId, courseName, title, dueDate, status, grade = null, maxGrade = null, url = null, src }) {
    return {
      id: `assign_${courseId}_${slugify(title ?? "")}`,
      courseId: String(courseId),
      course: courseName ?? "Unknown",
      title: title ?? "Untitled",
      dueDate: dueDate ?? null,
      status: status ?? "pending",
      grade: grade ?? null,
      maxGrade: maxGrade ?? null,
      url: url ?? null,
      source: src,
      syncedAt: new Date().toISOString(),
    };
  }

  function slugify(str) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40);
  }

  function dedupe(arr) {
    const seen = new Set();
    return arr.filter((a) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
  }

  // ─── Messaging ────────────────────────────────────────────────────────────

  function send(type, payload = {}) {
    chrome.runtime.sendMessage({ type, ...payload }).catch(() => {});
  }

  // ─── User info ────────────────────────────────────────────────────────────

  function scrapeUserInfo() {
    const selectors = [
      ".d2l-navigation-s-user-name",
      "[class*='user-name']",
      ".d2l-menu-item-text",
      "[data-test-user-display-name]",
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el?.textContent?.trim()) {
        send("USER_INFO", { user: { name: el.textContent.trim() } });
        return;
      }
    }
  }

  // ─── SPA navigation watcher ───────────────────────────────────────────────

  function watchNavigation() {
    let lastUrl = location.href;
    let timer = null;

    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        clearTimeout(timer);
        timer = setTimeout(run, NAV_DEBOUNCE_MS);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ─── Main run ─────────────────────────────────────────────────────────────

  function run() {
    const page = getPageType();
    LOG("Page:", page, location.href);

    send("PAGE_VISIT", { page, url: location.href });
    scrapeUserInfo();

    if (page === "dropbox") {
      const assignments = scrapeDropbox();
      LOG("Dropbox DOM:", assignments.length, "items");
      if (assignments.length) send("ASSIGNMENTS_FOUND", { assignments });
    }

    if (page === "grades") {
      const grades = scrapeGrades();
      LOG("Grades DOM:", grades.length, "items");
      if (grades.length) send("GRADES_FOUND", { grades });
    }

    if (page === "home" || page === "courseHome") {
      const upcoming = scrapeUpcomingWork();
      LOG("Upcoming DOM:", upcoming.length, "items");
      if (upcoming.length) send("ASSIGNMENTS_FOUND", { assignments: upcoming });
    }
  }

  // ─── Bootstrap ────────────────────────────────────────────────────────────

  function init() {
    injectInterceptor();

    // Listen for intercepted API data from page context
    window.addEventListener("__aq_api_data__", (e) => {
      const { url, data } = e.detail;
      LOG("API intercept:", url);
      handleApiData(url, data);
    });

    // DOM scrape after initial render
    setTimeout(run, INIT_DELAY_MS);

    // Watch for SPA route changes
    watchNavigation();
  }

  return { init };
})();

AQ.init();
