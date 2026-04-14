const express = require("express");
const os = require("os");
const router = express.Router();

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
}

router.get("/", (req, res) => {
  res.send(`
    <html>
    <head>
      <title>Node Capture Service</title>
      <style>
        body { font-family: Arial; background: #0f172a; color: white; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
        .card { background: #1e293b; padding: 40px 48px; border-radius: 12px; width: 360px; text-align: center; }
        h1 { font-size: 20px; font-weight: 600; margin: 0 0 8px; }
        .status { color: #22c55e; font-size: 15px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 6px; margin-bottom: 24px; }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; display: inline-block; animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .rows { text-align: left; display: flex; flex-direction: column; gap: 10px; }
        .row { display: flex; justify-content: space-between; font-size: 13px; border-bottom: 1px solid #334155; padding-bottom: 10px; }
        .row:last-child { border: none; padding: 0; }
        .label { color: #94a3b8; }
        .value { font-family: monospace; color: #f1f5f9; }
        .uptime { color: #22c55e; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>🚀 Node Capture Service</h1>
        <div class="status"><span class="dot"></span> Server Running</div>
        <div class="rows">
          <div class="row">
            <span class="label">Host</span>
            <span class="value">${os.hostname()}</span>
          </div>
          <div class="row">
            <span class="label">Uptime</span>
            <span class="value uptime" id="uptime">${formatUptime(Math.floor(process.uptime()))}</span>
          </div>
          <div class="row">
            <span class="label">Node Version</span>
            <span class="value">${process.version}</span>
          </div>
          <div class="row">
            <span class="label">Environment</span>
            <span class="value">${process.env.NODE_ENV || 'development'}</span>
          </div>
        </div>
      </div>
      <script>
        let s = ${Math.floor(process.uptime())};
        function fmt(s) {
          const d = Math.floor(s / 86400);
          const h = Math.floor((s % 86400) / 3600);
          const m = Math.floor((s % 3600) / 60);
          return d + 'd ' + h + 'h ' + m + 'm ' + (s % 60) + 's';
        }
        setInterval(() => {
          document.getElementById('uptime').textContent = fmt(++s);
        }, 1000);
      </script>
    </body>
    </html>
  `);
});

module.exports = router;