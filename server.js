const express = require("express");
const { chromium } = require("playwright");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const app = express();
app.use(express.json());

const AUTH_STATE_DIR = "auth_sessions";
const ODOO_SETTLE_MS = 0;
const ODOO_LOADING_SELECTOR =
  ".o_loading_indicator, .o_spinner, .o_blockUI, .o_loading";
const ODOO_VIEW_SELECTORS = {
  activity: ".o_activity_view",
  calendar: ".o_calendar_view, .o_calendar_renderer",
  form: ".o_form_view, .o_form_renderer",
  gantt: ".o_gantt_view, .o_gantt_renderer",
  graph: ".o_graph_view, .o_graph_renderer",
  kanban: ".o_kanban_view, .o_kanban_renderer",
  list: ".o_list_view, .o_list_renderer",
  pivot: ".o_pivot, .o_pivot_renderer",
};

function parseUrl(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function getViewType(parsed) {
  const params = new URLSearchParams(parsed.hash.substring(1));
  return params.get("view_type");
}

function isOdooUrl(parsed) {
  const params = new URLSearchParams(parsed.hash.substring(1));
  const hasOdooHash = ["action", "model", "view_type", "menu_id"].some((key) =>
    params.has(key)
  );
  const hasOdooPath =
    parsed.pathname === "/web" || parsed.pathname.startsWith("/web/");

  return hasOdooHash || hasOdooPath;
}

function getAuthCredentials(payload) {
  return {
    username: payload.auth_username || payload.username,
    password: payload.auth_password || payload.password,
  };
}

function getOdooDatabase(payload, parsed) {
  return (
    payload.database ||
    payload.db ||
    payload.odoo_database ||
    parsed.searchParams.get("db") ||
    "default"
  );
}

function getOdooUrl(url, database) {
  if (!database || database === "default") return url;

  const parsed = new URL(url);
  parsed.searchParams.set("db", database);
  return parsed.toString();
}

function getOdooSession(payload, parsed) {
  const credentials = getAuthCredentials(payload);
  const scope = {
    origin: parsed.origin,
    database: getOdooDatabase(payload, parsed),
    username: credentials.username || "unknown",
  };
  const key = crypto
    .createHash("sha1")
    .update(`${scope.origin}|${scope.database}|${scope.username}`)
    .digest("hex");

  return {
    path: path.join(AUTH_STATE_DIR, `${key}.json`),
    scope,
  };
}

function getScreenshotOptions(payload) {
  const shotOpts = { fullPage: Boolean(payload.fullpage), type: "png" };

  if (!shotOpts.fullPage) {
    shotOpts.clip = {
      x: Number(payload.crop_x),
      y: Number(payload.crop_y),
      width: Number(payload.crop_width),
      height: Number(payload.crop_height),
    };
  }

  return shotOpts;
}

function getOdooViewSelector(viewType) {
  return ODOO_VIEW_SELECTORS[viewType] || null;
}

// server running information
const serviceInfo = require("./routes/service_information");
app.use("/", serviceInfo);

// ── Middleware ────────────────────────────────────────────────────────────────
// ── WIB timestamp ──────────────────────────────────────────────────────────
function nowWIB() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000)
    .toISOString()
    .replace("T", " ")
    .replace("Z", " WIB")
    .slice(0, 23) + " WIB";
}
 
function log(msg) {
  console.log(`[${nowWIB()}] ${msg}`);
}
 
// ── Browser singleton ──────────────────────────────────────────────────────
let browser = null;
 
async function getBrowser() { 
  if (browser && browser.isConnected()) return browser;
  log("Launching browser...");
  browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });
  browser.on("disconnected", () => {
    log("Browser disconnected, will relaunch on next request");
    browser = null;
  });
  log("Browser ready");
  return browser;
}

async function loginOdooAndSaveSession(page, context, login, password, sessionPath) {
  log('login..')
  await page.waitForSelector('input[name="login"]', { timeout: 15_000 });
  await page.fill('input[name="login"]', login);
  await page.fill('input[name="password"]', password);

  await page.click('button[type="submit"]');

  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

  fs.mkdirSync(AUTH_STATE_DIR, { recursive: true });
  await context.storageState({ path: sessionPath });
}

async function hasActiveOdooSession(page, url) {
  await page.goto(url, {
    waitUntil: "domcontentloaded",
  });

  return !page.url().includes("/web/login");
}

async function ensureOdooSession(page, context, payload, url, sessionPath) {
  const loggedIn = await hasActiveOdooSession(page, url);
  if (loggedIn) return;

  const credentials = getAuthCredentials(payload);
  if (!credentials.username || !credentials.password) {
    throw new Error("Odoo login dibutuhkan, tapi username/password tidak dikirim");
  }

  await loginOdooAndSaveSession(
    page,
    context,
    credentials.username,
    credentials.password,
    sessionPath
  );
}

