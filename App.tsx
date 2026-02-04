
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Printer, Settings, Image as ImageIcon, FileText, QrCode, Barcode as BarcodeIcon, 
  Truck, ShoppingBag, Plus, Minus, RotateCw, X, ChevronRight, 
  Bluetooth, Trash2, Loader2, Info,
  CheckCircle2, Smartphone, DownloadCloud, ShieldCheck, MapPin,
  Usb, ExternalLink, MessageCircle, AlertTriangle, ArrowLeft,
  Moon, Sun, Share2, Save, Star, Type as TypeIcon, Send, FileWarning, Shield,
  Hash, Battery, Activity, Cpu, Scan, FileJson, User, Info as InfoIcon
} from 'lucide-react';

// External Libraries via ESM
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import * as pdfjsLib from 'pdfjs-dist';
import { Html5QrcodeScanner } from 'html5-qrcode';

// Services & Utils
import { printerService } from './services/bluetoothService';
import { usbService } from './services/usbService';
import { processToThermal } from './utils/thermalProcessor';

// Configure PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs`;

// --- Constants ---
const APP_LOGO_URL = "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjWrsxhrCF6FKRh9DnNBd3OzTH0X-EzoHau9zd8BSkKZzoRD-cDWLhtRluLW8FXHd9sxdZSutRlTAcghHKi8ZVapoCSOZmNA3kb9Gm6CIxpFJhYVeFkiHgtWxrvo11ldl8_8GpjNEvsvj3QOSB0PkPDAkyO7tNTPmTBeym5ij9evvK1V52dsx-A7RPE95hk/s500/Gemini_Generated_Image_3r9p5m3r9p5m3r9p-removebg-preview.png";
const TELEGRAM_LINK = "https://t.me/herni_print"; // Ganti dengan link telegram Anda

// --- Types ---
type PaperSize = '58' | '80';
enum ModalType { 
  NONE, 
  SHIPPING, 
  RECEIPT, 
  SETTINGS, 
  ABOUT, 
  CONNECT_GUIDE,
  CODE_GEN,
  SCANNER,
  PRIVACY,
  DISCLAIMER
}

interface ReceiptItem { id: string; name: string; price: number; qty: number; }
interface ShippingData { 
  toName: string; toPhone: string; toAddress: string; 
  fromName: string; fromPhone: string; courier: string; 
  trackingNumber: string; note: string; 
}

