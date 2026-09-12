import { runBot, simulatePush } from "./index.js";

const mode = process.env.WHATSAPP_SIMULATE === "1" ? "simulate" : "bot";

if (mode === "simulate") {
  simulatePush({
    sender: process.env.SIM_SENDER || "+91 90000 00000",
    group: process.env.SIM_GROUP || "WMS-Bot Test Group",
    file: process.env.SIM_FILE, // optional path to a PDF
  })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[whatsapp-sim] failed:", err.message);
      process.exit(1);
    });
} else {
  runBot();
}