const express = require("express");
const { chromium } = require("playwright");
const app = express();
app.use(express.json());

function getViewType(url) {
    const parsed = new URL(url);
    const params = new URLSearchParams(parsed.hash.substring(1));
    return params.get("view_type");
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

// ── Script diinjek SEBELUM page load — nangkap semua XHR/fetch dari awal ──
const INJECT_SCRIPT = `
  window.__activeReqs = 0;
  const _open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(...a) {
    window.__activeReqs++;
    this.addEventListener("loadend", () => { window.__activeReqs = Math.max(0, window.__activeReqs - 1); });
    return _open.apply(this, a);
  };
  const _fetch = window.fetch;
  window.fetch = function(...a) {
    window.__activeReqs++;
    const p = _fetch.apply(this, a);
    p.finally(() => { window.__activeReqs = Math.max(0, window.__activeReqs - 1); });
    return p;
  };
`;

// ── Tunggu sampai XHR/fetch idle N ms berturut-turut ──────────────────────
async function waitForNetworkIdle(page, { idleMs = 1500, timeout = 30_000 } = {}) {
  const deadline = Date.now() + timeout;
  let idleSince = null;
 
  while (Date.now() < deadline) {
    const active = await page.evaluate(() => window.__activeReqs ?? 0).catch(() => 0);
    if (active === 0) {
      if (!idleSince) idleSince = Date.now();
      if (Date.now() - idleSince >= idleMs) return true;
    } else {
      idleSince = null;
    }
    await page.waitForTimeout(200);
  }
  return false;
}

async function doLoginAndSave(page, context, login, password) {
  log('login..')
  await page.fill('input[name="login"]', login);
  await page.fill('input[name="password"]', password);

  await page.click('button[type="submit"]');

  await page.waitForLoadState("networkidle");

  // 💾 simpan session
  await context.storageState({ path: "auth.json" });
}

async function isLoggedIn(page, url) {
  await page.goto(url, {
    waitUntil: "domcontentloaded",
  });

  return !page.url().includes("/web/login");
}

const fs = require("fs");
// ── POST /capture ──────────────────────────────────────────────────────────
app.post("/capture", async (req, res) => {
  const p = req.body;
  
  if (getViewType(p.url) !== 'gantt') {
    return res.json({
          status: "Wrong View",
          requested_url: p.url,
        });
  }
  
  const start = Date.now();
  const elapsed = () => `${Date.now() - start} ms`;
  log(`Capture start — ${p.url}`);
 
  try {
    const b = await getBrowser();
 
    let contextOpts = {
      viewport: {
        width:  p.viewport_width,
        height: p.viewport_height,
      },
      ignoreHTTPSErrors: true,
    };
    
    const session = fs.existsSync("auth.json")
    if (session) {
      log('use session')
      contextOpts.storageState = "auth.json";
    }

    const context = await b.newContext(contextOpts);
    // ★ Inject XHR/fetch counter SEBELUM page load apapun
    await context.addInitScript(INJECT_SCRIPT);
 
    const page = await context.newPage();

    let loggedIn = await isLoggedIn(page, p.url);

    if (!loggedIn) {
      console.log(p.auth_username);
      console.log(p.auth_password);
      await doLoginAndSave(page, context, p.auth_username, p.auth_password);
    }
    
    // 1. Navigate
    log(`1. Navigating...`);
    await page.goto(p.url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    log(`   DOM ready (${elapsed()})`);
 
    log(`2. Waiting for Odoo shell...`);
    await page.waitForSelector(".o_web_client, .o_action_manager", {
      state: "visible",
      timeout: 30_000,
    }).catch(() => {});
    log(`   Shell visible (${elapsed()})`);
 
    log(`3. Waiting for network idle (XHR/fetch = 0 selama 30s)...`);
    const isIdle = await waitForNetworkIdle(page, { idleMs: 1500, timeout: 30_000 });
    log(`   Network idle: ${isIdle} (${elapsed()})`);
    
    const finalUrl   = page.url();
    const urlChanged = getViewType(finalUrl) !== getViewType(p.url);

    if (urlChanged) {
        log(`URL diminta : ${p.url}`);
        log(`URL aktual  : ${finalUrl}`);
        log(`Capture Failed`);
        await context.close();
        const timing_ms = Date.now() - start;
        return res.status(200).json({
            status: "redirected",
            message: "Halaman redirect/mental, capture dibatalkan",
            requested_url: p.url,
            final_url: finalUrl,
            timing_ms,
        });
    }

    const found = await page.$('.o_gantt_view') !== null;
    if (!found) {
        const info = await page.evaluate(() => ({
            url:   window.location.href,
            hash:  window.location.hash,
            title: document.title,
            body:  document.body.innerText.substring(0, 500),
        }));

        console.log("page info:", JSON.stringify(info, null, 2));
        log(`Capture Failed Wrong View`);

        await context.close();
        return res.json({
          status: "wrong_view",
          message: `Selector "${'o_gantt_view'}" tidak ditemukan di DOM`,
          requested_url: p.url,
          timing_ms: Date.now() - start,
        });
      }

    log(`URL check OK — ${finalUrl}`);
 
    // Screenshot
    const shotOpts = { fullPage: Boolean(p.fullpage), type: "png" };
    if (!shotOpts.fullPage) {
      shotOpts.clip = {
        x:      p.crop_x,
        y:      p.crop_y,
        width:  p.crop_width,
        height: p.crop_height,
      };
    }
 
    const screenshot = await page.screenshot(shotOpts);
    await context.close();
 
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
  }
});

// port configuration
const port = 4000
app.listen(port, () => {
    console.log(`Web Capture service running on port ${port}`);
});
