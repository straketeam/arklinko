import express from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./vite";

const app = express();
const port = Number(process.env.PORT || 5000);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

(async () => {
  const server = await registerRoutes(app);

  if (process.env.NODE_ENV !== "production") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port}`);
  });
})();

async function setupVite(app: express.Express, server: any) {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.ssrFixStacktrace);
  app.use(vite.middlewares);
}
