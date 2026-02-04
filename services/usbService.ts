
export class UsbPrinterService {
  private device: any = null;
  private endpointOut: number = -1;

  async connect(): Promise<string> {
    try {
      const device = await (navigator as any).usb.requestDevice({ filters: [] });
      await device.open();
      
      if (device.configuration === null) {
        await device.selectConfiguration(1);
      }
      
      await device.claimInterface(0);

      const interface0 = device.configuration.interfaces[0];
      const alternate = interface0.alternate;
      const endpoint = alternate.endpoints.find((e: any) => e.direction === 'out' && e.type === 'bulk');

      if (!endpoint) {
        throw new Error("Tidak dapat menemukan endpoint output pada perangkat ini.");
      }

      this.endpointOut = endpoint.endpointNumber;
      this.device = device;
      
      return device.productName || "USB Printer";
    } catch (error) {
      console.error("USB connection error:", error);
      throw error;
    }
  }

  getDeviceInfo() {
    if (!this.device) return null;
    return {
      name: this.device.productName,
      manufacturer: this.device.manufacturerName,
      vendorId: this.device.vendorId,
      productId: this.device.productId
    };
  }

  async sendRaw(data: Uint8Array): Promise<void> {
    if (!this.device || this.endpointOut === -1) throw new Error("Printer USB tidak terhubung");

    const chunkSize = 64;
    for (let i = 0; i < data.byteLength; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      await this.device.transferOut(this.endpointOut, chunk);
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
    return !!this.device && this.device.opened;
  }

  async disconnect(): Promise<void> {
    if (this.device) {
      await this.device.close();
      this.device = null;
    }
  }
}

export const usbService = new UsbPrinterService();
