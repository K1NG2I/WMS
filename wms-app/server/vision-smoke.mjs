import sharp from "sharp";
import { extractWithLLM } from "./extract.js";

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
const imageBase64 = `data:image/jpeg;base64,${image.toString("base64")}`;

const fields = [
  { key: "customerName", label: "Customer Name", type: "text" },
  { key: "vendorConsignor", label: "Vendor / Consignor", type: "text" },
  { key: "vehicleNo", label: "Vehicle No", type: "text" },
];

console.log("Calling extractWithLLM with image (vision branch)...");
const result = await extractWithLLM({
  text: "",
  docLabel: "Pre Gate Inward",
  fields,
  image: imageBase64,
});
console.log("RESULT:", JSON.stringify(result, null, 2));