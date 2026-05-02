import { PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, S3_BUCKET } from "../config/s3.config";
import path from "path";

function generateUniqueKey(bookingId: string, originalName: string): string {
  const ext = path.extname(originalName).toLowerCase() || ".jpg";
  const uniqueId = Date.now() + "-" + Math.random().toString(36).substring(2, 8);
  return `bookings/${bookingId}/${uniqueId}${ext}`;
}

function getContentType(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

function buildPublicUrl(key: string): string {
  const region = process.env.DO_SPACE_REGION || "ams3";
  const bucket = S3_BUCKET;
  return `https://${bucket}.${region}.digitaloceanspaces.com/${key}`;
}

function extractKeyFromUrl(imageUrl: string): string | null {
  const region = process.env.DO_SPACE_REGION || "ams3";
  const bucket = S3_BUCKET;
  const prefix = `https://${bucket}.${region}.digitaloceanspaces.com/`;

  if (imageUrl.startsWith(prefix)) {
    return imageUrl.substring(prefix.length);
  }
  return null;
}

export async function uploadImageToS3(
  bookingId: string,
  fileBuffer: Buffer,
  originalName: string,
): Promise<string> {
  const key = generateUniqueKey(bookingId, originalName);
  const contentType = getContentType(originalName);

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: fileBuffer,
    ACL: "public-read",
    ContentType: contentType,
  });

  await s3Client.send(command);

  return buildPublicUrl(key);
}

export async function uploadMultipleImages(
  bookingId: string,
  files: { buffer: Buffer; originalname: string }[],
): Promise<{ urls: string[]; errors: string[] }> {
  const urls: string[] = [];
  const errors: string[] = [];

  for (const file of files) {
    try {
      const url = await uploadImageToS3(bookingId, file.buffer, file.originalname);
      urls.push(url);
    } catch (error: any) {
      console.error(`Failed to upload ${file.originalname}:`, error.message);
      errors.push(`Failed to upload ${file.originalname}: ${error.message}`);
    }
  }

  return { urls, errors };
}

export async function listImagesForBooking(bookingId: string): Promise<string[]> {
  const prefix = `bookings/${bookingId}/`;
  const command = new ListObjectsV2Command({
    Bucket: S3_BUCKET,
    Prefix: prefix,
  });

  const response = await s3Client.send(command);
  const urls: string[] = [];

  if (response.Contents) {
    for (const obj of response.Contents) {
      if (obj.Key && !obj.Key.includes('/receipts/')) {
        urls.push(buildPublicUrl(obj.Key));
      }
    }
  }

  return urls;
}

export async function uploadCheckinReceiptToS3(bookingId: string, pdfBuffer: Buffer, checkInDate: Date): Promise<string> {
  const dateStr = checkInDate.toISOString().slice(0, 10);
  const key = `bookings/${bookingId}/receipts/check-in-${dateStr}.pdf`;

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: pdfBuffer,
    ContentType: 'application/pdf',
  });

  await s3Client.send(command);
  return key;
}

export async function getPresignedUrl(key: string, expiresInSeconds = 900): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ResponseContentDisposition: 'inline',
    ResponseContentType: 'application/pdf',
  });
  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}

export async function uploadPdfToS3(bookingId: string, pdfBuffer: Buffer, receiptNumber: string): Promise<string> {
  const key = `bookings/${bookingId}/receipts/${receiptNumber}.pdf`;

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: pdfBuffer,
    ContentType: 'application/pdf',
  });

  await s3Client.send(command);
  return key;
}

export async function deleteImageFromS3(imageUrl: string): Promise<void> {
  try {
    const key = extractKeyFromUrl(imageUrl);

    if (!key) {
      console.error("Invalid image URL format:", imageUrl);
      return;
    }

    const command = new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    });

    await s3Client.send(command);
  } catch (error: any) {
    console.error("Failed to delete image from S3:", error.message);
  }
}
