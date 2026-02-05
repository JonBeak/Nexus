import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, AlertCircle } from 'lucide-react';
import { ImagePickerModal } from '../modals/ImagePickerModal';
import { getFolderPathSegment } from '../../../utils/pdfUrls';

type FolderLocation = 'active' | 'finished' | 'cancelled' | 'hold' | 'none';

interface OrderImageProps {
  orderNumber: number;
  signImagePath?: string;
  cropTop?: number;
  cropRight?: number;
  cropBottom?: number;
  cropLeft?: number;
  folderName?: string;
  folderLocation?: FolderLocation;
  isMigrated?: boolean;
  readOnly?: boolean;
  onImageUpdated?: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const OrderImage: React.FC<OrderImageProps> = ({
  orderNumber,
  signImagePath,
  cropTop = 0,
  cropRight = 0,
  cropBottom = 0,
  cropLeft = 0,
  folderName,
  folderLocation = 'none',
  isMigrated = false,
  readOnly = false,
  onImageUpdated
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [croppedImageUrl, setCroppedImageUrl] = useState<string | null>(null);

  // Clean up blob URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (croppedImageUrl && croppedImageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(croppedImageUrl);
      }
    };
  }, [croppedImageUrl]);

  // Reset cropped URL when image path or crop values change
  useEffect(() => {
    setImageError(false);
    setCroppedImageUrl((prevUrl) => {
      if (prevUrl && prevUrl.startsWith('blob:')) {
        URL.revokeObjectURL(prevUrl);
      }
      return null;
    });
  }, [signImagePath, cropTop, cropRight, cropBottom, cropLeft]);

  const getImageUrl = (): string | null => {
    if (!signImagePath || !folderName) return null;

    // Static images are served from /order-images (not under /api/)
    // Extract base server URL (remove /api if present)
    const serverUrl = API_BASE_URL.replace(/\/api$/, '');
    const basePath = `${serverUrl}/order-images`;
    const encodedFolder = encodeURIComponent(folderName);
    const encodedFile = encodeURIComponent(signImagePath);

    // Get folder path segment based on location (active, finished, cancelled, hold)
    const pathSegment = getFolderPathSegment(folderLocation, isMigrated);
    return `${basePath}/${pathSegment}${encodedFolder}/${encodedFile}`;
  };

  const handleImageSelected = (filename: string) => {
    setImageError(false);
    if (onImageUpdated) {
      onImageUpdated();
    }
  };

  const imageUrl = getImageUrl();
  const hasImage = imageUrl && !imageError;
  const canSelectImage = !readOnly && folderLocation !== 'none' && folderName;

  // Calculate crop using Canvas
  const hasCrop = !!(cropTop || cropRight || cropBottom || cropLeft);

  const cropImageWithCanvas = (img: HTMLImageElement) => {
    if (!hasCrop) {
      // No crop needed, clear any cached cropped URL
      setCroppedImageUrl(null);
      return;
    }

    // Calculate cropped dimensions
    const croppedWidth = img.naturalWidth - cropLeft - cropRight;
    const croppedHeight = img.naturalHeight - cropTop - cropBottom;

    if (croppedWidth <= 0 || croppedHeight <= 0) {
      console.error('Invalid crop dimensions');
      return;
    }

    // Create canvas with cropped dimensions
    const canvas = document.createElement('canvas');
    canvas.width = croppedWidth;
    canvas.height = croppedHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      console.error('Could not get canvas context');
      return;
    }

    // Draw the cropped portion of the image
    ctx.drawImage(
      img,
      cropLeft,  // sx: source x position
      cropTop,   // sy: source y position
      croppedWidth,  // sWidth: source width
      croppedHeight, // sHeight: source height
      0,  // dx: destination x
      0,  // dy: destination y
      croppedWidth,  // dWidth: destination width
      croppedHeight  // dHeight: destination height
    );

    // Convert canvas to blob URL
    canvas.toBlob((blob) => {
      if (blob) {
        // Clean up previous URL if it exists
        setCroppedImageUrl((prevUrl) => {
          if (prevUrl && prevUrl.startsWith('blob:')) {
            URL.revokeObjectURL(prevUrl);
          }
          return URL.createObjectURL(blob);
        });
      }
    });
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });

    // Only crop if we're loading the original image, not the already-cropped blob
    // Use endsWith to handle both relative URLs and full URLs
    const isOriginalImage = imageUrl && (img.src === imageUrl || img.src.endsWith(imageUrl));
    if (isOriginalImage && hasCrop) {
      cropImageWithCanvas(img);
    }
  };

  const imageContent = (
    <>
      {hasImage ? (
        <div className="w-full h-full">
          {/* Hidden image to load original for cropping */}
          {hasCrop && !croppedImageUrl && (
            <img
              src={imageUrl}
              alt=""
              crossOrigin="anonymous"
              style={{ display: 'none' }}
              onLoad={handleImageLoad}
              onError={() => setImageError(true)}
            />
          )}
          {/* Display either cropped or original image */}
          {(!hasCrop || croppedImageUrl) && (
            <img
              src={hasCrop && croppedImageUrl ? croppedImageUrl : imageUrl}
              alt="Job Image"
              className="w-full h-full object-contain"
              crossOrigin="anonymous"
              onError={() => setImageError(true)}
            />
          )}
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
          {folderLocation === 'none' ? (
            <>
              <AlertCircle className="w-12 h-12 mb-2" />
              <span className="text-sm font-medium">No Folder</span>
              <span className="text-xs mt-1">Order has no folder</span>
            </>
          ) : imageError ? (
            <>
              <AlertCircle className="w-12 h-12 mb-2" />
              <span className="text-sm font-medium">Image Not Found</span>
              <span className="text-xs mt-1">{signImagePath || 'Unknown file'}</span>
            </>
          ) : !signImagePath ? (
            <>
              <ImageIcon className="w-12 h-12 mb-2" />
              <span className="text-sm font-medium">No Image Selected</span>
              <span className="text-xs mt-1">Click to select</span>
            </>
          ) : (
            <>
              <ImageIcon className="w-12 h-12 mb-2" />
              <span className="text-sm font-medium">Loading...</span>
            </>
          )}
        </div>
      )}
    </>
  );

  return (
    <div className="h-full">
      {/* Image Display - Clickable if can select */}
      {canSelectImage ? (
        <button
          onClick={() => setIsModalOpen(true)}
          className="relative bg-gray-100 rounded-lg overflow-hidden w-full h-full group cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all border border-gray-300"
          style={{ minHeight: '140px' }}
          title={signImagePath ? 'Click to change image' : 'Click to select image'}
        >
          {imageContent}
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white bg-opacity-90 px-3 py-1.5 rounded-full shadow-lg">
              <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4" />
                {signImagePath ? 'Change Image' : 'Select Image'}
              </span>
            </div>
          </div>
        </button>
      ) : (
        <div className="relative bg-gray-100 rounded-lg overflow-hidden w-full h-full border border-gray-300" style={{ minHeight: '140px' }}>
          {imageContent}
        </div>
      )}

      {/* Image Picker Modal */}
      {folderName && (
        <ImagePickerModal
          orderNumber={orderNumber}
          currentImage={signImagePath}
          folderName={folderName}
          folderLocation={folderLocation}
          isMigrated={isMigrated}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onImageSelected={handleImageSelected}
        />
      )}
    </div>
  );
};

export default OrderImage;
