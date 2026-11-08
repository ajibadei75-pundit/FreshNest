/* Runs every day at 16:00 Nigerian time (15:00 UTC): emails customers about tomorrow's confirmed jobs and sends you a digest. */
import { getApp } from "../lib/app.mjs";
export default async () => { await getApp().runDaily(); };
export const config = { schedule: "0 15 * * *" };