const App: React.FC = () => {
  // Global & UI State
  const [activeModal, setActiveModal] = useState<ModalType>(ModalType.NONE);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connType, setConnType] = useState<'BT' | 'USB' | null>(null);
  const [deviceName, setDeviceName] = useState('');
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [paperSize, setPaperSize] = useState<PaperSize>('58');
  const [alert, setAlert] = useState<{msg: string, type: 'success' | 'error' | 'info' | 'warning'} | null>(null);
  
  // PWA & Connection
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);
  const [pendingConn, setPendingConn] = useState<'BT' | 'USB' | null>(null);

  // Feature Data
  const [printMode, setPrintMode] = useState<'RECEIPT' | 'SHIPPING' | 'IMAGE' | 'QR' | 'BARCODE' | 'PDF'>('RECEIPT');
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [newItem, setNewItem] = useState({ name: '', price: '', qty: '1' });
  const [shippingData, setShippingData] = useState<ShippingData>({
    toName: '', toPhone: '', toAddress: '', fromName: '', fromPhone: '', courier: '', trackingNumber: '', note: ''
  });
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [pdfCanvas, setPdfCanvas] = useState<HTMLCanvasElement | null>(null);

  // QR & Barcode
  const [codeType, setCodeType] = useState<'QR' | 'BARCODE'>('QR');
  const [codeValue, setCodeValue] = useState('HerniPrint Pro');
  const [generatedCodeUrl, setGeneratedCodeUrl] = useState<string | null>(null);

  // Refs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // --- Handlers ---

  const triggerAlert = (msg: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 4000);
  };

  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsPWAInstalled(true);
    }
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) {
      if (isPWAInstalled) triggerAlert("Aplikasi sudah terinstal", "info");
      else triggerAlert("Gunakan menu browser 'Tambahkan ke Layar Utama'", "info");
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') { setIsPWAInstalled(true); setDeferredPrompt(null); triggerAlert("Berhasil diinstal!", "success"); }
  };

  const execConnectBT = async () => {
    setActiveModal(ModalType.NONE);
    try {
      const name = await printerService.connect();
      setDeviceName(name); setIsConnected(true); setConnType('BT');
      const battery = await printerService.getBatteryLevel();
      setBatteryLevel(battery);
      triggerAlert(`Terhubung ke ${name}`, "success");
    } catch (e) { triggerAlert("Koneksi Bluetooth Gagal", "error"); }
  };

  const execConnectUSB = async () => {
    setActiveModal(ModalType.NONE);
    try {
      const name = await usbService.connect();
      setDeviceName(name); setIsConnected(true); setConnType('USB');
      triggerAlert(`Terhubung ke ${name}`, "success");
    } catch (e) { triggerAlert("Koneksi USB Gagal", "error"); }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'IMAGE' | 'PDF') => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (type === 'IMAGE') {
      const r = new FileReader();
      r.onload = (ev) => { setUploadedImage(ev.target?.result as string); setPrintMode('IMAGE'); triggerAlert("Gambar Dimuat", "success"); };
      r.readAsDataURL(file);
    } else if (type === 'PDF') {
      const r = new FileReader();
      r.onload = async (ev) => {
        try {
          const typedarray = new Uint8Array(ev.target?.result as ArrayBuffer);
          const pdf = await pdfjsLib.getDocument(typedarray).promise;
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          await page.render({ canvasContext: ctx!, viewport }).promise;
          setPdfCanvas(canvas); setPrintMode('PDF'); triggerAlert("PDF Siap Cetak", "success");
        } catch (err) { triggerAlert("PDF Error", "error"); }
      };
      r.readAsArrayBuffer(file);
    }
  };

  const generateCode = async () => {
    try {
      if (codeType === 'QR') {
        const url = await QRCode.toDataURL(codeValue, { width: 400, margin: 2 });
        setGeneratedCodeUrl(url);
      } else {
        const canvas = document.createElement('canvas');
        JsBarcode(canvas, codeValue, { format: "CODE128", width: 2, height: 100, displayValue: true });
        setGeneratedCodeUrl(canvas.toDataURL("image/png"));
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (activeModal === ModalType.CODE_GEN || printMode === 'QR' || printMode === 'BARCODE') generateCode();
  }, [codeValue, codeType, printMode]);

  const startScanner = () => {
    setActiveModal(ModalType.SCANNER);
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
      scanner.render((decodedText) => {
        setCodeValue(decodedText); scanner.clear(); setActiveModal(ModalType.CODE_GEN); triggerAlert("Scan Berhasil", "success");
      }, () => {});
    }, 100);
  };

  const handlePrint = async () => {
    if (!isConnected) return triggerAlert("Printer belum terhubung!", "warning");
    setIsPrinting(true);
    try {
      const width = paperSize === '58' ? 384 : 576;
      let thermalData: Uint8Array;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      const ctx = canvas.getContext('2d')!;

      if (printMode === 'IMAGE' && uploadedImage) {
        const img = new Image(); img.src = uploadedImage;
        await new Promise((r) => { img.onload = r; });
        canvas.height = (img.height * width) / img.width;
        ctx.drawImage(img, 0, 0, width, canvas.height);
        thermalData = processToThermal(canvas, width);
      } else if (printMode === 'PDF' && pdfCanvas) {
        canvas.height = (pdfCanvas.height * width) / pdfCanvas.width;
        ctx.drawImage(pdfCanvas, 0, 0, width, canvas.height);
        thermalData = processToThermal(canvas, width);
      } else if ((printMode === 'QR' || printMode === 'BARCODE') && generatedCodeUrl) {
        const img = new Image(); img.src = generatedCodeUrl;
        await new Promise((r) => { img.onload = r; });
        canvas.height = width + 80;
        ctx.fillStyle = 'white'; ctx.fillRect(0,0,width,canvas.height);
        ctx.drawImage(img, 20, 20, width-40, width-40);
        ctx.fillStyle = 'black'; ctx.textAlign = 'center'; ctx.font = '18px monospace';
        ctx.fillText(codeValue, width/2, width + 40);
        thermalData = processToThermal(canvas, width);
      } else {
        // DINAMIS: RECEIPT & SHIPPING
        let h = 200;
        if (printMode === 'RECEIPT') h += items.length * 50 + 250;
        else if (printMode === 'SHIPPING') h += 750;

        canvas.height = h;
        ctx.fillStyle = 'white'; ctx.fillRect(0, 0, width, h);
        ctx.fillStyle = 'black'; ctx.textAlign = 'center';
        let y = 50;
        ctx.font = 'bold 28px monospace'; ctx.fillText("HERNIPRINT PRO", width/2, y); y += 35;
        ctx.font = '16px monospace'; ctx.fillText(new Date().toLocaleString(), width/2, y); y += 45;
        ctx.fillText("--------------------------------", width/2, y); y += 35;

        if (printMode === 'RECEIPT') {
          items.forEach(i => {
            ctx.textAlign = 'left'; ctx.font = 'bold 18px monospace';
            ctx.fillText(`${i.name.toUpperCase()} x${i.qty}`, 20, y);
            ctx.textAlign = 'right'; ctx.fillText((i.price * i.qty).toLocaleString(), width-20, y);
            y += 35;
          });
          y += 25; ctx.textAlign = 'center'; ctx.font = 'bold 24px monospace';
          ctx.fillText("TOTAL: Rp " + items.reduce((a,b)=>a+(b.price*b.qty),0).toLocaleString(), width/2, y);
        } else if (printMode === 'SHIPPING') {
          ctx.textAlign = 'center'; ctx.font = 'bold 20px monospace';
          ctx.fillRect(0, y-25, width, 40); ctx.fillStyle = 'white';
          ctx.fillText("SHIPPING LABEL", width/2, y+5); ctx.fillStyle = 'black'; y += 60;

          ctx.textAlign = 'left'; ctx.font = 'bold 18px monospace';
          ctx.fillText("PENERIMA:", 20, y); y += 30;
          ctx.font = 'bold 26px monospace'; ctx.fillText(shippingData.toName.toUpperCase(), 20, y); y += 35;
          ctx.font = '20px monospace'; ctx.fillText(shippingData.toPhone, 20, y); y += 40;
          
          ctx.font = '18px monospace';
          const wrapText = (t: string, max: number) => {
            const words = t.split(' '); let lines = []; let current = '';
            words.forEach(w => { if ((current + w).length > max) { lines.push(current); current = w + ' '; } else current += w + ' '; });
            lines.push(current); return lines;
          };
          wrapText(shippingData.toAddress, 25).forEach(line => { ctx.fillText(line, 20, y); y += 25; });

          y += 25; ctx.fillText("--------------------------------", width/2, y); y += 35;
          ctx.font = 'bold 18px monospace';
          ctx.fillText("KURIR: " + (shippingData.courier || "-").toUpperCase(), 20, y); y += 30;
          ctx.fillText("RESI : " + (shippingData.trackingNumber || "-").toUpperCase(), 20, y); y += 50;

          if (shippingData.fromName) {
            ctx.fillText("PENGIRIM:", 20, y); y += 30;
            ctx.font = '16px monospace'; 
            ctx.fillText(shippingData.fromName.toUpperCase() + " (" + shippingData.fromPhone + ")", 20, y);
          }
        }
        y += 60; ctx.textAlign = 'center'; ctx.font = '14px monospace'; ctx.fillText("Terima Kasih - HerniPrint Pro", width/2, y);
        thermalData = processToThermal(canvas, width);
      }
      
      if (connType === 'BT') await printerService.print(thermalData);
      else await usbService.print(thermalData);
      triggerAlert("Cetak Berhasil!", "success");
    } catch (e) { triggerAlert("Gagal Cetak", "error"); }
    finally { setIsPrinting(false); }
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
               <p className="text-[8px] font-bold text-slate-400 uppercase">Premium Printing Suite</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl border dark:border-slate-700 transition-colors">
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-600" />}
            </button>
            <button onClick={() => setActiveModal(ModalType.SETTINGS)} className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl border dark:border-slate-700 transition-colors">
              <Settings className="w-4 h-4 dark:text-white" />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto p-4 pb-40 space-y-6">
        {/* Status Koneksi */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border dark:border-slate-800 flex flex-col gap-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-3.5 h-3.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1.5 tracking-wider">Status Printer</p>
                <p className="text-sm font-black dark:text-white truncate max-w-[150px]">{isConnected ? deviceName : 'Printer Terputus'}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => {setPendingConn('BT'); setActiveModal(ModalType.CONNECT_GUIDE)}} className={`p-3 rounded-xl border transition-all ${connType === 'BT' ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 border-blue-100 dark:border-blue-800'}`}><Bluetooth className="w-5 h-5"/></button>
              <button onClick={() => {setPendingConn('USB'); setActiveModal(ModalType.CONNECT_GUIDE)}} className={`p-3 rounded-xl border transition-all ${connType === 'USB' ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 border-slate-200 dark:border-slate-700'}`}><Usb className="w-5 h-5"/></button>
            </div>
          </div>
        </div>

        {/* Grid Fitur Utama */}
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {[
            { id: 'RECEIPT', icon: ShoppingBag, label: 'Kasir', color: 'emerald', action: () => {setPrintMode('RECEIPT'); setActiveModal(ModalType.RECEIPT)} },
            { id: 'SHIPPING', icon: Truck, label: 'Resi', color: 'orange', action: () => {setPrintMode('SHIPPING'); setActiveModal(ModalType.SHIPPING)} },
            { id: 'IMAGE', icon: ImageIcon, label: 'Foto', color: 'rose', action: () => imageInputRef.current?.click() },
            { id: 'PDF', icon: FileText, label: 'PDF', color: 'indigo', action: () => pdfInputRef.current?.click() },
            { id: 'QR', icon: QrCode, label: 'QR', color: 'blue', action: () => {setCodeType('QR'); setActiveModal(ModalType.CODE_GEN)} },
            { id: 'BARCODE', icon: BarcodeIcon, label: 'Bar', color: 'purple', action: () => {setCodeType('BARCODE'); setActiveModal(ModalType.CODE_GEN)} },
            { id: 'SCAN', icon: Scan, label: 'Scan', color: 'amber', action: startScanner },
            { id: 'INFO', icon: InfoIcon, label: 'About', color: 'slate', action: () => setActiveModal(ModalType.ABOUT) },
          ].map((m) => (
            <button key={m.id} onClick={m.action} className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all hover:scale-105 active:scale-95 bg-white dark:bg-slate-900 ${printMode === m.id ? 'border-blue-500 ring-2 ring-blue-500/10 shadow-md' : 'border-slate-100 dark:border-slate-800'}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-${m.color}-500/10 text-${m.color}-600`}><m.icon className="w-4 h-4" /></div>
              <span className="text-[7px] font-black uppercase dark:text-slate-400 text-center leading-tight">{m.label}</span>
            </button>
          ))}
        </div>

        {/* Area Preview Kertas Thermal */}
        <div className="bg-slate-200 dark:bg-slate-800 rounded-[2rem] p-6 flex justify-center shadow-inner min-h-[400px]">
          <div ref={previewRef} className={`bg-white text-black font-mono text-[9px] p-6 shadow-2xl transition-all duration-500 ${paperSize === '58' ? 'w-[260px]' : 'w-[340px]'} h-fit`}>
            <div className="text-center border-b border-dashed border-black pb-4 mb-4 flex flex-col items-center">
              <img src={APP_LOGO_URL} className="w-8 h-8 grayscale mb-1" alt="Logo" />
              <p className="font-black text-[10px] uppercase">HERNIPRINT PRO</p>
            </div>

            {printMode === 'RECEIPT' && (
              <div className="space-y-1">
                {items.length === 0 ? <p className="text-center py-4 opacity-30 italic">Belum Ada Item</p> : items.map(i => (
                  <div key={i.id} className="flex justify-between">
                    <span className="truncate max-w-[150px]">{i.name} x{i.qty}</span>
                    <span className="font-bold">{(i.price * i.qty).toLocaleString()}</span>
                  </div>
                ))}
                <div className="border-t border-black mt-4 pt-2 flex justify-between font-black text-[11px]">
                  <span>TOTAL</span>
                  <span>Rp {totalBelanja.toLocaleString()}</span>
                </div>
              </div>
            )}

            {printMode === 'SHIPPING' && (
              <div className="space-y-3">
                <div className="bg-black text-white text-center py-1 font-black text-[8px] tracking-widest uppercase">Shipping Label</div>
                <div>
                   <p className="text-[7px] opacity-40 uppercase font-black">Penerima:</p>
                   <p className="font-black text-xs uppercase">{shippingData.toName || "Nama Penerima"}</p>
                   <p className="font-bold text-[10px]">{shippingData.toPhone || "Nomor HP"}</p>
                   <p className="leading-tight mt-1">{shippingData.toAddress || "Alamat Lengkap"}</p>
                </div>
                <div className="border-t border-dashed border-black pt-2 text-[8px] font-bold">
                   <p>KURIR: {(shippingData.courier || "-").toUpperCase()}</p>
                   <p>RESI : {(shippingData.trackingNumber || "-").toUpperCase()}</p>
                </div>
                {shippingData.fromName && (
                  <div className="border-t border-dashed border-black pt-2">
                    <p className="text-[7px] opacity-40 uppercase font-black">Pengirim:</p>
                    <p className="font-bold text-[8px]">{shippingData.fromName} ({shippingData.fromPhone})</p>
                  </div>
                )}
              </div>
            )}

            {printMode === 'IMAGE' && uploadedImage && <img src={uploadedImage} className="w-full grayscale contrast-125 rounded-sm" />}
            {printMode === 'PDF' && pdfCanvas && <img src={pdfCanvas.toDataURL()} className="w-full grayscale contrast-125" />}
            {(printMode === 'QR' || printMode === 'BARCODE') && generatedCodeUrl && (
              <div className="text-center flex flex-col items-center gap-2">
                <img src={generatedCodeUrl} className="w-full" />
                <p className="font-bold text-[8px] break-all">{codeValue}</p>
              </div>
            )}

            <div className="text-center pt-8 border-t border-dashed border-black mt-8 text-[7px] opacity-40 uppercase">
              {new Date().toLocaleString()}
              <p className="mt-1">Terima Kasih - HerniPrint Pro</p>
            </div>
            <div className="h-10" />
          </div>
        </div>
      </main>

      {/* FAB Cetak Utama */}
      <div className="fixed bottom-0 left-0 right-0 p-8 flex justify-center items-center pointer-events-none">
        <button onClick={handlePrint} disabled={isPrinting} className="w-20 h-20 bg-blue-600 text-white rounded-full shadow-2xl border-8 border-white dark:border-slate-950 flex items-center justify-center active:scale-90 transition-all pointer-events-auto disabled:opacity-50">
          {isPrinting ? <Loader2 className="animate-spin w-8 h-8" /> : <Printer className="w-9 h-9" />}
        </button>
      </div>

      {/* --- SEMUA MODAL --- */}

      {/* Modal Resi (SHIPPING) - LENGKAP */}
      {activeModal === ModalType.SHIPPING && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
             <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-[10px] uppercase tracking-widest dark:text-white flex items-center gap-2"><Truck className="w-4 h-4 text-orange-500" /> Data Pengiriman</h3>
                <button onClick={() => setActiveModal(ModalType.NONE)} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl dark:text-white"><X className="w-4 h-4"/></button>
             </div>
             
             <div className="space-y-4">
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border dark:border-slate-700 space-y-3">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Penerima</p>
                  <input className="w-full p-4 bg-white dark:bg-slate-900 dark:text-white rounded-xl border-none ring-1 ring-slate-200 dark:ring-slate-700 text-xs" value={shippingData.toName} onChange={e => setShippingData({...shippingData, toName: e.target.value})} placeholder="Nama Penerima" />
                  <input className="w-full p-4 bg-white dark:bg-slate-900 dark:text-white rounded-xl border-none ring-1 ring-slate-200 dark:ring-slate-700 text-xs" value={shippingData.toPhone} onChange={e => setShippingData({...shippingData, toPhone: e.target.value})} placeholder="Nomor HP Penerima" />
                  <textarea rows={3} className="w-full p-4 bg-white dark:bg-slate-900 dark:text-white rounded-xl border-none ring-1 ring-slate-200 dark:ring-slate-700 text-xs" value={shippingData.toAddress} onChange={e => setShippingData({...shippingData, toAddress: e.target.value})} placeholder="Alamat Lengkap" />
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border dark:border-slate-700 space-y-3">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Ekspedisi</p>
                  <div className="grid grid-cols-2 gap-3">
                    <input className="w-full p-4 bg-white dark:bg-slate-900 dark:text-white rounded-xl border-none ring-1 ring-slate-200 dark:ring-slate-700 text-xs" value={shippingData.courier} onChange={e => setShippingData({...shippingData, courier: e.target.value})} placeholder="Kurir (J&T, JNE, dll)" />
                    <input className="w-full p-4 bg-white dark:bg-slate-900 dark:text-white rounded-xl border-none ring-1 ring-slate-200 dark:ring-slate-700 text-xs" value={shippingData.trackingNumber} onChange={e => setShippingData({...shippingData, trackingNumber: e.target.value})} placeholder="Nomor Resi" />
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border dark:border-slate-700 space-y-3">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Pengirim (Opsional)</p>
                  <input className="w-full p-4 bg-white dark:bg-slate-900 dark:text-white rounded-xl border-none ring-1 ring-slate-200 dark:ring-slate-700 text-xs" value={shippingData.fromName} onChange={e => setShippingData({...shippingData, fromName: e.target.value})} placeholder="Nama Pengirim" />
                  <input className="w-full p-4 bg-white dark:bg-slate-900 dark:text-white rounded-xl border-none ring-1 ring-slate-200 dark:ring-slate-700 text-xs" value={shippingData.fromPhone} onChange={e => setShippingData({...shippingData, fromPhone: e.target.value})} placeholder="Nomor HP Pengirim" />
                </div>

                <button onClick={() => { setPrintMode('SHIPPING'); setActiveModal(ModalType.NONE); triggerAlert("Resi Disimpan", "success"); }} className="w-full py-5 bg-orange-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-orange-500/30">Tampilkan di Preview</button>
             </div>
          </div>
        </div>
      )}

      {/* Modal Kasir (RECEIPT) */}
      {activeModal === ModalType.RECEIPT && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-[10px] uppercase tracking-widest dark:text-white">Daftar Belanja</h3>
              <button onClick={() => setActiveModal(ModalType.NONE)} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl dark:text-white"><X className="w-4 h-4"/></button>
            </div>
            
            <div className="space-y-3 mb-6 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border dark:border-slate-700">
              <input placeholder="Nama Produk" className="w-full p-4 rounded-xl border-none ring-1 ring-slate-200 dark:ring-slate-700 dark:bg-slate-900 dark:text-white text-xs" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Harga" type="number" className="p-4 rounded-xl border-none ring-1 ring-slate-200 dark:ring-slate-700 dark:bg-slate-900 dark:text-white text-xs" value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} />
                <input placeholder="Qty" type="number" className="p-4 rounded-xl border-none ring-1 ring-slate-200 dark:ring-slate-700 dark:bg-slate-900 dark:text-white text-xs" value={newItem.qty} onChange={e => setNewItem({...newItem, qty: e.target.value})} />
              </div>
              <button onClick={() => {
                if(!newItem.name || !newItem.price) return;
                setItems([...items, { id: crypto.randomUUID(), name: newItem.name, price: Number(newItem.price), qty: Number(newItem.qty) }]);
                setNewItem({ name: '', price: '', qty: '1' });
              }} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase active:scale-95">+ Tambah Item</button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 mb-4">
              {items.map(i => (
                <div key={i.id} className="p-4 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl flex justify-between items-center group animate-in slide-in-from-right duration-300">
                  <div className="flex-1 pr-3 truncate">
                    <p className="text-xs font-bold dark:text-white uppercase truncate">{i.name}</p>
                    <p className="text-[10px] text-slate-400">Rp {i.price.toLocaleString()} x {i.qty}</p>
                  </div>
                  <button onClick={() => setItems(items.filter(x => x.id !== i.id))} className="p-2 text-rose-500"><Trash2 className="w-4 h-4"/></button>
                </div>
              ))}
            </div>

            <div className="pt-5 border-t dark:border-slate-800 flex justify-between items-center">
               <div className="flex flex-col">
                 <p className="text-xl font-black text-emerald-600">Rp {totalBelanja.toLocaleString()}</p>
               </div>
               <button onClick={() => {setPrintMode('RECEIPT'); setActiveModal(ModalType.NONE)}} className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Settings */}
      {activeModal === ModalType.SETTINGS && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-full duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-[10px] uppercase tracking-widest dark:text-white">Pengaturan</h3>
              <button onClick={() => setActiveModal(ModalType.NONE)} className="p-3 bg-slate-100 dark:bg-slate-800 dark:text-white rounded-xl"><X className="w-4 h-4"/></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                 <button onClick={() => setPaperSize('58')} className={`p-4 rounded-xl border-2 font-black text-xs ${paperSize === '58' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'border-slate-100 dark:border-slate-800 dark:text-white'}`}>58mm</button>
                 <button onClick={() => setPaperSize('80')} className={`p-4 rounded-xl border-2 font-black text-xs ${paperSize === '80' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'border-slate-100 dark:border-slate-800 dark:text-white'}`}>80mm</button>
              </div>
              
              <button onClick={handleInstallPWA} className="w-full p-4 rounded-xl flex items-center justify-between border bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border-emerald-100 dark:border-emerald-800">
                <div className="flex items-center gap-3"><DownloadCloud className="w-4 h-4"/><span className="text-[10px] font-black uppercase">Install PWA</span></div>
                <ChevronRight className="w-4 h-4"/>
              </button>

              <div className="pt-2 space-y-2">
                 <button onClick={() => window.open(TELEGRAM_LINK, '_blank')} className="w-full p-4 rounded-xl flex items-center justify-between border bg-blue-50 dark:bg-blue-900/20 text-blue-600 border-blue-100 dark:border-blue-800">
                    <div className="flex items-center gap-3"><Send className="w-4 h-4"/><span className="text-[10px] font-black uppercase">Grup Telegram</span></div>
                    <ExternalLink className="w-4 h-4"/>
                 </button>
                 <button onClick={() => setActiveModal(ModalType.PRIVACY)} className="w-full p-4 rounded-xl flex items-center justify-between border dark:border-slate-800 dark:text-white">
                    <div className="flex items-center gap-3"><Shield className="w-4 h-4"/><span className="text-[10px] font-black uppercase">Kebijakan Privasi</span></div>
                    <ChevronRight className="w-4 h-4"/>
                 </button>
                 <button onClick={() => setActiveModal(ModalType.DISCLAIMER)} className="w-full p-4 rounded-xl flex items-center justify-between border dark:border-slate-800 dark:text-white">
                    <div className="flex items-center gap-3"><FileWarning className="w-4 h-4"/><span className="text-[10px] font-black uppercase">Disclaimer</span></div>
                    <ChevronRight className="w-4 h-4"/>
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Privacy */}
      {activeModal === ModalType.PRIVACY && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in zoom-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative">
             <button onClick={() => setActiveModal(ModalType.SETTINGS)} className="absolute top-6 right-6 p-3 bg-slate-100 dark:bg-slate-800 dark:text-white rounded-full"><ArrowLeft className="w-4 h-4"/></button>
             <h3 className="font-black text-xs uppercase tracking-widest mb-6 dark:text-white flex items-center gap-2"><Shield className="w-5 h-5 text-blue-600"/> Kebijakan Privasi</h3>
             <div className="text-[10px] text-slate-500 dark:text-slate-400 space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                <p><strong>1. Pengumpulan Data:</strong> HerniPrint Pro tidak mengumpulkan data pribadi di server luar. Semua data input kasir, resi, dan gambar diproses 100% secara lokal di browser Anda.</p>
                <p><strong>2. Izin Perangkat:</strong> Izin Bluetooth, USB, dan Kamera hanya digunakan untuk fungsionalitas aplikasi dan tidak pernah direkam atau dikirimkan ke pihak ketiga.</p>
                <p><strong>3. Keamanan:</strong> Karena aplikasi berjalan secara lokal, keamanan data sepenuhnya bergantung pada keamanan perangkat dan browser yang Anda gunakan.</p>
             </div>
             <button onClick={() => setActiveModal(ModalType.SETTINGS)} className="w-full py-4 mt-8 bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest">Tutup</button>
          </div>
        </div>
      )}

      {/* Modal Disclaimer */}
      {activeModal === ModalType.DISCLAIMER && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in zoom-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative">
             <button onClick={() => setActiveModal(ModalType.SETTINGS)} className="absolute top-6 right-6 p-3 bg-slate-100 dark:bg-slate-800 dark:text-white rounded-full"><ArrowLeft className="w-4 h-4"/></button>
             <h3 className="font-black text-xs uppercase tracking-widest mb-6 dark:text-white flex items-center gap-2"><FileWarning className="w-5 h-5 text-amber-500"/> Disclaimer</h3>
             <div className="text-[10px] text-slate-500 dark:text-slate-400 space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                <p><strong>Pelepasan Tanggung Jawab:</strong> HerniPrint Pro adalah alat bantu pencetakan. Kami tidak bertanggung jawab atas kesalahan input data, kegagalan hardware printer, atau penyalahgunaan fitur aplikasi untuk kegiatan ilegal.</p>
                <p><strong>Kesesuaian Printer:</strong> Hasil cetak mungkin berbeda tergantung pada merk dan tipe printer thermal yang digunakan. Kami tidak menjamin kompatibilitas 100% dengan semua jenis printer di pasar.</p>
                <p><strong>Kehilangan Data:</strong> Karena data disimpan secara lokal di cache browser, membersihkan cache browser dapat menyebabkan hilangnya data riwayat item yang sedang diinput.</p>
             </div>
             <button onClick={() => setActiveModal(ModalType.SETTINGS)} className="w-full py-4 mt-8 bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest">Saya Mengerti</button>
          </div>
        </div>
      )}

      {/* Modal About */}
      {activeModal === ModalType.ABOUT && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in zoom-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl text-center relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600"></div>
             <img src={APP_LOGO_URL} className="w-20 h-20 mx-auto mb-4" />
             <h2 className="font-black text-xs uppercase tracking-[5px] dark:text-white">HERNIPRINT <span className="text-blue-600">PRO</span></h2>
             <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 mb-6">Build 1.2.5 - Professional Suite</p>
             <div className="space-y-4 text-left border-y dark:border-slate-800 py-6 mb-6">
                <div className="flex gap-4 items-start"><ShieldCheck className="w-5 h-5 text-blue-600 mt-1"/><p className="text-[10px] text-slate-500 dark:text-slate-300 leading-relaxed">Berjalan 100% lokal. Data Anda tidak pernah dikirim ke siapapun.</p></div>
                <div className="flex gap-4 items-start"><Cpu className="w-5 h-5 text-indigo-600 mt-1"/><p className="text-[10px] text-slate-500 dark:text-slate-300 leading-relaxed">Support Printer Thermal ESC/POS via Bluetooth & USB.</p></div>
             </div>
             <button onClick={() => setActiveModal(ModalType.NONE)} className="w-full py-4 bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white rounded-2xl font-black text-[10px] uppercase active:scale-95 transition-all">Tutup</button>
          </div>
        </div>
      )}

      {/* MODAL LAIN (QR Gen, Scanner, Connection) Tetap dipertahankan agar fungsi tidak hilang */}
      {activeModal === ModalType.CODE_GEN && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <button onClick={() => setCodeType('QR')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${codeType === 'QR' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-400'}`}>QR Code</button>
                  <button onClick={() => setCodeType('BARCODE')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${codeType === 'BARCODE' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-400'}`}>Barcode</button>
                </div>
                <button onClick={() => setActiveModal(ModalType.NONE)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl dark:text-white"><X className="w-4 h-4"/></button>
              </div>
              <textarea className="w-full p-4 rounded-2xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white text-xs mb-4 outline-none focus:ring-2 ring-blue-500" rows={4} value={codeValue} onChange={(e) => setCodeValue(e.target.value)} placeholder="Teks atau Link..." />
              <button onClick={() => { setPrintMode(codeType); setActiveModal(ModalType.NONE); }} className="w-full py-4 bg-blue-600 text-white rounded-xl font-black text-[9px] uppercase shadow-lg shadow-blue-500/20">Gunakan</button>
           </div>
        </div>
      )}

      {activeModal === ModalType.SCANNER && (
        <div className="fixed inset-0 z-[110] bg-black flex flex-col p-6">
           <div className="flex justify-between items-center mb-10">
              <h3 className="text-white font-black uppercase text-[10px] tracking-widest">Scanner</h3>
              <button onClick={() => setActiveModal(ModalType.NONE)} className="p-4 bg-white/10 text-white rounded-full"><X/></button>
           </div>
           <div id="reader" className="w-full aspect-square overflow-hidden rounded-3xl border-4 border-blue-600 shadow-2xl bg-white"></div>
        </div>
      )}

      {activeModal === ModalType.CONNECT_GUIDE && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl text-center">
            <div className={`w-20 h-20 mx-auto mb-6 rounded-3xl flex items-center justify-center ${pendingConn === 'BT' ? 'bg-blue-500/10 text-blue-600' : 'bg-slate-500/10 text-slate-600'}`}>
              {pendingConn === 'BT' ? <Bluetooth className="w-10 h-10" /> : <Usb className="w-10 h-10" />}
            </div>
            <h3 className="font-black text-xs uppercase dark:text-white mb-2 tracking-widest">Koneksi Hardware</h3>
            <p className="text-[9px] text-slate-400 mb-8 leading-relaxed">Aktifkan printer Anda dan hubungkan melalui browser.</p>
            <button onClick={pendingConn === 'BT' ? execConnectBT : execConnectUSB} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-blue-500/40 active:scale-95 transition-transform mb-3">Mulai Hubungkan</button>
            <button onClick={() => setActiveModal(ModalType.NONE)} className="w-full py-2 text-slate-400 font-black text-[10px] uppercase">Batalkan</button>
          </div>
        </div>
      )}

      {/* Elemen Tersembunyi & Toast */}
      <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'IMAGE')} />
      <input type="file" ref={pdfInputRef} className="hidden" accept="application/pdf" onChange={(e) => handleFileUpload(e, 'PDF')} />
      
      {alert && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-10 duration-500">
          <div className={`px-8 py-4 rounded-full shadow-2xl flex items-center gap-4 border backdrop-blur-xl ${
            alert.type === 'success' ? 'bg-emerald-600/90 border-emerald-500' : 
            alert.type === 'error' ? 'bg-rose-600/90 border-rose-500' : 
            alert.type === 'warning' ? 'bg-amber-600/90 border-amber-500' : 'bg-slate-900/90 border-slate-700'
          } text-white`}>
            {alert.type === 'success' ? <CheckCircle2 className="w-5 h-5"/> : <Info className="w-5 h-5"/>}
            <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{alert.msg}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
