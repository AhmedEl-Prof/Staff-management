// Production entry point for cPanel / Phusion Passenger.
//
// cPanel's "Setup Node.js App" runs this file via Passenger and injects the
// PORT it expects the server to listen on. We boot Next.js in production mode
// (no dev server, no rebuild) and hand every request to Next's handler.
//
// Prerequisites on the server (run once from the cPanel terminal or the
// "Run NPM script" button), in this order:
//   1. npm install            # install dependencies
//   2. npm run build          # produce the .next production build
// Then set THIS file as the application startup file and restart the app.

const { createServer } = require("node:http");
const next = require("next");

const port = parseInt(process.env.PORT || "3000", 10);
const hostname = process.env.HOSTNAME || "0.0.0.0";

// dev:false is critical — it serves the prebuilt .next output instead of
// trying to compile on the fly (which would crash under Passenger).
const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    handle(req, res);
  }).listen(port, () => {
    console.log(`> Staff-management ready on http://${hostname}:${port}`);
  });
});
