/**
 * Safe File Writer Utility
 * Handles file locking errors (EBUSY) gracefully during PDF generation
 */

import fs from 'fs';
import fsPromises from 'fs/promises';

/**
 * Error thrown when a file is locked/busy (e.g., open in another program)
 */
export class FileBusyError extends Error {
  public readonly filePath: string;
  public readonly code: string = 'EBUSY';

  constructor(filePath: string) {
    const fileName = filePath.split('/').pop() || filePath;
    super(`Cannot write "${fileName}" - the file is open in another program. Please close the PDF and try again.`);
    this.name = 'FileBusyError';
    this.filePath = filePath;
  }
}

/**
 * Check if a file is locked/busy by attempting to open it for writing
 * Returns true if the file can be written, throws FileBusyError if locked
 */
export async function checkFileWritable(filePath: string): Promise<boolean> {
  try {
    // Try to open the file for writing - this will fail if locked
    const handle = await fsPromises.open(filePath, 'w');
    await handle.close();
    return true;
  } catch (error: any) {
    if (error.code === 'EBUSY') {
      throw new FileBusyError(filePath);
    }
    // Other errors (like ENOENT) are fine - file doesn't exist yet
    if (error.code === 'ENOENT') {
      return true;
    }
    throw error;
  }
}

/**
 * Create a WriteStream with proper error handling for locked files
 * Attaches error handler immediately to catch EBUSY during open
 */
export function createSafeWriteStream(
  filePath: string,
  onError: (error: Error) => void
): fs.WriteStream {
  const stream = fs.createWriteStream(filePath);

  // Attach error handler immediately (before any async operations)
  stream.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EBUSY') {
      onError(new FileBusyError(filePath));
    } else {
      onError(error);
    }
  });

  return stream;
}

/**
 * Wrap PDF generation with file locking checks
 * Use this in generateOrderForm, generatePackingList, generateEstimateForm
 */
export async function withSafeFileWrite<T>(
  outputPath: string,
  generateFn: (stream: fs.WriteStream) => Promise<T>
): Promise<T> {
  // Pre-check if file is writable (catches most locked files)
  await checkFileWritable(outputPath);

  return new Promise((resolve, reject) => {
    const stream = createSafeWriteStream(outputPath, reject);

    // Additional safety: if stream fails to open, reject
    stream.on('open', async () => {
      try {
        const result = await generateFn(stream);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  });
}
