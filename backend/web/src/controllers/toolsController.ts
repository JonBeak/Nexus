import { Request, Response } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { SMB_ROOT, ORDERS_FOLDER } from '../config/paths';

const SOURCE_DIR = '/home/jon/Nexus/tools/folder-opener';
const TARGET_DIR = path.join(SMB_ROOT, ORDERS_FOLDER, 'Folder Opener Tool');

export const copyFolderOpenerToSMB = async (req: Request, res: Response) => {
  try {
    console.log('📦 Starting copy of Folder Opener Tool to SMB...');

    // Create target directory if it doesn't exist
    await fs.mkdir(TARGET_DIR, { recursive: true });
    console.log(`✅ Target directory ready: ${TARGET_DIR}`);

    // Files to copy (C# version - smaller, no console window)
    const filesToCopy = [
      'NexusFolderOpener.cs',
      'build.bat',
      'install-csharp.bat',
      'README-CSHARP.md',
      'QUICK_START.txt'
    ];

    const results = [];

    for (const file of filesToCopy) {
      const sourcePath = path.join(SOURCE_DIR, file);
      const targetPath = path.join(TARGET_DIR, file);

      try {
        // Check if source file exists
        await fs.access(sourcePath);

        // Copy the file
        await fs.copyFile(sourcePath, targetPath);

        // Get file stats for reporting
        const stats = await fs.stat(targetPath);
        const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

        console.log(`✅ Copied: ${file} (${sizeInMB} MB)`);
        results.push({
          file,
          success: true,
          size: `${sizeInMB} MB`
        });
      } catch (error: any) {
        console.error(`❌ Failed to copy ${file}:`, error.message);
        results.push({
          file,
          success: false,
          error: error.message
        });
      }
    }

    // Check if all files were copied successfully
    const allSuccess = results.every(r => r.success);

    res.json({
      success: allSuccess,
      message: allSuccess
        ? '✅ All files copied successfully to SMB share!'
        : '⚠️ Some files failed to copy',
      targetPath: TARGET_DIR,
      results
    });

  } catch (error: any) {
    console.error('❌ Copy operation failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to copy files to SMB share',
      error: error.message
    });
  }
};
