// Fix: Declare missing Web Bluetooth types to satisfy TypeScript compiler
type BluetoothDevice = any;
type BluetoothRemoteGATTCharacteristic = any;

export class BluetoothPrinterService {
  // Fix: Use the declared BluetoothDevice type to avoid "Cannot find name" error
  private device: BluetoothDevice | null = null;
  // Fix: Use the declared BluetoothRemoteGATTCharacteristic type to avoid "Cannot find name" error
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;

  async connect(): Promise<string> {
    try {
      // Standard Thermal Printer Service UUID
      const PRINTER_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';
      
      // Fix: Cast navigator to any to access the experimental bluetooth property which is not in the standard Navigator type
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ services: [PRINTER_SERVICE_UUID] }],
        optionalServices: [PRINTER_SERVICE_UUID]
      });

      const server = await device.gatt?.connect();
      if (!server) throw new Error("GATT Server not found");

      const service = await server.getPrimaryService(PRINTER_SERVICE_UUID);
      const characteristics = await service.getCharacteristics();
      
      // Find the writable characteristic
      const writable = characteristics.find((c: any) => c.properties.write || c.properties.writeWithoutResponse);
      
      if (!writable) throw new Error("No writable characteristic found");

      this.device = device;
      this.characteristic = writable;
      
      return device.name || "Unknown Printer";
    } catch (error) {
      console.error("Bluetooth connection error:", error);
      throw error;
    }
  }

  // Added disconnect method to clear characteristic and device state
  async disconnect(): Promise<void> {
    if (this.device && this.device.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.device = null;
    this.characteristic = null;
  }

  async sendRaw(data: Uint8Array): Promise<void> {
    if (!this.characteristic) throw new Error("Printer not connected");

    // ESC/POS printers often have a maximum MTU of 20 bytes for BLE
    const chunkSize = 20;
    for (let i = 0; i < data.byteLength; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      await this.characteristic.writeValue(chunk);
      // Small delay to prevent buffer overflow on the printer
      if (i % 400 === 0) await new Promise(r => setTimeout(r, 15));
    }
  }

  async print(thermalData: Uint8Array): Promise<void> {
    // ESC/POS Initialize: 1B 40
    const init = new Uint8Array([0x1B, 0x40]);
    // ESC/POS Cut/Feed: 0A 0A 0A 1D 56 00
    const finish = new Uint8Array([0x0A, 0x0A, 0x0A, 0x1D, 0x56, 0x00]);

    await this.sendRaw(init);
    await this.sendRaw(thermalData);
    await this.sendRaw(finish);
  }

  isConnected(): boolean {
    return !!this.characteristic;
  }

  getDeviceName(): string {
    return this.device?.name || "Not Connected";
  }
}

export const printerService = new BluetoothPrinterService();