
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

// PDF Worker Configuration - Menggunakan CDN paling stabil
const PDFJS_VERSION = '4.0.379';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;

// --- Constants ---
const APP_LOGO_URL = "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjWrsxhrCF6FKRh9DnNBd3OzTH0X-EzoHau9zd8BSkKZzoRD-cDWLhtRluLW8FXHd9sxdZSutRlTAcghHKi8ZVapoCSOZmNA3kb9Gm6CIxpFJhYVeFkiHgtWxrvo11ldl8_8GpjNEvsvj3QOSB0PkPDAkyO7tNTPmTBeym5ij9evvK1V52dsx-A7RPE95hk/s500/Gemini_Generated_Image_3r9p5m3r9p5m3r9p-removebg-preview.png";
const TELEGRAM_LINK = "https://t.me/herni_print";

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
      else triggerAlert("Pilih 'Tambahkan ke Layar Utama' pada menu browser", "info");
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
      r.onload = (ev) => { 
        setUploadedImage(ev.target?.result as string); 
        setPrintMode('IMAGE'); 
        triggerAlert("Foto Dimuat", "success"); 
      };
      r.readAsDataURL(file);
    } else if (type === 'PDF') {
      const r = new FileReader();
      triggerAlert("Memproses PDF...", "info");
      r.onload = async (ev) => {
        try {
          const buffer = ev.target?.result as ArrayBuffer;
          const typedarray = new Uint8Array(buffer);
          
          if (String.fromCharCode(...typedarray.slice(0, 5)) !== '%PDF-') {
             throw new Error("Bukan file PDF valid.");
          }

          const loadingTask = pdfjsLib.getDocument({
             data: typedarray,
             disableFontFace: true,
             standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/cmaps/`
          });

          const pdf = await loadingTask.promise;
          const page = await pdf.getPage(1);
          
          // Render halaman ke canvas dengan kualitas tinggi
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) throw new Error("Canvas Error");
          
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({ canvasContext: ctx, viewport }).promise;
          
          setPdfCanvas(canvas); 
          setPrintMode('PDF'); 
          triggerAlert("PDF Siap Cetak", "success");
        } catch (err: any) { 
          console.error("PDF Fail:", err);
          triggerAlert(err.message || "Gagal Memuat PDF", "error"); 
        }
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

  // Helper: Wrap text for dynamic canvas height calculation
  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
    const words = text.split(' ');
    let lines = [];
    let currentLine = '';

    words.forEach(word => {
      const testLine = currentLine + word + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = word + ' ';
      } else {
        currentLine = testLine;
      }
    });
    lines.push(currentLine);
    return lines;
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

      // --- DYNAMIC HEIGHT CALCULATION ---
      if (printMode === 'IMAGE' && uploadedImage) {
        const img = new Image(); img.src = uploadedImage;
        await new Promise((r) => { img.onload = r; });
        canvas.height = Math.ceil((img.height * width) / img.width);
        ctx.fillStyle = 'white'; ctx.fillRect(0,0,width,canvas.height);
        ctx.drawImage(img, 0, 0, width, canvas.height);
        thermalData = processToThermal(canvas, width);
      } else if (printMode === 'PDF' && pdfCanvas) {
        canvas.height = Math.ceil((pdfCanvas.height * width) / pdfCanvas.width);
        ctx.fillStyle = 'white'; ctx.fillRect(0,0,width,canvas.height);
        ctx.drawImage(pdfCanvas, 0, 0, width, canvas.height);
        thermalData = processToThermal(canvas, width);
      } else if ((printMode === 'QR' || printMode === 'BARCODE') && generatedCodeUrl) {
        const img = new Image(); img.src = generatedCodeUrl;
        await new Promise((r) => { img.onload = r; });
        canvas.height = width + 100;
        ctx.fillStyle = 'white'; ctx.fillRect(0,0,width,canvas.height);
        ctx.drawImage(img, 20, 20, width-40, width-40);
        ctx.fillStyle = 'black'; ctx.textAlign = 'center'; ctx.font = '20px monospace';
        ctx.fillText(codeValue, width/2, width + 50);
        thermalData = processToThermal(canvas, width);
      } else {
        // Mode Text (Kasir / Resi) - Hitung Tinggi Berdasarkan Isi
        let y = 0;
        const lineH = 35;
        
        // Estimasi tinggi awal
        let estimatedH = 200; // Header & Footer
        if (printMode === 'RECEIPT') {
          estimatedH += items.length * lineH + 100;
        } else if (printMode === 'SHIPPING') {
          ctx.font = '18px monospace';
          const addrLines = wrapText(ctx, shippingData.toAddress || "Alamat Lengkap", width - 40);
          estimatedH += addrLines.length * lineH + 600;
        }

        canvas.height = estimatedH;
        ctx.fillStyle = 'white'; ctx.fillRect(0, 0, width, estimatedH);
        ctx.fillStyle = 'black'; ctx.textAlign = 'center';
        
        y = 50;
        ctx.font = 'bold 30px monospace'; ctx.fillText("HERNIPRINT PRO", width/2, y); y += 40;
        ctx.font = '16px monospace'; ctx.fillText(new Date().toLocaleString(), width/2, y); y += 45;
        ctx.fillText("--------------------------------", width/2, y); y += 40;

        if (printMode === 'RECEIPT') {
          items.forEach(i => {
            ctx.textAlign = 'left'; ctx.font = 'bold 20px monospace';
            ctx.fillText(`${i.name.toUpperCase()} x${i.qty}`, 20, y);
            ctx.textAlign = 'right'; ctx.fillText((i.price * i.qty).toLocaleString(), width-20, y);
            y += lineH;
          });
          y += 30; ctx.textAlign = 'center'; ctx.font = 'bold 26px monospace';
          ctx.fillText("TOTAL: Rp " + items.reduce((a,b)=>a+(b.price*b.qty),0).toLocaleString(), width/2, y); y += 60;
        } else if (printMode === 'SHIPPING') {
          ctx.textAlign = 'center'; ctx.font = 'bold 22px monospace';
          ctx.fillRect(0, y-25, width, 45); ctx.fillStyle = 'white';
          ctx.fillText("SHIPPING LABEL", width/2, y+5); ctx.fillStyle = 'black'; y += 70;

          ctx.textAlign = 'left'; ctx.font = 'bold 20px monospace';
          ctx.fillText("PENERIMA:", 20, y); y += 35;
          ctx.font = 'bold 28px monospace'; ctx.fillText((shippingData.toName || "Nama Penerima").toUpperCase(), 20, y); y += 40;
          ctx.font = '22px monospace'; ctx.fillText(shippingData.toPhone || "08xxxxxx", 20, y); y += 45;
          
          ctx.font = '18px monospace';
          const lines = wrapText(ctx, shippingData.toAddress || "Alamat Lengkap", width - 40);
          lines.forEach(line => { ctx.fillText(line, 20, y); y += lineH; });

          y += 30; ctx.fillText("--------------------------------", width/2, y); y += 40;
          ctx.font = 'bold 20px monospace';
          ctx.fillText("KURIR: " + (shippingData.courier || "-").toUpperCase(), 20, y); y += 35;
          ctx.fillText("RESI : " + (shippingData.trackingNumber || "-").toUpperCase(), 20, y); y += 60;

          if (shippingData.fromName) {
            ctx.fillText("PENGIRIM:", 20, y); y += 35;
            ctx.font = '18px monospace'; 
            ctx.fillText(shippingData.fromName.toUpperCase() + " (" + shippingData.fromPhone + ")", 20, y); y += 35;
          }
        }
        
        ctx.textAlign = 'center'; ctx.font = '14px monospace'; ctx.fillText("Terima Kasih - HerniPrint Pro", width/2, y + 40);
        
        // Final Crop Canvas: Sesuaikan tinggi canvas dengan posisi 'y' terakhir jika estimasi meleset
        const finalH = y + 100;
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = width; finalCanvas.height = finalH;
        const finalCtx = finalCanvas.getContext('2d')!;
        finalCtx.drawImage(canvas, 0, 0);
        thermalData = processToThermal(finalCanvas, width);
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
               <p className="text-[8px] font-bold text-slate-400 uppercase leading-none">Official Printing Suite</p>
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
        {/* Status Perangkat */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border dark:border-slate-800 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-3.5 h-3.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Status Printer</p>
                <p className="text-sm font-black dark:text-white">{isConnected ? deviceName : 'Belum Terhubung'}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => {setPendingConn('BT'); setActiveModal(ModalType.CONNECT_GUIDE)}} className={`p-3 rounded-xl border ${connType === 'BT' ? 'bg-blue-600 text-white' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'}`}><Bluetooth className="w-5 h-5"/></button>
              <button onClick={() => {setPendingConn('USB'); setActiveModal(ModalType.CONNECT_GUIDE)}} className={`p-3 rounded-xl border ${connType === 'USB' ? 'bg-slate-900 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-600'}`}><Usb className="w-5 h-5"/></button>
            </div>
          </div>
        </div>

        {/* Fitur Utama */}
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {[
            { id: 'RECEIPT', icon: ShoppingBag, label: 'Kasir', color: 'emerald', action: () => {setPrintMode('RECEIPT'); setActiveModal(ModalType.RECEIPT)} },
            { id: 'SHIPPING', icon: Truck, label: 'Resi', color: 'orange', action: () => {setPrintMode('SHIPPING'); setActiveModal(ModalType.SHIPPING)} },
            { id: 'IMAGE', icon: ImageIcon, label: 'Foto', color: 'rose', action: () => imageInputRef.current?.click() },
            { id: 'PDF', icon: FileText, label: 'PDF', color: 'indigo', action: () => pdfInputRef.current?.click() },
            { id: 'QR', icon: QrCode, label: 'QR', color: 'blue', action: () => {setCodeType('QR'); setActiveModal(ModalType.CODE_GEN)} },
            { id: 'BARCODE', icon: BarcodeIcon, label: 'Barcode', color: 'purple', action: () => {setCodeType('BARCODE'); setActiveModal(ModalType.CODE_GEN)} },
            { id: 'SCAN', icon: Scan, label: 'Scan', color: 'amber', action: startScanner },
            { id: 'INFO', icon: InfoIcon, label: 'About', color: 'slate', action: () => setActiveModal(ModalType.ABOUT) },
          ].map((m) => (
            <button key={m.id} onClick={m.action} className={`flex flex-col items-center gap-2 p-3 rounded-xl border bg-white dark:bg-slate-900 transition-all hover:scale-105 active:scale-95 ${printMode === m.id ? 'border-blue-500 ring-2 ring-blue-500/10' : 'border-slate-100 dark:border-slate-800'}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-${m.color}-500/10 text-${m.color}-600`}><m.icon className="w-4 h-4" /></div>
              <span className="text-[7px] font-black uppercase dark:text-slate-400 text-center leading-tight">{m.label}</span>
            </button>
          ))}
        </div>

        {/* Preview Area */}
        <div className="bg-slate-200 dark:bg-slate-800 rounded-[2.5rem] p-6 flex justify-center shadow-inner min-h-[450px]">
          <div ref={previewRef} className={`bg-white text-black font-mono text-[9px] p-6 shadow-2xl transition-all ${paperSize === '58' ? 'w-[260px]' : 'w-[340px]'} h-fit`}>
            <div className="text-center border-b border-dashed border-black pb-4 mb-4 flex flex-col items-center">
              <img src={APP_LOGO_URL} className="w-8 h-8 grayscale mb-1" />
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
                <div className="bg-black text-white text-center py-1 font-black text-[8px] uppercase tracking-widest">Shipping Label</div>
                <div>
                   <p className="text-[7px] opacity-40 uppercase font-black">Penerima:</p>
                   <p className="font-black text-xs uppercase">{shippingData.toName || "Nama Penerima"}</p>
                   <p className="font-bold text-[10px]">{shippingData.toPhone || "08xxxxxx"}</p>
                   <p className="leading-tight mt-1">{shippingData.toAddress || "Alamat Lengkap"}</p>
                </div>
                <div className="border-t border-dashed border-black pt-2 text-[8px] font-bold">
                   <p>KURIR: {(shippingData.courier || "-").toUpperCase()}</p>
                   <p>RESI : {(shippingData.trackingNumber || "-").toUpperCase()}</p>
                </div>
              </div>
            )}

            {printMode === 'IMAGE' && uploadedImage && <img src={uploadedImage} className="w-full grayscale contrast-125" />}
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
          </div>
        </div>
      </main>

      {/* FAB Print */}
      <div className="fixed bottom-0 left-0 right-0 p-8 flex justify-center items-center pointer-events-none">
        <button onClick={handlePrint} disabled={isPrinting} className="w-20 h-20 bg-blue-600 text-white rounded-full shadow-2xl border-8 border-white dark:border-slate-950 flex items-center justify-center active:scale-90 transition-all pointer-events-auto disabled:opacity-50">
          {isPrinting ? <Loader2 className="animate-spin w-8 h-8" /> : <Printer className="w-9 h-9" />}
        </button>
      </div>

      {/* --- MODALS --- */}
      {/* Resi Modal */}
      {activeModal === ModalType.SHIPPING && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
             <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-[10px] uppercase tracking-widest dark:text-white flex items-center gap-2"><Truck className="w-4 h-4 text-orange-500" /> Data Resi</h3>
                <button onClick={() => setActiveModal(ModalType.NONE)} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl dark:text-white"><X className="w-4 h-4"/></button>
             </div>
             <div className="space-y-4">
                <input className="w-full p-4 bg-slate-50 dark:bg-slate-800 dark:text-white rounded-xl border-none ring-1 ring-slate-200 dark:ring-slate-700 text-xs" value={shippingData.toName} onChange={e => setShippingData({...shippingData, toName: e.target.value})} placeholder="Nama Penerima" />
                <input className="w-full p-4 bg-slate-50 dark:bg-slate-800 dark:text-white rounded-xl border-none ring-1 ring-slate-200 dark:ring-slate-700 text-xs" value={shippingData.toPhone} onChange={e => setShippingData({...shippingData, toPhone: e.target.value})} placeholder="No HP" />
                <textarea rows={3} className="w-full p-4 bg-slate-50 dark:bg-slate-800 dark:text-white rounded-xl border-none ring-1 ring-slate-200 dark:ring-slate-700 text-xs" value={shippingData.toAddress} onChange={e => setShippingData({...shippingData, toAddress: e.target.value})} placeholder="Alamat Lengkap (Otomatis menyesuaikan panjang)" />
                <div className="grid grid-cols-2 gap-3">
                  <input className="w-full p-4 bg-slate-50 dark:bg-slate-800 dark:text-white rounded-xl border-none ring-1 ring-slate-200 dark:ring-slate-700 text-xs" value={shippingData.courier} onChange={e => setShippingData({...shippingData, courier: e.target.value})} placeholder="Kurir" />
                  <input className="w-full p-4 bg-slate-50 dark:bg-slate-800 dark:text-white rounded-xl border-none ring-1 ring-slate-200 dark:ring-slate-700 text-xs" value={shippingData.trackingNumber} onChange={e => setShippingData({...shippingData, trackingNumber: e.target.value})} placeholder="No Resi" />
                </div>
                <button onClick={() => { setPrintMode('SHIPPING'); setActiveModal(ModalType.NONE); }} className="w-full py-5 bg-orange-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg">Gunakan</button>
             </div>
          </div>
        </div>
      )}

      {/* Kasir Modal */}
      {activeModal === ModalType.RECEIPT && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-[10px] uppercase tracking-widest dark:text-white">Kasir</h3>
              <button onClick={() => setActiveModal(ModalType.NONE)} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl dark:text-white"><X className="w-4 h-4"/></button>
            </div>
            <div className="space-y-3 mb-6 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl">
              <input placeholder="Produk" className="w-full p-4 rounded-xl dark:bg-slate-900 dark:text-white text-xs border-none ring-1 ring-slate-200 dark:ring-slate-700" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Harga" type="number" className="p-4 rounded-xl dark:bg-slate-900 dark:text-white text-xs border-none ring-1 ring-slate-200 dark:ring-slate-700" value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} />
                <input placeholder="Qty" type="number" className="p-4 rounded-xl dark:bg-slate-900 dark:text-white text-xs border-none ring-1 ring-slate-200 dark:ring-slate-700" value={newItem.qty} onChange={e => setNewItem({...newItem, qty: e.target.value})} />
              </div>
              <button onClick={() => {
                if(!newItem.name || !newItem.price) return;
                setItems([...items, { id: crypto.randomUUID(), name: newItem.name, price: Number(newItem.price), qty: Number(newItem.qty) }]);
                setNewItem({ name: '', price: '', qty: '1' });
              }} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase">+ Tambah</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 mb-4">
              {items.map(i => (
                <div key={i.id} className="p-4 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl flex justify-between items-center">
                  <div className="flex-1 pr-3 truncate">
                    <p className="text-xs font-bold dark:text-white uppercase truncate">{i.name}</p>
                    <p className="text-[10px] text-slate-400">Rp {i.price.toLocaleString()} x {i.qty}</p>
                  </div>
                  <button onClick={() => setItems(items.filter(x => x.id !== i.id))} className="p-2 text-rose-500"><Trash2 className="w-4 h-4"/></button>
                </div>
              ))}
            </div>
            <div className="pt-5 border-t dark:border-slate-800 flex justify-between items-center">
               <p className="text-xl font-black text-emerald-600">Rp {totalBelanja.toLocaleString()}</p>
               <button onClick={() => {setPrintMode('RECEIPT'); setActiveModal(ModalType.NONE)}} className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase">Selesai</button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {activeModal === ModalType.SETTINGS && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-[10px] uppercase tracking-widest dark:text-white">Pengaturan</h3>
              <button onClick={() => setActiveModal(ModalType.NONE)} className="p-3 bg-slate-100 dark:bg-slate-800 dark:text-white rounded-xl"><X className="w-4 h-4"/></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                 <button onClick={() => setPaperSize('58')} className={`p-4 rounded-xl border-2 font-black text-xs ${paperSize === '58' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'border-slate-100 dark:border-slate-800 dark:text-white'}`}>58mm</button>
                 <button onClick={() => setPaperSize('80')} className={`p-4 rounded-xl border-2 font-black text-xs ${paperSize === '80' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'border-slate-100 dark:border-slate-800 dark:text-white'}`}>80mm</button>
              </div>
              <div className="pt-2 space-y-2">
                 <button onClick={() => window.open(TELEGRAM_LINK, '_blank')} className="w-full p-4 rounded-xl flex items-center justify-between border bg-blue-50 dark:bg-blue-900/20 text-blue-600 border-blue-100 dark:border-blue-800">
                    <div className="flex items-center gap-3"><Send className="w-4 h-4"/><span className="text-[10px] font-black uppercase">Grup Telegram</span></div>
                    <ExternalLink className="w-4 h-4"/>
                 </button>
                 <button onClick={() => setActiveModal(ModalType.PRIVACY)} className="w-full p-4 rounded-xl flex items-center justify-between border dark:border-slate-800 dark:text-white">
                    <div className="flex items-center gap-3"><Shield className="w-4 h-4"/><span className="text-[10px] font-black uppercase">Privasi</span></div>
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

      {/* Extra Modals Content (Privacy, Disclaimer, About) - Sama seperti sebelumnya */}
      {activeModal === ModalType.PRIVACY && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] p-8 shadow-2xl relative">
             <h3 className="font-black text-xs uppercase tracking-widest mb-6 dark:text-white flex items-center gap-2"><Shield className="w-5 h-5 text-blue-600"/> Privasi</h3>
             <p className="text-[10px] text-slate-500 dark:text-slate-400">Data diproses lokal 100% di browser tanpa pengiriman data eksternal.</p>
             <button onClick={() => setActiveModal(ModalType.SETTINGS)} className="w-full py-4 mt-8 bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white rounded-2xl font-black text-[10px] uppercase">Mengerti</button>
          </div>
        </div>
      )}

      {activeModal === ModalType.DISCLAIMER && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] p-8 shadow-2xl relative">
             <h3 className="font-black text-xs uppercase tracking-widest mb-6 dark:text-white flex items-center gap-2"><FileWarning className="w-5 h-5 text-amber-500"/> Disclaimer</h3>
             <p className="text-[10px] text-slate-500 dark:text-slate-400">Kami tidak bertanggung jawab atas kesalahan cetak atau kerusakan hardware.</p>
             <button onClick={() => setActiveModal(ModalType.SETTINGS)} className="w-full py-4 mt-8 bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white rounded-2xl font-black text-[10px] uppercase">Setuju</button>
          </div>
        </div>
      )}

      {activeModal === ModalType.ABOUT && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl text-center">
             <img src={APP_LOGO_URL} className="w-20 h-20 mx-auto mb-4" />
             <h2 className="font-black text-xs dark:text-white uppercase tracking-widest">HERNIPRINT PRO</h2>
             <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Build 1.2.8 - Dynamic Length Engine</p>
             <button onClick={() => setActiveModal(ModalType.NONE)} className="w-full py-4 mt-6 bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white rounded-2xl font-black text-[10px] uppercase">Tutup</button>
          </div>
        </div>
      )}

      {/* Inputs */}
      <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'IMAGE')} />
      <input type="file" ref={pdfInputRef} className="hidden" accept="application/pdf" onChange={(e) => handleFileUpload(e, 'PDF')} />
      
      {/* Connector Guide */}
      {activeModal === ModalType.CONNECT_GUIDE && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl text-center">
            <h3 className="font-black text-xs uppercase dark:text-white mb-2 tracking-widest">Hardware Connection</h3>
            <button onClick={pendingConn === 'BT' ? execConnectBT : execConnectUSB} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg mb-3">Hubungkan Sekarang</button>
            <button onClick={() => setActiveModal(ModalType.NONE)} className="w-full py-2 text-slate-400 font-black text-[10px] uppercase">Batal</button>
          </div>
        </div>
      )}

      {/* Code Generator Modal */}
      {activeModal === ModalType.CODE_GEN && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
           <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <button onClick={() => setCodeType('QR')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase ${codeType === 'QR' ? 'bg-white dark:bg-slate-700 text-blue-600' : 'text-slate-400'}`}>QR Code</button>
                  <button onClick={() => setCodeType('BARCODE')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase ${codeType === 'BARCODE' ? 'bg-white dark:bg-slate-700 text-blue-600' : 'text-slate-400'}`}>Barcode</button>
                </div>
                <button onClick={() => setActiveModal(ModalType.NONE)} className="p-2 dark:text-white"><X/></button>
              </div>
              <textarea className="w-full p-4 rounded-2xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white text-xs mb-4" rows={4} value={codeValue} onChange={(e) => setCodeValue(e.target.value)} placeholder="Tulis teks..." />
              <button onClick={() => { setPrintMode(codeType); setActiveModal(ModalType.NONE); }} className="w-full py-4 bg-blue-600 text-white rounded-xl font-black text-[9px] uppercase shadow-lg">Tampilkan</button>
           </div>
        </div>
      )}

      {/* Scanner */}
      {activeModal === ModalType.SCANNER && (
        <div className="fixed inset-0 z-[110] bg-black flex flex-col p-6">
           <div className="flex justify-between items-center mb-10">
              <h3 className="text-white font-black uppercase text-[10px]">Scanner</h3>
              <button onClick={() => setActiveModal(ModalType.NONE)} className="p-4 text-white"><X/></button>
           </div>
           <div id="reader" className="w-full aspect-square overflow-hidden rounded-3xl border-4 border-blue-600 bg-white"></div>
        </div>
      )}

      {/* Alert */}
      {alert && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[200]">
          <div className={`px-8 py-4 rounded-full shadow-2xl flex items-center gap-4 border backdrop-blur-xl ${
            alert.type === 'success' ? 'bg-emerald-600/90 border-emerald-500' : 
            alert.type === 'error' ? 'bg-rose-600/90 border-rose-500' : 'bg-slate-900/90 border-slate-700'
          } text-white`}>
            <span className="text-[10px] font-black uppercase tracking-widest">{alert.msg}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
