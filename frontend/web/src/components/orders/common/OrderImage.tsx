import React, { useState } from 'react';
import { Image as ImageIcon, AlertCircle } from 'lucide-react';
import { ImagePickerModal } from '../modals/ImagePickerModal';

interface OrderImageProps {
  orderNumber: number;
  signImagePath?: string;
  cropTop?: number;
  cropRight?: number;
  cropBottom?: number;
  cropLeft?: number;
  folderName?: string;
  folderLocation?: 'active' | 'finished' | 'none';
  isMigrated?: boolean;
  readOnly?: boolean;
  onImageUpdated?: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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

  const getImageUrl = (): string | null => {
    if (!signImagePath || !folderName) return null;

    // Static images are served from /order-images (not under /api/)
    // Extract base server URL (remove /api if present)
    const serverUrl = API_BASE_URL.replace(/\/api$/, '');
    const basePath = `${serverUrl}/order-images`;
    const encodedFolder = encodeURIComponent(folderName);
    const encodedFile = encodeURIComponent(signImagePath);

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

  const handleImageSelected = (filename: string) => {
    setImageError(false);
    if (onImageUpdated) {
      onImageUpdated();
    }
  };

  const imageUrl = getImageUrl();
  const hasImage = imageUrl && !imageError;
  const canSelectImage = !readOnly && folderLocation !== 'none' && folderName;

  // Calculate crop using clip-path and scale
  const hasCrop = !!(cropTop || cropRight || cropBottom || cropLeft);

  const getCropStyles = (): { wrapper: React.CSSProperties; image: React.CSSProperties } => {
    if (!hasCrop || imageDimensions.width === 0) {
      return {
        wrapper: {},
        image: {}
      };
    }

    // Calculate cropped dimensions
    const croppedWidth = imageDimensions.width - cropLeft - cropRight;
    const croppedHeight = imageDimensions.height - cropTop - cropBottom;

    // Use clip-path to hide cropped areas
    const topPercent = (cropTop / imageDimensions.height) * 100;
    const rightPercent = (cropRight / imageDimensions.width) * 100;
    const bottomPercent = (cropBottom / imageDimensions.height) * 100;
    const leftPercent = (cropLeft / imageDimensions.width) * 100;

    console.log('[OrderImage] Crop:', {
      original: { w: imageDimensions.width, h: imageDimensions.height },
      cropPx: { top: cropTop, right: cropRight, bottom: cropBottom, left: cropLeft },
      cropped: { w: croppedWidth, h: croppedHeight },
      cropPercent: { top: topPercent, right: rightPercent, bottom: bottomPercent, left: leftPercent }
    });

    return {
      wrapper: {
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      },
      image: {
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        clipPath: `inset(${topPercent}% ${rightPercent}% ${bottomPercent}% ${leftPercent}%)`,
        transform: `scale(${imageDimensions.width / croppedWidth}, ${imageDimensions.height / croppedHeight})`
      }
    };
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
  };

  const styles = getCropStyles();

  const imageContent = (
    <>
      {hasImage ? (
        <div style={hasCrop ? styles.wrapper : { width: '100%', height: '100%' }}>
          <img
            src={imageUrl}
            alt="Job Image"
            className={hasCrop ? '' : 'w-full h-full object-contain'}
            style={hasCrop ? styles.image : undefined}
            onLoad={handleImageLoad}
            onError={() => setImageError(true)}
          />
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
          className="relative bg-gray-100 rounded-lg overflow-hidden w-full h-full group cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all"
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
        <div className="relative bg-gray-100 rounded-lg overflow-hidden w-full h-full" style={{ minHeight: '140px' }}>
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
