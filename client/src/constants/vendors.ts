// Vendor display name mapping
export const VENDOR_DISPLAY_NAMES: Record<string, string> = {
  facetoface: 'Face To Face',
  taps: 'Taps',
  redclaw: 'Red Claw',
  prisma: 'Prisma',
  cerberus: 'Cerberus',
  timevault: 'Time Vault'
};

export const getVendorDisplayName = (vendor: string): string => {
  return VENDOR_DISPLAY_NAMES[vendor.toLowerCase()] || vendor;
};
