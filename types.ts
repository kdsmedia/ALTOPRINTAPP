
export type PaperSize = '58' | '80';
export type ReceiptFont = 'monospace' | 'sans-serif' | 'serif' | 'dot-matrix';

export interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

export interface Transaction {
  id: string;
  timestamp: number;
  items: ReceiptItem[];
  total: number;
  status?: 'success' | 'failed' | 'pending';
}

export interface ShippingData {
  toName: string;
  toPhone: string;
  toAddress: string;
  fromName: string;
  fromPhone: string;
  courier: string;
  trackingNumber: string;
  note: string;
}

export enum ModalType {
  NONE,
  SHIPPING,
  RECEIPT,
  SETTINGS,
  SCANNER,
  QR_GEN,
  BARCODE_GEN,
  HISTORY
}

export interface ThermalOptions {
  paperSize: PaperSize;
  rotation: number;
  scale: number;
}