async function waitForOdooLoadingDone(page) {
  await page.waitForFunction((selector) => {
    return [...document.querySelectorAll(selector)].every((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();

      return (
        style.display === "none" ||
        style.visibility === "hidden" ||
        Number(style.opacity) === 0 ||
        rect.width === 0 ||
        rect.height === 0
      );
    });
  }, ODOO_LOADING_SELECTOR, { timeout: 45_000 }).catch(() => {});
}

async function waitForOdooReady(page, viewType, elapsed) {
  log(`2. Waiting for Odoo shell...`);
  await page.waitForSelector(".o_web_client, .o_action_manager", {
    state: "visible",
    timeout: 60_000,
  }).catch(() => {});
  log(`   Shell visible (${elapsed()})`);

  const viewSelector = getOdooViewSelector(viewType);
  if (viewSelector) {
    log(`3. Waiting for Odoo ${viewType} view...`);
    await page.waitForSelector(viewSelector, {
      state: "visible",
      timeout: 60_000,
    }).catch(() => {});
    log(`   View visible (${elapsed()})`);
  }

  log(`4. Waiting for Odoo loading to finish...`);
  await waitForOdooLoadingDone(page);
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(ODOO_SETTLE_MS);
  log(`   Odoo ready (${elapsed()})`);
}

async function waitForPublicPageReady(page, elapsed) {
  log(`2. Waiting for public page idle...`);
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  log(`   Public page ready (${elapsed()})`);
}

// ── POST /capture ──────────────────────────────────────────────────────────
app.post("/capture", async (req, res) => {
  const p = req.body;

  const requestedUrl = p.url;
  const parsedUrl = parseUrl(requestedUrl);

  if (!parsedUrl || !["http:", "https:"].includes(parsedUrl.protocol)) {
    return res.status(400).json({
      status: "error",
      message: "Invalid URL. Gunakan URL lengkap dengan http:// atau https://",
      requested_url: requestedUrl,
    });
  }

  const start = Date.now();
  const elapsed = () => `${Date.now() - start} ms`;
  const isOdoo = isOdooUrl(parsedUrl);
  const odooSession = isOdoo ? getOdooSession(p, parsedUrl) : null;
  const captureUrl = isOdoo
    ? getOdooUrl(requestedUrl, odooSession.scope.database)
    : requestedUrl;
  const requestedViewType = getViewType(parsedUrl);
  let context = null;

  log(`Capture start — ${requestedUrl}`);
  log(`Mode — ${isOdoo ? "Odoo auth/session" : "public web"}`);
  if (odooSession) {
    log(
      `Session scope — ${odooSession.scope.origin} / ` +
      `db=${odooSession.scope.database} / user=${odooSession.scope.username}`
    );
  }
 
  try {
    const b = await getBrowser();
 
    const contextOpts = {
      viewport: {
        width: Number(p.viewport_width),
        height: Number(p.viewport_height),
      },
      ignoreHTTPSErrors: true,
    };
    
    const session = odooSession && fs.existsSync(odooSession.path);
    if (session) {
      log('use session')
      contextOpts.storageState = odooSession.path;
    }

    context = await b.newContext(contextOpts);
 
    const page = await context.newPage();

    if (isOdoo) {
      await ensureOdooSession(page, context, p, captureUrl, odooSession.path);
    }
    
    log(`1. Navigating...`);
    await page.goto(captureUrl, { waitUntil: "domcontentloaded" });
    log(`   DOM ready (${elapsed()})`);
 
    if (isOdoo) {
      await waitForOdooReady(page, requestedViewType, elapsed);
    } else {
      await waitForPublicPageReady(page, elapsed);
    }
 
    const finalUrl = page.url();
    const finalParsedUrl = parseUrl(finalUrl);
    const urlChanged = isOdoo &&
      requestedViewType &&
      finalParsedUrl &&
      getViewType(finalParsedUrl) !== requestedViewType;

    if (urlChanged) {
      log(`URL diminta : ${requestedUrl}`);
      log(`URL aktual  : ${finalUrl}`);
      log(`Capture Failed`);
      const timing_ms = Date.now() - start;
      return res.status(200).json({
        status: "redirected",
        message: "Halaman redirect/mental, capture dibatalkan",
        requested_url: requestedUrl,
        final_url: finalUrl,
        timing_ms,
      });
    }

    log(`URL check OK — ${finalUrl}`);
 
    const shotOpts = getScreenshotOptions(p);
 
    const screenshot = await page.screenshot(shotOpts);
 
    const timing_ms = Date.now() - start;
    log(`Capture done — ${timing_ms} ms — ${(screenshot.length / 1024).toFixed(1)} KB`);
 
    res.json({
      status: "ok",
      screenshot_base64: screenshot.toString("base64"),
      timing_ms,
    });
 
  } catch (err) {
    const timing_ms = Date.now() - start;
    log(`ERROR — ${err.message} (${timing_ms} ms)`);
    res.status(500).json({ status: "error", message: err.message, timing_ms });
  } finally {
    if (context) {
      await context.close().catch((err) => {
        log(`Context close failed — ${err.message}`);
      });
    }
  }
});

// port configuration
const port = 4000
app.listen(port, () => {
    console.log(`Web Capture service running on port ${port}`);
});
