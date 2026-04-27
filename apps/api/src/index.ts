import { Hono } from "hono";

const app = new Hono();

app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

const port = Number.parseInt(process.env.PORT ?? "", 10) || 3000;

export default {
  port,
  fetch: app.fetch,
};
