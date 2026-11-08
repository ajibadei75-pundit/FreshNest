/* One function serves the whole backend: /api/* */
import { getApp } from "../lib/app.mjs";
export default async (req) => getApp().handle(req);
export const config = { path: "/api/*" };
