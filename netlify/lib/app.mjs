import core from "../../site/js/core.js";
import { blobsDb, resendMail, anthropicAi } from "./adapters.mjs";
let app;
export function getApp() { return (app ||= core.createApp({ db: blobsDb(), mail: resendMail(process.env), ai: anthropicAi(process.env), env: process.env })); }
