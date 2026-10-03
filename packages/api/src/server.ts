import { createApp } from "./app.js";
const port=Number(process.env.PORT||8787); const {app}=createApp({dbPath:"../../forge-ledger.db",outputRoot:"../../generated-projects"}); app.listen(port,"127.0.0.1",()=>console.log(`FORGE API listening at http://127.0.0.1:${port}`));
