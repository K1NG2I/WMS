import "dotenv/config";
import OpenAI from "openai";
import sharp from "sharp";

const KEY = process.env.NVIDIA_API_KEY || "";
const MODEL = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning";

// Build a real document-like image (the yash3.jpeg scenario)
const svg = Buffer.from(`
<svg width="900" height="600" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="white"/>
  <text x="60" y="80" font-size="40" font-family="Arial" fill="black" font-weight="bold">Pre Gate Inward</text>
  <text x="60" y="170" font-size="36" font-family="Arial" fill="black">FRED</text>
  <text x="420" y="170" font-size="36" font-family="Arial" fill="black">VALUE</text>
  <text x="60" y="260" font-size="32" font-family="Arial" fill="black">Customer Name</text>
  <text x="420" y="260" font-size="32" font-family="Arial" fill="black">Nimbus Retail Pvt Ltd</text>
  <text x="60" y="340" font-size="32" font-family="Arial" fill="black">Vendor / Consignor</text>
  <text x="420" y="340" font-size="32" font-family="Arial" fill="black">Aravali Foods</text>
  <text x="60" y="420" font-size="32" font-family="Arial" fill="black">Vehicle No</text>
  <text x="420" y="420" font-size="32" font-family="Arial" fill="black">MH 12 AB 4432</text>
</svg>
`);
const image = await sharp(svg).jpeg().toBuffer();
const base64 = image.toString("base64");

const client = new OpenAI({
  apiKey: KEY,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

const payload = {
  model: MODEL,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Extract customerName, vendorConsignor and vehicleNo from this warehouse document. Return ONLY valid JSON.",
        },
        {
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${base64}` },
        },
      ],
    },
  ],
  max_tokens: 1024,
};

console.log("Sending image to", MODEL, "...");
try {
  const completion = await client.chat.completions.create(payload);
  console.log("SUCCESS:", completion.choices?.[0]?.message?.content || "(empty)");
} catch (err) {
  console.log("FAILED:", err.message);
}