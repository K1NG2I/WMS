import "dotenv/config";
import OpenAI from "openai";
import sharp from "sharp";

const KEY = process.env.NVIDIA_API_KEY;

const svg = Buffer.from(`
<svg width="600" height="300" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="white"/>
  <text x="20" y="80" font-size="48" font-family="Arial" fill="black">Customer Name: ACME Ltd</text>
  <text x="20" y="180" font-size="48" font-family="Arial" fill="black">Vehicle No: MH 12 AB 4432</text>
</svg>
`);
const image = await sharp(svg).jpeg().toBuffer();
const base64 = image.toString("base64");

const CANDIDATES = [
  "meta/llama-3.2-90b-vision-instruct",
  "meta/llama-3.2-11b-vision-instruct",
  "mistralai/pixtral-12b",
  "microsoft/phi-3.5-vision-instruct",
];

for (const model of CANDIDATES) {
  console.log(`\n--- ${model} ---`);
  const client = new OpenAI({ apiKey: KEY, baseURL: "https://integrate.api.nvidia.com/v1" });
  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } },
            { type: "text", text: "Customer name and vehicle number? Answer in JSON only." },
          ],
        },
      ],
      max_tokens: 128,
    });
    console.log(`  ✅ VISION OK: ${(completion.choices?.[0]?.message?.content || "").slice(0, 160)}`);
  } catch (err) {
    console.log(`  ❌ ${err.message.slice(0, 160)}`);
  }
}