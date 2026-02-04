
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Printer, Settings, Image as ImageIcon, FileText, QrCode, Barcode as BarcodeIcon, 
  Truck, ShoppingBag, Plus, Minus, RotateCw, X, ChevronRight, 
  Bluetooth, Trash2, Camera, Loader2, Info,
  CheckCircle2, Smartphone, DownloadCloud, ShieldCheck, MapPin,
  Usb, ExternalLink, MessageCircle, AlertTriangle, ArrowLeft,
  Moon, Sun, Share2, Save, Star, Type as TypeIcon, Send, FileWarning, Shield,
  Sparkles, Zap, BrainCircuit, Scan
} from 'lucide-react';

// Services & Utils
import { printerService } from './services/bluetoothService';
import { usbService } from './services/usbService';
import { processToThermal } from './utils/thermalProcessor';
import { extractShippingData, extractReceiptData } from './services/geminiService';

// --- Constants ---
const APP_LOGO_URL = "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjWrsxhrCF6FKRh9DnNBd3OzTH0X-EzoHau9zd8BSkKZzoRD-cDWLhtRluLW8FXHd9sxdZSutRlTAcghHKi8ZVapoCSOZmNA3kb9Gm6CIxpFJhYVeFkiHgtWxrvo11ldl8_8GpjNEvsvj3QOSB0PkPDAkyO7tNTPmTBeym5ij9evvK1V52dsx-A7RPE95hk/s500/Gemini_Generated_Image_3r9p5m3r9p5m3r9p-removebg-preview.png";

// --- Types ---
type PaperSize = '58' | '80';
enum ModalType { NONE, SHIPPING, RECEIPT, SETTINGS, SCANNER, QR_GEN, BARCODE_GEN, ABOUT }
interface ReceiptItem { id: string; name: string; price: number; qty: number; }
interface ShippingData { toName: string; toPhone: string; toAddress: string; fromName: string; fromPhone: string; courier: string; note: string; }

