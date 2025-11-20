import React, { useState, useEffect } from 'react';
import { X, Image as ImageIcon, CheckCircle, AlertTriangle } from 'lucide-react';
import { ordersApi } from '../../../services/api';

interface ImageInfo {
  filename: string;
  size: number;
  modifiedDate: string;
}

interface CropCoordinates {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface ImagePickerModalProps {
  orderNumber: number;
  currentImage?: string;
  folderName: string;
  folderLocation: 'active' | 'finished' | 'none';
  isMigrated: boolean;
  isOpen: boolean;
  onClose: () => void;
  onImageSelected: (filename: string) => void;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const ImagePickerModal: React.FC<ImagePickerModalProps> = ({
  orderNumber,
  currentImage,
  folderName,
  folderLocation,
  isMigrated,
  isOpen,
  onClose,
  onImageSelected
}) => {
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchImages();
    }
  }, [isOpen, orderNumber]);

  const fetchImages = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await ordersApi.getAvailableImages(orderNumber);

      if (response.success) {
        setImages(response.images);
        if (response.images.length === 0) {
          setError('No images found in order folder');
        }
      } else {
        setError('Failed to fetch images');
      }
    } catch (err: any) {
      console.error('Error fetching images:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch images';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Detect white background borders and calculate crop coordinates
   * Uses Canvas API to analyze pixel data
   */
  const detectWhiteBorders = (img: HTMLImageElement): CropCoordinates => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      console.warn('[AutoCrop] Canvas context not available');
      return { top: 0, right: 0, bottom: 0, left: 0 };
    }

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    // Threshold for "white" detection - more lenient for JPG compression artifacts
    const isWhite = (r: number, g: number, b: number, a: number): boolean => {
      return r > 235 && g > 235 && b > 235 && a > 200;
    };

    // Check if row is at least 98% white (tolerates minor artifacts)
    const isRowMostlyWhite = (y: number, startX: number, endX: number): boolean => {
      let whiteCount = 0;
      const totalPixels = endX - startX;
      for (let x = startX; x < endX; x++) {
        const idx = (y * width + x) * 4;
        if (isWhite(pixels[idx], pixels[idx + 1], pixels[idx + 2], pixels[idx + 3])) {
          whiteCount++;
        }
      }
      return (whiteCount / totalPixels) >= 0.98;
    };

    const isColMostlyWhite = (x: number, startY: number, endY: number): boolean => {
      let whiteCount = 0;
      const totalPixels = endY - startY;
      for (let y = startY; y < endY; y++) {
        const idx = (y * width + x) * 4;
        if (isWhite(pixels[idx], pixels[idx + 1], pixels[idx + 2], pixels[idx + 3])) {
          whiteCount++;
        }
      }
      return (whiteCount / totalPixels) >= 0.98;
    };

    // Find top border
    let top = 0;
    for (let y = 0; y < height; y++) {
      if (!isRowMostlyWhite(y, 0, width)) break;
      top = y + 1;
    }

    // Find bottom border
    let bottom = 0;
    for (let y = height - 1; y >= top; y--) {
      if (!isRowMostlyWhite(y, 0, width)) break;
      bottom = height - y;
    }

    // Find left border
    let left = 0;
    for (let x = 0; x < width; x++) {
      if (!isColMostlyWhite(x, top, height - bottom)) break;
      left = x + 1;
    }

    // Find right border
    let right = 0;
    for (let x = width - 1; x >= left; x--) {
      if (!isColMostlyWhite(x, top, height - bottom)) break;
      right = width - x;
    }

    const crop = { top, right, bottom, left };
    console.log(`[AutoCrop] Image: ${width}x${height}, Detected borders:`, crop);
    console.log(`[AutoCrop] Content area: ${width - left - right}x${height - top - bottom}`);
    return crop;
  };

  const handleSelectImage = async (filename: string) => {
    try {
      setSelecting(filename);
      setError(null);

      // Load image to detect white borders
      const imageUrl = getImageUrl(filename);
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Allow canvas to read image data

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imageUrl;
      });

      // Detect white borders and calculate crop coordinates
      const cropCoords = detectWhiteBorders(img);

      const response = await ordersApi.setJobImage(orderNumber, filename, cropCoords);

      if (response.success) {
        onImageSelected(filename);
        onClose();
      } else {
        setError(response.error || 'Failed to set image');
      }
    } catch (err: any) {
      console.error('Error setting image:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to set image';
      setError(errorMessage);
    } finally {
      setSelecting(null);
    }
  };

  const getImageUrl = (filename: string): string => {
    // Static images are served from /order-images (not under /api/)
    // Extract base server URL (remove /api if present)
    const serverUrl = API_BASE_URL.replace(/\/api$/, '');
    const basePath = `${serverUrl}/order-images`;
    const encodedFolder = encodeURIComponent(folderName);
    const encodedFile = encodeURIComponent(filename);

    if (isMigrated) {
      // Legacy orders: root or 1Finished
      return folderLocation === 'active'
        ? `${basePath}/${encodedFolder}/${encodedFile}`
        : `${basePath}/1Finished/${encodedFolder}/${encodedFile}`;
    } else {
      // New orders: Orders or Orders/1Finished
      return folderLocation === 'active'
        ? `${basePath}/Orders/${encodedFolder}/${encodedFile}`
        : `${basePath}/Orders/1Finished/${encodedFolder}/${encodedFile}`;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  const handleBackdropClick = () => {
    // Don't allow closing while selecting an image
    if (selecting === null) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-6 h-6 text-indigo-600" />
            <h3 className="text-xl font-semibold">Select Job Image</h3>
          </div>
          <button
            onClick={onClose}
            disabled={selecting !== null}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent mx-auto mb-4"></div>
                <p className="text-gray-600">Loading images...</p>
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-800">{error}</p>
                {folderLocation === 'none' && (
                  <p className="text-xs text-red-700 mt-2">
                    This order does not have a folder. Please create the folder first.
                  </p>
                )}
              </div>
            </div>
          )}

          {!loading && !error && images.length > 0 && (
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Found {images.length} image{images.length !== 1 ? 's' : ''} in order folder
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {images.map((image) => {
                  const isSelected = image.filename === currentImage;
                  const isSelecting = selecting === image.filename;

                  return (
                    <button
                      key={image.filename}
                      onClick={() => handleSelectImage(image.filename)}
                      disabled={selecting !== null}
                      className={`relative group border-2 rounded-lg overflow-hidden transition-all ${
                        isSelected
                          ? 'border-green-500 shadow-lg'
                          : 'border-gray-200 hover:border-indigo-400 hover:shadow-md'
                      } ${selecting !== null ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {/* Image Preview */}
                      <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
                        <img
                          src={getImageUrl(image.filename)}
                          alt={image.filename}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = `
                                <div class="flex flex-col items-center justify-center text-gray-400 p-4">
                                  <svg class="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span class="text-xs text-center">Image failed to load</span>
                                </div>
                              `;
                            }
                          }}
                        />
                      </div>

                      {/* Image Info */}
                      <div className="p-3 bg-white">
                        <p className="text-sm font-medium text-gray-900 truncate" title={image.filename}>
                          {image.filename}
                        </p>
                        <div className="flex justify-between items-center mt-1">
                          <p className="text-xs text-gray-500">
                            {formatFileSize(image.size)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDate(image.modifiedDate)}
                          </p>
                        </div>
                      </div>

                      {/* Selected Badge */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1">
                          <CheckCircle className="w-5 h-5" />
                        </div>
                      )}

                      {/* Selecting Spinner */}
                      {isSelecting && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-4 border-white border-t-transparent"></div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            disabled={selecting !== null}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
