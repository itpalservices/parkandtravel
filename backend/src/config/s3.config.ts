import { S3Client } from "@aws-sdk/client-s3";

const endpoint = process.env.DO_SPACE_ENDPOINT || "";
const region = process.env.DO_SPACE_REGION || "ams3";
const accessKeyId = process.env.DO_SPACE_KEY || "";
const secretAccessKey = process.env.DO_SPACE_SECRET || "";

export const s3Client = new S3Client({
  endpoint,
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  forcePathStyle: false,
});

export const S3_BUCKET = process.env.DO_SPACE_BUCKET || "";
