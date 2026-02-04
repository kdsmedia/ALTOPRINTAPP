
// Fix: Declare missing Web Bluetooth types to satisfy TypeScript compiler
type BluetoothDevice = any;
type BluetoothRemoteGATTCharacteristic = any;

export class BluetoothPrinterService {
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private batteryCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;

  async connect(): Promise<string> {
    try {
      // Standard Thermal Printer Service UUID
      const PRINTER_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';
      const BATTERY_SERVICE_UUID = 'battery_service'; // 0x180F
      
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ services: [PRINTER_SERVICE_UUID] }],
        optionalServices: [PRINTER_SERVICE_UUID, BATTERY_SERVICE_UUID]
      });

      const server = await device.gatt?.connect();
      if (!server) throw new Error("GATT Server not found");

      // Setup Printer Service
      const service = await server.getPrimaryService(PRINTER_SERVICE_UUID);
      const characteristics = await service.getCharacteristics();
      const writable = characteristics.find((c: any) => c.properties.write || c.properties.writeWithoutResponse);
      
      if (!writable) throw new Error("No writable characteristic found");

      // Optional: Setup Battery Service
      try {
        const batteryService = await server.getPrimaryService(BATTERY_SERVICE_UUID);
        this.batteryCharacteristic = await batteryService.getCharacteristic('battery_level');
      } catch (e) {
        console.debug("Battery service not supported by this device");
        this.batteryCharacteristic = null;
      }

      this.device = device;
      this.characteristic = writable;
      
      return device.name || "Unknown Printer";
    } catch (error) {
      console.error("Bluetooth connection error:", error);
      throw error;
    }
  }

  async getBatteryLevel(): Promise<number | null> {
    if (!this.batteryCharacteristic) return null;
    try {
      const value = await this.batteryCharacteristic.readValue();
      return value.getUint8(0);
    } catch (e) {
      console.error("Error reading battery level:", e);
      return null;
    }
  }

  async disconnect(): Promise<void> {
    if (this.device && this.device.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.device = null;
    this.characteristic = null;
    this.batteryCharacteristic = null;
  }

  async sendRaw(data: Uint8Array): Promise<void> {
    if (!this.characteristic) throw new Error("Printer not connected");

    const chunkSize = 20;
    for (let i = 0; i < data.byteLength; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      await this.characteristic.writeValue(chunk);
      if (i % 400 === 0) await new Promise(r => setTimeout(r, 15));
    }
  }

  async print(thermalData: Uint8Array): Promise<void> {
    const init = new Uint8Array([0x1B, 0x40]);
    const finish = new Uint8Array([0x0A, 0x0A, 0x0A, 0x1D, 0x56, 0x00]);

    await this.sendRaw(init);
    await this.sendRaw(thermalData);
    await this.sendRaw(finish);
  }

  isConnected(): boolean {
    return !!this.device && this.device.gatt?.connected;
  }

  getDeviceName(): string {
    return this.device?.name || "Not Connected";
  }
}

export const printerService = new BluetoothPrinterService();
