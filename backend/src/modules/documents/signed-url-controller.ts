import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error';

/**
 * Generate a signed URL for document download.
 * The URL expires after a configurable time (default 1 hour).
 */
export function generateSignedUrl(filePath: string, expiresInSeconds: number = 3600): string {
  const secret = env.DOCUMENT_SIGNING_SECRET;
  if (!secret) {
    throw new Error('DOCUMENT_SIGNING_SECRET is not configured');
  }

  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const data = `${filePath}:${expires}`;
  const signature = crypto.createHmac('sha256', secret).update(data).digest('hex');

  const baseUrl = env.SERVER_BASE_URL || '';
  return `${baseUrl}/api/documents/download?path=${encodeURIComponent(filePath)}&expires=${expires}&signature=${signature}`;
}

/**
 * Verify the signature of a signed URL.
 */
function verifySignature(filePath: string, expires: number, signature: string): boolean {
  const secret = env.DOCUMENT_SIGNING_SECRET;
  if (!secret) {
    return false;
  }

  // Check if URL has expired
  if (Date.now() / 1000 > expires) {
    return false;
  }

  const data = `${filePath}:${expires}`;
  const expected = crypto.createHmac('sha256', secret).update(data).digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Express handler for authenticated document download via signed URL.
 * This replaces the static /documents serving.
 */
export const downloadDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { path: filePath, expires, signature } = req.query as {
      path?: string;
      expires?: string;
      signature?: string;
    };

    if (!filePath || !expires || !signature) {
      throw new AppError('Missing required parameters: path, expires, signature', 400);
    }

    if (!verifySignature(filePath, parseInt(expires, 10), signature)) {
      throw new AppError('Invalid or expired signature', 403);
    }

    // Prevent path traversal attacks
    const resolvedPath = path.resolve(filePath);
    const documentsDir = path.resolve(process.cwd(), 'documents');
    if (!resolvedPath.startsWith(documentsDir)) {
      throw new AppError('Access denied: invalid file path', 403);
    }

    if (!fs.existsSync(resolvedPath)) {
      throw new AppError('File not found', 404);
    }

    const stat = fs.statSync(resolvedPath);
    if (!stat.isFile()) {
      throw new AppError('Not a file', 400);
    }

    // Set headers for download
    const filename = path.basename(resolvedPath);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', stat.size);

    const stream = fs.createReadStream(resolvedPath);
    stream.pipe(res);

    stream.on('error', (err) => {
      next(new AppError('Error reading file', 500));
    });
  } catch (error) {
    next(error);
  }
};
