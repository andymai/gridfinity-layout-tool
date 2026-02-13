import { put, head } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getClientIP } from '../lib/rateLimit.js';
import { REPORT_THRESHOLD } from '../lib/contentFilter.js';
import { isValidShareId, ErrorCode, type ShareData } from '../lib/shared.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST for reports
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res
      .status(405)
      .json({ error: 'Method not allowed', code: ErrorCode.METHOD_NOT_ALLOWED });
  }

  const { id } = req.query;

  if (typeof id !== 'string' || !isValidShareId(id)) {
    return res.status(400).json({
      error: 'Invalid share ID',
      code: ErrorCode.VALIDATION_ERROR,
    });
  }

  try {
    // Rate limiting
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimit(clientIP, 'report');

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many reports. Try again later.',
        code: ErrorCode.RATE_LIMITED,
        retryAfter: rateLimit.retryAfterSeconds,
      });
    }

    const { reason } = (req.body ?? {}) as Record<string, unknown>;

    // Validate reason (optional but helpful)
    const reportReason = typeof reason === 'string' ? reason.slice(0, 500) : 'No reason provided';

    const blobPath = `shares/${id}.json`;

    // Fetch existing share
    const blobInfo = await head(blobPath).catch(() => null);
    if (!blobInfo) {
      return res.status(404).json({
        error: 'Share not found',
        code: ErrorCode.NOT_FOUND,
      });
    }

    const response = await fetch(blobInfo.url);
    if (!response.ok) {
      return res.status(404).json({
        error: 'Share not found',
        code: ErrorCode.NOT_FOUND,
      });
    }

    const shareData = (await response.json()) as ShareData;

    // Increment report count
    const newReportCount = shareData.metadata.reportCount + 1;

    // Update metadata with new report count
    const updatedData: ShareData = {
      ...shareData,
      metadata: {
        ...shareData.metadata,
        reportCount: newReportCount,
      },
    };

    // Save updated data
    await put(blobPath, JSON.stringify(updatedData), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    // Log report for manual review
    console.warn('Share reported:', {
      id,
      reportCount: newReportCount,
      reason: reportReason,
      timestamp: new Date().toISOString(),
    });

    // Check if threshold exceeded (could auto-hide in future)
    const thresholdExceeded = newReportCount >= REPORT_THRESHOLD;
    if (thresholdExceeded) {
      console.warn('Share report threshold exceeded:', {
        id,
        reportCount: newReportCount,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Report submitted. Thank you for helping keep the community safe.',
    });
  } catch (error) {
    console.error('Report error:', error);
    return res.status(500).json({
      error: 'Failed to submit report',
      code: ErrorCode.SERVER_ERROR,
    });
  }
}
