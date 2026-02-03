import { useState, useEffect } from 'react';

/**
 * Device type detection for responsive experiences
 *
 * Three-tier detection:
 * - Phone: width < 768px
 * - Tablet: width 768-1199px with coarse pointer (touch)
 * - Desktop: fine pointer (mouse/trackpad) OR large screen
 *
 * Designed for kanban/drag-and-drop scenarios where iPad needs
 * different handling than phones (native scroll vs custom scrollbar)
 */

type DeviceType = 'phone' | 'tablet' | 'desktop';

interface DeviceInfo {
  deviceType: DeviceType;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouchDevice: boolean;
}

/**
 * Main hook for device type detection
 * Returns device type and convenience booleans
 */
export function useDeviceType(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => getDeviceInfo());

  useEffect(() => {
    // Media queries for device detection
    const phoneQuery = window.matchMedia('(max-width: 767px)');
    const coarsePointerQuery = window.matchMedia('(pointer: coarse)');

    const updateDeviceInfo = () => {
      setDeviceInfo(getDeviceInfo());
    };

    // Listen for changes
    phoneQuery.addEventListener('change', updateDeviceInfo);
    coarsePointerQuery.addEventListener('change', updateDeviceInfo);

    return () => {
      phoneQuery.removeEventListener('change', updateDeviceInfo);
      coarsePointerQuery.removeEventListener('change', updateDeviceInfo);
    };
  }, []);

  return deviceInfo;
}

/**
 * Get current device info based on media queries
 */
function getDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined') {
    // SSR fallback - assume desktop
    return {
      deviceType: 'desktop',
      isPhone: false,
      isTablet: false,
      isDesktop: true,
      isTouchDevice: false
    };
  }

  const isPhoneWidth = window.matchMedia('(max-width: 767px)').matches;
  const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

  // Phone: small screen (always touch-first)
  if (isPhoneWidth) {
    return {
      deviceType: 'phone',
      isPhone: true,
      isTablet: false,
      isDesktop: false,
      isTouchDevice: true
    };
  }

  // Tablet: any device with touch capability (coarse pointer) that's not phone-sized
  // This includes iPads with Magic Keyboard - if you CAN touch, you want touch UX
  if (hasCoarsePointer) {
    return {
      deviceType: 'tablet',
      isPhone: false,
      isTablet: true,
      isDesktop: false,
      isTouchDevice: true
    };
  }

  // Desktop: no touch capability (pure mouse/trackpad)
  return {
    deviceType: 'desktop',
    isPhone: false,
    isTablet: false,
    isDesktop: true,
    isTouchDevice: false
  };
}

// Convenience hooks for specific device checks
export function useIsPhone(): boolean {
  return useDeviceType().isPhone;
}

export function useIsTablet(): boolean {
  return useDeviceType().isTablet;
}

export function useIsTouchDevice(): boolean {
  return useDeviceType().isTouchDevice;
}
