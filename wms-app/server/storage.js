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

// SigV4 signs the Host header, so a presigned URL can only be used against the
// host it was signed for. Node reaches MinIO at ENDPOINT (localhost:9000), but
// the Java container reaches it at PUBLIC_ENDPOINT (minio:9000) — build a
// dedicated signer so the published fileLocation matches what clients fetch.
const signClient = new S3Client({
  region: REGION,
  endpoint: PUBLIC_ENDPOINT,
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
    signClient,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: 3600 }
  );
  return {
    storageKey: key,
    fileLocation: signed,
  };
}