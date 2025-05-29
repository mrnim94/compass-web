const path = require("path");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const atlasRouter = require("./lib/atlas-router");
const connectionRouter = require("./lib/connection-router");
const { createWebSocketProxy } = require("./lib/ws-proxy");

// Parse port from command line
const args = process.argv;

const portIndex = args.indexOf("-p");

let port = 8080;

// Check if "-p" parameter is provided and is valid
if (portIndex !== -1 && args[portIndex + 1]) {
  port = parseInt(args[portIndex + 1], 10);
  if (isNaN(port) || port < 0 || port > 65535) {
    console.error(`Invalid port number: ${port}`);
    process.exit(1);
  }
}

const logger = console;
const app = express();

let cleaningUp = false;
let distPath;

if (fs.existsSync(path.join(__dirname, "dist", "index.html"))) {
  distPath = path.join(__dirname, "dist");
} else if (fs.existsSync(path.join(__dirname, "index.html"))) {
  (distPath = __dirname), "dist";
} else {
  logger.error("Client artifacts not found");
  process.exit(1);
}

app.use(express.static(distPath));

app.use(express.json());

app.use(
  session({
    secret: "secret-key", // TODO
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true }, // TODO: secure tet to true if using HTTPS
  })
);

app.use("/cloud-mongodb-com", atlasRouter);

app.use("/connections", connectionRouter);

// Serve the default MongoDB URI from environment variable
app.get("/default-connection", (req, res) => {
  res.json({
    uri: process.env.MONGODB_URI || "",
  });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

const server = app.listen(port, () => {
  logger.info(
    `Server is listening on ${server.address().address}:${
      server.address().port
    }`
  );

  const wsProxyServer = createWebSocketProxy(server);

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      if (cleaningUp) {
        return false;
      }

      cleaningUp = true;
      logger.log("Cleaning up before exit");

      void Promise.allSettled([
        server.closeAllConnections(),
        new Promise((resolve) => {
          server.close(resolve);
        }),

        Array.from(wsProxyServer.clients.values()).map((ws) => {
          return ws.terminate();
        }),
        new Promise((resolve) => {
          wsProxyServer.close(resolve);
        }),
      ]).finally(() => {
        logger.log("Done cleaning up");
        process.exitCode = 0;
        process.exit();
      });
    });
  }

  [process.stdout, process.stderr].forEach((stream) => {
    stream.on("error", (err) => {
      logger.error(err);
    });
  });
});
