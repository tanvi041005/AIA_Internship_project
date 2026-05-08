const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT) || 8080;

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

http
  .createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);

    if (pathname === "/" || pathname === "/index.html") {
      res.writeHead(302, { Location: "/frontend/index.html" });
      return res.end();
    }

    let p = path.join(root, pathname);
    if (!p.startsWith(root)) {
      res.writeHead(403);
      return res.end();
    }
    fs.stat(p, (err, st) => {
      if (!err && st.isDirectory()) p = path.join(p, "index.html");
      fs.readFile(p, (e, buf) => {
        if (e) {
          res.writeHead(404);
          return res.end("Not found");
        }
        const ext = path.extname(p).toLowerCase();
        res.setHeader("Content-Type", mime[ext] || "application/octet-stream");
        res.end(buf);
      });
    });
  })
  .listen(port, () => {
    console.log("Serving at http://127.0.0.1:" + port + "/frontend/");
  });
