import "dotenv/config";
import OpenAI from "openai";
import sharp from "sharp";
import os from "node:os";
import path from "node:path";

const PRIMARY_KEY = process.env.NVIDIA_API_KEY;
const FALLBACK_KEY = process.env.NVIDIA_API_KEY_FALLBACK;
const PRIMARY_MODEL = process.env.NVIDIA_MODEL || "nvidia/nemotron-3-super-120b-a12b";
const FALLBACK_MODEL = process.env.NVIDIA_MODEL_FALLBACK || "nvidia/nemotron-3-ultra-550b-a55b";

// Generate a tiny test image with visible text
const svg = Buffer.from(`
<svg width="600" height="300" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="white"/>
  <text x="20" y="80" font-size="48" font-family="Arial" fill="black">Customer Name: ACME Ltd</text>
  <text x="20" y="180" font-size="48" font-family="Arial" fill="black">Vehicle No: MH 12 AB 4432</text>
</svg>
`);
const image = await sharp(svg).jpeg().toBuffer();
const base64 = image.toString("base64");

// Try a model with an image input
async function testModel(name, key, model) {
  console.log(`\n=== Testing ${name} (${model}) with vision input ===`);
  if (!key) {
    console.log("  SKIP - no API key");
    return { supports: false, error: "no key" };
  }
  const client = new OpenAI({
    apiKey: key,
    baseURL: "https://integrate.api.nvidia.com/v1",
  });
  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${base64}` },
            },
            { type: "text", text: "What are the customer name and vehicle number in this image? Answer in JSON." },
          ],
        },
      ],
      max_tokens: 128,
    });
    const content = completion.choices?.[0]?.message?.content || "";
    console.log(`  ✅ SUPPORTS IMAGES`);
    console.log(`  Response: ${content.slice(0, 200)}`);
    return { supports: true, content };
  } catch (err) {
    console.log(`  ❌ FAILS: ${err.message}`);
    return { supports: false, error: err.message };
  }
}

const primary = await testModel("Super", PRIMARY_KEY, PRIMARY_MODEL);
const fallback = await testModel("Ultra", FALLBACK_KEY, FALLBACK_MODEL);

console.log("\n===== RESULT =====");
console.log(`Super (${PRIMARY_MODEL}): ${primary.supports ? "VISON SUPPORTED" : "no vision"}`);
console.log(`Ultra (${FALLBACK_MODEL}): ${fallback.supports ? "VISON SUPPORTED" : "no vision"}`);

if (fallback.supports && !primary.supports) {
  console.log("=> RECOMMENDATION: Make ULTRA the primary (vision) and SUPER the fallback");
} else if (primary.supports && !fallback.supports) {
  console.log("=> RECOMMENDATION: Keep SUPER as primary (vision) and ULTRA as fallback");
} else {
  console.log("=> RECOMMENDATION: Both same capability - keep current order");
}