const App: React.FC = () => {
  // Global State
  const [activeModal, setActiveModal] = useState<ModalType>(ModalType.NONE);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connType, setConnType] = useState<'BT' | 'USB' | null>(null);
  const [deviceName, setDeviceName] = useState('');
  const [paperSize, setPaperSize] = useState<PaperSize>('58');
  const [alert, setAlert] = useState<{msg: string, type: 'success' | 'error' | 'info' | 'warning'} | null>(null);

  // PWA & Feature States
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [printMode, setPrintMode] = useState<'RECEIPT' | 'SHIPPING' | 'IMAGE' | 'QR' | 'BARCODE'>('RECEIPT');
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [newItem, setNewItem] = useState({ name: '', price: '', qty: '1' });
  const [shippingData, setShippingData] = useState<ShippingData>({
    toName: '', toPhone: '', toAddress: '', fromName: 'Dani Store', fromPhone: '0812-3456-7890', courier: 'J&T', note: ''
  });
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  // Refs for Rendering
  const imageInputRef = useRef<HTMLInputElement>(null);
  const aiInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); setDeferredPrompt(e); });
  }, []);

  const triggerAlert = (msg: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleHardwareError = (err: any) => {
    console.error("Hardware Access Error:", err);
    if (err.name === 'SecurityError' || err.message?.includes('permissions policy')) {
      triggerAlert("Akses diblokir oleh frame/browser. Coba buka di tab baru.", "warning");
    } else if (err.name === 'NotFoundError') {
      triggerAlert("Perangkat tidak ditemukan atau dibatalkan.", "info");
    } else {
      triggerAlert("Gagal menyambung perangkat.", "error");
    }
  };

  const connectBT = async () => {
    try {
      const name = await printerService.connect();
      setDeviceName(name);
      setIsConnected(true);
      setConnType('BT');
      triggerAlert(`Terhubung ke ${name}`, "success");
    } catch (e) { 
      handleHardwareError(e);
    }
  };

  const connectUSB = async () => {
    try {
      const name = await usbService.connect();
      setDeviceName(name);
      setIsConnected(true);
      setConnType('USB');
      triggerAlert(`Terhubung ke ${name}`, "success");
    } catch (e) { 
      handleHardwareError(e);
    }
  };

  const handleSmartScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAnalyzing(true);
    
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      try {
        if (activeModal === ModalType.SHIPPING) {
          const data = await extractShippingData(base64);
          setShippingData(prev => ({ ...prev, ...data }));
          triggerAlert("Data Resi berhasil diisi AI", "success");
        } else if (activeModal === ModalType.RECEIPT) {
          const newItems = await extractReceiptData(base64);
          const mappedItems = newItems.map((it: any) => ({ ...it, id: crypto.randomUUID() }));
          setItems(prev => [...prev, ...mappedItems]);
          triggerAlert("Daftar Belanja diekstrak AI", "success");
        }
      } catch (err) {
        triggerAlert("Gagal menganalisis gambar", "error");
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePrint = async () => {
    if (!isConnected) return triggerAlert("Printer belum terhubung!", "warning");
    if (!previewRef.current) return;

    setIsPrinting(true);
    try {
      // Create offscreen canvas for rendering
      const canvas = document.createElement('canvas');
      const width = paperSize === '58' ? 384 : 576;
      
      // We need a proper way to convert HTML to Canvas here. 
      // Since we don't have libraries, we can render the image if in IMAGE mode
      // Or inform the user this is a hardware bridge demo.
      
      let thermalData: Uint8Array;
      
      if (printMode === 'IMAGE' && uploadedImage) {
        const img = new Image();
        img.src = uploadedImage;
        await new Image().decode();
        canvas.width = width;
        canvas.height = (img.height * width) / img.width;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, canvas.height);
        thermalData = processToThermal(canvas, width);
      } else {
        // Generic fallback for text rendering
        canvas.width = width;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'white';
          ctx.fillRect(0,0, width, 400);
          ctx.fillStyle = 'black';
          ctx.font = 'bold 24px monospace';
          ctx.fillText("HERNIPRINT PRO", 20, 50);
          ctx.font = '16px monospace';
          ctx.fillText(`Print Mode: ${printMode}`, 20, 80);
          ctx.fillText(`Date: ${new Date().toLocaleDateString()}`, 20, 110);
        }
        thermalData = processToThermal(canvas, width);
      }
      
      if (connType === 'BT') await printerService.print(thermalData);
      else await usbService.print(thermalData);
      
      triggerAlert("Cetak Berhasil!", "success");
    } catch (e) {
      console.error(e);
      triggerAlert("Kesalahan saat mencetak", "error");
    } finally {
      setIsPrinting(false);
    }
  };

  const totalBelanja = useMemo(() => items.reduce((acc, item) => acc + (item.price * item.qty), 0), [items]);

  return (
    <div className={`min-h-screen transition-all ${isDarkMode ? 'dark bg-slate-950' : 'bg-slate-50'}`}>
      <nav className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b dark:border-slate-800 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={APP_LOGO_URL} className="w-9 h-9" alt="Logo" />
            <div>
               <h1 className="font-black text-xs uppercase tracking-tighter dark:text-white">HerniPrint <span className="text-blue-600">Pro</span></h1>
               <p className="text-[8px] font-bold text-slate-400 uppercase">Premium Thermal Suite</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl border dark:border-slate-700">
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-600" />}
            </button>
            <button onClick={() => setActiveModal(ModalType.SETTINGS)} className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl border dark:border-slate-700">
              <Settings className="w-4 h-4 dark:text-white" />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto p-4 pb-40 space-y-6">
        {/* Status Connection */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border dark:border-slate-800 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">Status Printer</p>
              <p className="text-xs font-bold dark:text-white">{isConnected ? `${deviceName} (${connType})` : 'Printer Terputus'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={connectBT} title="Hubungkan via Bluetooth" className={`p-2.5 rounded-xl border transition-all ${connType === 'BT' ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 border-blue-100 dark:border-blue-800'}`}><Bluetooth className="w-4 h-4"/></button>
            <button onClick={connectUSB} title="Hubungkan via USB" className={`p-2.5 rounded-xl border transition-all ${connType === 'USB' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}><Usb className="w-4 h-4"/></button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[
            { id: 'RECEIPT', icon: ShoppingBag, label: 'Kasir', color: 'emerald', action: () => {setPrintMode('RECEIPT'); setActiveModal(ModalType.RECEIPT)} },
            { id: 'SHIPPING', icon: Truck, label: 'Resi', color: 'orange', action: () => {setPrintMode('SHIPPING'); setActiveModal(ModalType.SHIPPING)} },
            { id: 'IMAGE', icon: ImageIcon, label: 'Gambar', color: 'rose', action: () => imageInputRef.current?.click() },
            { id: 'QR', icon: QrCode, label: 'QR', color: 'blue', action: () => setPrintMode('QR') },
            { id: 'BARCODE', icon: BarcodeIcon, label: 'Barcode', color: 'purple', action: () => setPrintMode('BARCODE') },
            { id: 'INFO', icon: Info, label: 'Bantuan', color: 'slate', action: () => setActiveModal(ModalType.ABOUT) },
          ].map((m) => (
            <button key={m.id} onClick={m.action} className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all hover:scale-105 active:scale-95 bg-white dark:bg-slate-900 ${printMode === m.id ? 'border-blue-500 ring-4 ring-blue-500/10 shadow-lg' : 'border-slate-100 dark:border-slate-800'}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-${m.color}-500/10 text-${m.color}-600`}><m.icon className="w-5 h-5" /></div>
              <span className="text-[9px] font-black uppercase dark:text-slate-400">{m.label}</span>
            </button>
          ))}
        </div>

        {/* Paper Preview */}
        <div className="bg-slate-200 dark:bg-slate-800 rounded-[2.5rem] p-6 flex justify-center shadow-inner overflow-hidden min-h-[500px]">
          <div ref={previewRef} className={`bg-white text-black font-mono text-[10px] p-6 shadow-2xl transition-all duration-500 ${paperSize === '58' ? 'w-[280px]' : 'w-[360px]'} h-fit min-h-[400px]`}>
            <div className="text-center border-b border-dashed border-black pb-4 mb-5 flex flex-col items-center">
              <img src={APP_LOGO_URL} className="w-10 h-10 grayscale mb-2" alt="Logo" />
              <p className="font-black text-xs uppercase tracking-widest">HERNIPRINT PRO</p>
              <p className="text-[7px] uppercase opacity-50">Intelligent Printing Solution</p>
            </div>

            {printMode === 'RECEIPT' && (
              <div className="space-y-2">
                {items.length === 0 ? <div className="py-10 text-center opacity-30 italic text-[8px]">Belum ada item...</div> : items.map(item => (
                  <div key={item.id} className="flex justify-between items-start gap-4">
                    <span className="uppercase flex-1 leading-tight">{item.name} x{item.qty}</span>
                    <span className="font-bold">{(item.price * item.qty).toLocaleString()}</span>
                  </div>
                ))}
                <div className="border-t-2 border-dashed border-black mt-4 pt-3 flex justify-between items-center">
                  <span className="font-black text-[11px]">TOTAL</span>
                  <span className="font-black text-[11px]">Rp{totalBelanja.toLocaleString()}</span>
                </div>
              </div>
            )}

            {printMode === 'SHIPPING' && (
              <div className="space-y-4">
                <div className="bg-black text-white text-center py-1 font-black text-[9px] tracking-[4px]">SHIPPING LABEL</div>
                <div className="space-y-1">
                  <p className="text-[7px] font-bold opacity-40 uppercase">Penerima:</p>
                  <p className="font-black text-sm uppercase leading-none">{shippingData.toName || 'NAMA PENERIMA'}</p>
                  <p className="font-bold text-[10px]">{shippingData.toPhone || 'TELEPON'}</p>
                  <p className="leading-tight text-[9px] pt-1">{shippingData.toAddress || 'ALAMAT LENGKAP'}</p>
                </div>
                <div className="border-t border-dashed border-black pt-3">
                  <p className="text-[7px] font-bold opacity-40 uppercase">Pengirim:</p>
                  <p className="font-bold text-[9px] uppercase">{shippingData.fromName} ({shippingData.fromPhone})</p>
                </div>
                <div className="flex justify-between items-center border border-black p-2 mt-2">
                  <div className="flex items-center gap-2"><Truck className="w-4 h-4"/> <span className="font-black uppercase">{shippingData.courier}</span></div>
                  <span className="font-bold italic text-[8px]">ECO-PRT</span>
                </div>
              </div>
            )}

            {printMode === 'IMAGE' && uploadedImage && <img src={uploadedImage} className="w-full grayscale contrast-125 mb-4" />}
            
            <div className="text-center pt-10 border-t border-dashed border-black mt-10">
              <p className="text-[8px] italic opacity-40 tracking-widest uppercase">--- HerniPrint Pro ---</p>
              <p className="text-[7px] mt-1">{new Date().toLocaleString()}</p>
            </div>
            <div className="h-20" />
          </div>
        </div>
      </main>

      {/* Floating Action Menu */}
      <div className="fixed bottom-0 left-0 right-0 p-8 flex justify-center items-center pointer-events-none">
        <button 
          onClick={handlePrint}
          disabled={isPrinting}
          className="w-20 h-20 bg-blue-600 text-white rounded-full shadow-2xl border-8 border-white dark:border-slate-950 flex items-center justify-center active:scale-90 transition-all pointer-events-auto disabled:opacity-50"
        >
          {isPrinting ? <Loader2 className="animate-spin w-8 h-8" /> : <Printer className="w-9 h-9" />}
        </button>
      </div>

      {/* Hidden Inputs */}
      <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={(e) => {
        const f = e.target.files?.[0]; if(f) { const r=new FileReader(); r.onload=(ev)=>setUploadedImage(ev.target?.result as string); r.readAsDataURL(f); setPrintMode('IMAGE'); }
      }} />
      <input type="file" ref={aiInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleSmartScan} />

      {/* Modals */}
      {activeModal === ModalType.RECEIPT && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-black text-[10px] uppercase tracking-widest dark:text-white">Input Transaksi</h3>
                <p className="text-[8px] text-slate-400 font-bold uppercase">Manual atau Smart Scan</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => aiInputRef.current?.click()} 
                  disabled={isAnalyzing}
                  className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center gap-2 border border-blue-100 dark:border-blue-800"
                >
                  {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin"/> : <BrainCircuit className="w-4 h-4"/>}
                  <span className="text-[9px] font-black uppercase">Scan AI</span>
                </button>
                <button onClick={() => setActiveModal(ModalType.NONE)} className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 dark:text-white"><X className="w-4 h-4"/></button>
              </div>
            </div>
            
            <div className="space-y-3 mb-6 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border dark:border-slate-700">
              <input placeholder="Nama Produk" className="w-full p-3.5 rounded-xl border-none ring-1 ring-slate-200 dark:ring-slate-700 dark:bg-slate-900 dark:text-white text-xs" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Harga" type="number" className="p-3.5 rounded-xl border-none ring-1 ring-slate-200 dark:ring-slate-700 dark:bg-slate-900 dark:text-white text-xs" value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} />
                <input placeholder="Jumlah" type="number" className="p-3.5 rounded-xl border-none ring-1 ring-slate-200 dark:ring-slate-700 dark:bg-slate-900 dark:text-white text-xs" value={newItem.qty} onChange={e => setNewItem({...newItem, qty: e.target.value})} />
              </div>
              <button onClick={() => {
                if(!newItem.name || !newItem.price) return;
                setItems([...items, { id: crypto.randomUUID(), name: newItem.name, price: Number(newItem.price), qty: Number(newItem.qty) }]);
                setNewItem({ name: '', price: '', qty: '1' });
              }} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase">+ Tambah Manual</button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 mb-4 min-h-[100px]">
              {items.map(i => (
                <div key={i.id} className="p-3 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl flex justify-between items-center">
                  <div className="flex-1 pr-3">
                    <p className="text-xs font-bold dark:text-white uppercase truncate">{i.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold">{i.qty} x Rp{i.price.toLocaleString()}</p>
                  </div>
                  <button onClick={() => setItems(items.filter(x => x.id !== i.id))} className="p-2 text-rose-500"><Trash2 className="w-4 h-4"/></button>
                </div>
              ))}
            </div>

            <div className="pt-5 border-t dark:border-slate-800 flex justify-between items-center">
               <div>
                 <p className="text-[8px] font-black text-slate-400 uppercase">Grand Total</p>
                 <p className="text-xl font-black text-emerald-600 leading-none">Rp{totalBelanja.toLocaleString()}</p>
               </div>
               <button onClick={() => setActiveModal(ModalType.NONE)} className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase">Selesai</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Shipping */}
      {activeModal === ModalType.SHIPPING && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl overflow-y-auto no-scrollbar max-h-[90vh]">
             <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-black text-[10px] uppercase tracking-widest dark:text-white">Data Pengiriman</h3>
                  <p className="text-[8px] text-slate-400 font-bold uppercase">Lengkapi atau Scan Paket</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => aiInputRef.current?.click()} className="p-3 rounded-xl bg-orange-50 dark:bg-orange-900/30 text-orange-600 border border-orange-100 dark:border-orange-800">
                    {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Scan className="w-4 h-4"/>}
                  </button>
                  <button onClick={() => setActiveModal(ModalType.NONE)} className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 dark:text-white"><X/></button>
                </div>
             </div>
             <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <input className="w-full p-4 bg-slate-50 dark:bg-slate-800 dark:text-white rounded-2xl border dark:border-slate-700 text-xs" value={shippingData.toName} onChange={e => setShippingData({...shippingData, toName: e.target.value})} placeholder="Penerima" />
                  <input className="w-full p-4 bg-slate-50 dark:bg-slate-800 dark:text-white rounded-2xl border dark:border-slate-700 text-xs" value={shippingData.toPhone} onChange={e => setShippingData({...shippingData, toPhone: e.target.value})} placeholder="No. Telp" />
                </div>
                <textarea rows={3} className="w-full p-4 bg-slate-50 dark:bg-slate-800 dark:text-white rounded-2xl border dark:border-slate-700 text-xs" value={shippingData.toAddress} onChange={e => setShippingData({...shippingData, toAddress: e.target.value})} placeholder="Alamat Lengkap" />
                <div className="grid grid-cols-2 gap-3">
                  <input className="w-full p-4 bg-slate-50 dark:bg-slate-800 dark:text-white rounded-2xl border dark:border-slate-700 text-xs" value={shippingData.courier} onChange={e => setShippingData({...shippingData, courier: e.target.value})} placeholder="Kurir" />
                  <input className="w-full p-4 bg-slate-50 dark:bg-slate-800 dark:text-white rounded-2xl border dark:border-slate-700 text-xs" value={shippingData.fromName} onChange={e => setShippingData({...shippingData, fromName: e.target.value})} placeholder="Pengirim" />
                </div>
                <button onClick={() => setActiveModal(ModalType.NONE)} className="w-full py-5 bg-orange-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-orange-500/20 mt-4">Simpan & Tutup</button>
             </div>
          </div>
        </div>
      )}

      {/* Modal: Settings */}
      {activeModal === ModalType.SETTINGS && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6">
            <h3 className="font-black text-[10px] uppercase tracking-widest mb-6 dark:text-white">Konfigurasi Kertas</h3>
            <div className="grid grid-cols-2 gap-3 mb-6">
               <button onClick={() => setPaperSize('58')} className={`p-6 rounded-2xl border-2 font-black text-xs transition-all ${paperSize === '58' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-100 dark:border-slate-800 dark:text-white'}`}>58mm</button>
               <button onClick={() => setPaperSize('80')} className={`p-6 rounded-2xl border-2 font-black text-xs transition-all ${paperSize === '80' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-100 dark:border-slate-800 dark:text-white'}`}>80mm</button>
            </div>
            <button onClick={() => setActiveModal(ModalType.NONE)} className="w-full py-4 bg-slate-900 dark:bg-white dark:text-black text-white rounded-2xl font-black text-[10px] uppercase">Tutup</button>
          </div>
        </div>
      )}

      {/* Toast Alert */}
      {alert && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 duration-300">
          <div className={`px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border ${
            alert.type === 'success' ? 'bg-emerald-500 border-emerald-400' : 
            alert.type === 'error' ? 'bg-rose-500 border-rose-400' : 
            alert.type === 'warning' ? 'bg-amber-500 border-amber-400' :
            'bg-slate-900 border-slate-700'
          } text-white`}>
            {alert.type === 'success' ? <CheckCircle2 className="w-4 h-4"/> : 
             alert.type === 'warning' ? <AlertTriangle className="w-4 h-4"/> : <Info className="w-4 h-4"/>}
            <span className="text-[10px] font-black uppercase tracking-wider">{alert.msg}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
