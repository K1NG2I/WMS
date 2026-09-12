import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

// Object storage wrapper (S3-compatible). Locally this targets the MinIO
// container in docker-compose; production points at any S3 endpoint.

const ENDPOINT = process.env.S3_ENDPOINT || "http://localhost:9000";
// Host the Java service uses to reach the bucket. In docker-compose the Java
// container resolves `minio`, while Node (on the host) uses localhost:9000.
const PUBLIC_ENDPOINT = process.env.S3_PUBLIC_ENDPOINT || ENDPOINT;
const REGION = process.env.S3_REGION || "us-east-1";
const ACCESS_KEY = process.env.S3_ACCESS_KEY || "minioadmin";
const SECRET_KEY = process.env.S3_SECRET_KEY || "minioadmin";
const BUCKET = process.env.S3_BUCKET || "wms-documents";

const client = new S3Client({
  region: REGION,
  endpoint: ENDPOINT,
  forcePathStyle: true,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
});

const EXT_BY_MIME = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
};

// Rewrite a signed URL's origin so a URL created against the host-reachable
// endpoint is usable from inside the docker network (minio:9000).
function rewriteOrigin(url) {
  const u = new URL(url);
  const p = new URL(PUBLIC_ENDPOINT);
  u.protocol = p.protocol;
  u.host = p.host;
  u.port = p.port;
  return u.toString();
}

export async function storeDocument(buffer, mime) {
  const key = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}${EXT_BY_MIME[mime] || ".bin"}`;
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mime || "application/octet-stream",
    })
  );
  const signed = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: 3600 }
  );
  return {
    storageKey: key,
    fileLocation: rewriteOrigin(signed),
  };
}