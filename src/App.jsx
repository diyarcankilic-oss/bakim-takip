import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { db, ref, set, get, onValue, auth, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "./firebase.js";

// Mail → kullanıcı adı + ad eşleştirmesi
const KULLANICI_MAP = {
  "bkahraman@nukleus.com.tr": { kullanici: "kahraman", ad: "Burhan Kahraman" },
  "ysahan@nukleus.com.tr":    { kullanici: "sahan",    ad: "Yunus Şahan" },
  "aturhan@nukleus.com.tr":   { kullanici: "turhan",   ad: "Arif Turhan" },
  "dkilic@nukleus.com.tr":    { kullanici: "kilic",    ad: "Diyarcan Kılıç" },
};

const CIHAZ_TURLERI = ["Biyokimya", "Hormon", "ISE"];
const INITIAL_KURUMLAR = Array.from({ length: 15 }, (_, i) => ({ id: i + 1, ad: `Kurum ${i + 1}` }));
const STORAGE_KEY  = "bakim_app_data_v3";
const SIFRE_KEY    = "bakim_sifre_v1";

function gunFarki(t) {
  if (!t) return null;
  return Math.floor((new Date() - new Date(t)) / 86400000);
}
function fmt(t) {
  if (!t) return "—";
  return new Date(t).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function Durum({ tarih, sm }) {
  const g = gunFarki(tarih);
  const b = sm ? "bsm" : "b";
  if (g === null) return <span className={`${b} bu`}>Bakım Yok</span>;
  if (g <= 30)    return <span className={`${b} bok`}>✓ {g}g</span>;
  if (g <= 90)    return <span className={`${b} bwarn`}>⚠ {g}g</span>;
  return              <span className={`${b} bdanger`}>✗ {g}g</span>;
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=Bebas+Neue&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
html,body{height:100%;background:#f0ede6;}
.app{min-height:100vh;background:#f0ede6;font-family:'IBM Plex Mono',monospace;color:#1a1a1a;}

/* LOGIN */
.login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f0ede6;position:relative;overflow:hidden;}
.login-bg{position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 39px,#d8d4cc 39px,#d8d4cc 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,#d8d4cc 39px,#d8d4cc 40px);opacity:.4;}
.login-card{position:relative;background:#1a1a1a;color:#f0ede6;padding:48px 40px;width:100%;max-width:380px;border-radius:2px;}
.login-logo{font-family:'Bebas Neue',sans-serif;font-size:42px;letter-spacing:3px;margin-bottom:4px;color:#f0ede6;}
.login-logo span{color:#e85d26;}
.login-sub{font-size:11px;color:#666;letter-spacing:2px;text-transform:uppercase;margin-bottom:36px;}
.login-label{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#666;margin-bottom:6px;display:block;}
.login-input{width:100%;background:#2a2a2a;border:1px solid #333;color:#f0ede6;padding:12px 14px;font-family:inherit;font-size:13px;outline:none;border-radius:1px;margin-bottom:16px;transition:border-color .2s;}
.login-input:focus{border-color:#e85d26;}
.login-btn{width:100%;background:#e85d26;color:#fff;border:none;padding:14px;font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:3px;cursor:pointer;border-radius:1px;margin-top:8px;transition:background .2s;}
.login-btn:hover{background:#ff7040;}
.login-err{color:#ff6b6b;font-size:11px;margin-top:10px;text-align:center;letter-spacing:1px;}
.login-ok{color:#4ade80;font-size:11px;margin-top:10px;text-align:center;letter-spacing:1px;}
.login-link{background:none;border:none;color:#e85d26;cursor:pointer;font-size:11px;text-decoration:underline;margin-top:8px;padding:0;letter-spacing:0.5px;font-family:inherit;}
.login-link:hover{color:#ff7a47;}
.b-del{background:none;border:none;cursor:pointer;font-size:14px;padding:4px;opacity:0.6;transition:opacity .2s;}
.b-del:hover{opacity:1;}
.cc-del{background:none;border:none;cursor:pointer;font-size:16px;padding:2px 4px;opacity:0.5;transition:opacity .2s;}
.cc-del:hover{opacity:1;}

/* HEADER */
.hdr{background:#1a1a1a;padding:0 24px;display:flex;align-items:center;justify-content:space-between;height:52px;position:sticky;top:0;z-index:100;}
.logo{font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:3px;color:#f0ede6;cursor:pointer;transition:color .2s;}
.logo:hover{color:#e85d26;}
.logo span{color:#e85d26;}
.kurum-select-main{width:100%;background:#1a1a1a;border:1px solid #333;color:#f0ede6;padding:14px 16px;font-family:'IBM Plex Mono',monospace;font-size:13px;outline:none;border-radius:1px;cursor:pointer;transition:border-color .2s;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23e85d26' stroke-width='2' fill='none'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 16px center;}
.kurum-select-main:focus{border-color:#e85d26;}
.kurum-select-main option{background:#1a1a1a;color:#f0ede6;}
.hdr-right{display:flex;align-items:center;gap:10px;}
.hdr-user{font-size:11px;color:#666;letter-spacing:1px;white-space:nowrap;}
.hdr-user span{color:#e85d26;}
.hdr-btn{background:none;border:1px solid #333;color:#666;padding:5px 10px;font-family:inherit;font-size:10px;letter-spacing:1px;cursor:pointer;border-radius:1px;transition:all .2s;white-space:nowrap;}
.hdr-btn:hover{border-color:#e85d26;color:#e85d26;}
.sync-dot{width:7px;height:7px;border-radius:50%;background:#4ade80;display:inline-block;margin-right:4px;}
.sync-dot.syncing{background:#fbbf24;animation:pulse 1s infinite;}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}

/* LAYOUT */
.layout{display:grid;grid-template-columns:220px 1fr;min-height:calc(100vh - 52px);}
.sidebar{background:#1a1a1a;padding:20px 0;overflow-y:auto;}
.sb-title{font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#444;padding:0 16px 12px;}
.ki{display:flex;align-items:center;justify-content:space-between;padding:8px 16px;cursor:pointer;border-left:3px solid transparent;transition:all .15s;}
.ki:hover{background:#252525;}
.ki.active{background:#252525;border-left-color:#e85d26;}
.ki-name{font-size:11px;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ki.active .ki-name{color:#e85d26;}
.ki-meta{font-size:9px;color:#444;margin-top:2px;}
.ki-edit{background:none;border:none;color:#333;cursor:pointer;font-size:12px;padding:2px 5px;transition:color .2s;line-height:1;flex-shrink:0;}
.ki-edit:hover{color:#e85d26;}
.sb-home{display:flex;align-items:center;gap:8px;padding:10px 16px 18px;cursor:pointer;border-bottom:1px solid #222;margin-bottom:8px;}
.sb-home-txt{font-size:10px;letter-spacing:1px;color:#555;text-transform:uppercase;}
.sb-home:hover .sb-home-txt{color:#e85d26;}
.sb-add-btn{background:none;border:1px solid #333;color:#666;width:20px;height:20px;border-radius:2px;cursor:pointer;font-size:14px;line-height:1;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0;}
.sb-add-btn:hover{border-color:#e85d26;color:#e85d26;}

/* MAIN */
.main{padding:24px;overflow-y:auto;background:#f0ede6;}

/* PAGE HEADER */
.page-hdr{display:flex;align-items:center;gap:10px;margin-bottom:20px;}
.home-btn{background:#1a1a1a;border:none;color:#f0ede6;padding:7px 14px;font-family:'Bebas Neue',sans-serif;font-size:14px;letter-spacing:1px;cursor:pointer;border-radius:1px;display:flex;align-items:center;gap:6px;transition:background .2s;white-space:nowrap;}
.home-btn:hover{background:#e85d26;}
.bc{display:flex;align-items:center;gap:6px;font-size:11px;color:#bbb;}
.bcl{color:#e85d26;cursor:pointer;background:none;border:none;font-family:inherit;font-size:11px;padding:0;}
.bcl:hover{text-decoration:underline;}

/* STATS */
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:22px;}
.sc{background:#1a1a1a;padding:16px;border-radius:1px;}
.sc-l{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#555;margin-bottom:6px;}
.sc-v{font-family:'Bebas Neue',sans-serif;font-size:34px;line-height:1;}
.sc.t .sc-v{color:#f0ede6;}.sc.ok .sc-v{color:#4ade80;}.sc.wn .sc-v{color:#fbbf24;}.sc.cr .sc-v{color:#f87171;}

/* TOOLBAR */
.tb{display:flex;gap:10px;margin-bottom:16px;align-items:center;flex-wrap:wrap;}
.inp{background:#fff;border:1px solid #d0ccc4;color:#1a1a1a;padding:9px 14px;font-family:inherit;font-size:12px;outline:none;border-radius:1px;transition:border-color .2s;}
.inp:focus{border-color:#e85d26;}
.inp::placeholder{color:#aaa;}
.inp-g{flex:1;min-width:160px;}

/* BUTTONS */
.btn{background:#e85d26;color:#fff;border:none;padding:9px 20px;font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:1px;cursor:pointer;border-radius:1px;transition:all .2s;white-space:nowrap;}
.btn:hover{background:#ff7040;transform:translateY(-1px);}
.btn-s{background:#fff;border:1px solid #d0ccc4;color:#1a1a1a;font-family:'IBM Plex Mono',monospace;font-size:11px;padding:8px 14px;cursor:pointer;border-radius:1px;transition:all .2s;}
.btn-s:hover{border-color:#e85d26;color:#e85d26;}
.btn-sm{padding:5px 14px;font-size:13px;}
.btn-s-sm{padding:4px 10px;font-size:10px;}

/* TABLE */
.tw{background:#fff;border:1px solid #d0ccc4;border-radius:1px;overflow:hidden;}
table{width:100%;border-collapse:collapse;}
th{background:#f8f5ef;border-bottom:1px solid #d0ccc4;padding:10px 14px;text-align:left;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#888;font-weight:500;}
td{padding:12px 14px;font-size:12px;border-bottom:1px solid #eee;vertical-align:middle;}
tr:last-child td{border-bottom:none;}
tr:hover td{background:#faf8f4;}

/* BADGES */
.b,.bsm{display:inline-block;padding:3px 9px;border-radius:0;font-size:11px;font-weight:500;letter-spacing:.5px;}
.bsm{padding:2px 7px;font-size:10px;}
.bok{background:#dcfce7;color:#16a34a;border:1px solid #bbf7d0;}
.bwarn{background:#fef9c3;color:#a16207;border:1px solid #fef08a;}
.bdanger{background:#fee2e2;color:#dc2626;border:1px solid #fecaca;}
.bu{background:#f3f4f6;color:#6b7280;border:1px solid #e5e7eb;}
.ktag{font-size:10px;color:#888;background:#f3f0ea;padding:2px 7px;border-radius:1px;}

/* KURUM DETAY */
.kd-hdr{margin-bottom:20px;}
.kd-ust{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;}
.kd-title{font-family:'Bebas Neue',sans-serif;font-size:30px;letter-spacing:2px;color:#1a1a1a;}
.kd-meta{font-size:11px;color:#999;margin-top:4px;}
.kd-acts{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-start;margin-top:6px;}

/* CİHAZ KARTLARI */
.cg{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;}
.cc{background:#fff;border:1px solid #d0ccc4;padding:14px;cursor:pointer;transition:all .2s;border-radius:1px;border-top:3px solid transparent;}
.cc:hover{border-top-color:#e85d26;transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.08);}
.cc-ad{font-size:13px;font-weight:600;margin-bottom:6px;}
.cc-sb{font-size:10px;color:#aaa;margin-top:10px;}
.cc-alt{display:flex;align-items:center;justify-content:space-between;margin-top:4px;}

/* CİHAZ DETAY */
.dh{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;gap:12px;flex-wrap:wrap;}
.d-title{font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:2px;}
.d-meta{font-size:11px;color:#999;margin-top:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;}

/* BAKIM */
.bl{display:flex;flex-direction:column;gap:10px;}
.bi{background:#fff;border:1px solid #d0ccc4;padding:14px 18px;display:flex;align-items:flex-start;gap:14px;border-radius:1px;border-left:3px solid #e85d26;}
.b-box{text-align:center;min-width:46px;}
.b-gun{font-family:'Bebas Neue',sans-serif;font-size:28px;color:#e85d26;line-height:1;}
.b-ay{font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:1px;}
.b-det{flex:1;}
.b-who{font-size:12px;font-weight:500;margin-bottom:3px;}
.b-note{font-size:11px;color:#888;}
.b-editor{font-size:10px;color:#bbb;margin-top:4px;}

/* MODAL */
.ov{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:200;padding:20px;}
.modal{background:#fff;padding:28px;width:100%;max-width:460px;animation:su .2s ease;border-radius:1px;border-top:3px solid #e85d26;}
@keyframes su{from{transform:translateY(14px);opacity:0}to{transform:translateY(0);opacity:1}}
.m-title{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:2px;margin-bottom:20px;color:#1a1a1a;}
.fg{margin-bottom:14px;}
label{display:block;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#999;margin-bottom:5px;}
.fi{width:100%;background:#faf8f4;border:1px solid #d0ccc4;color:#1a1a1a;padding:10px 12px;font-family:inherit;font-size:12px;outline:none;border-radius:1px;transition:border-color .2s;}
.fi:focus{border-color:#e85d26;}
.fi:disabled{opacity:.5;cursor:not-allowed;background:#f0ede6;}
textarea.fi{min-height:70px;resize:vertical;}
.m-acts{display:flex;gap:8px;margin-top:20px;justify-content:flex-end;}
.m-err{color:#dc2626;font-size:11px;margin-top:8px;letter-spacing:.5px;}
.m-ok{color:#16a34a;font-size:11px;margin-top:8px;letter-spacing:.5px;}

/* TEKNİK BİLGİ TAM EKRAN */
.tb-overlay{position:fixed;inset:0;background:#f0ede6;z-index:150;overflow-y:auto;}
.tb-page{max-width:1100px;margin:0 auto;padding:28px;}
.tb-hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:8px;flex-wrap:wrap;}
.tb-hdr-left{display:flex;align-items:center;gap:0;}
.tb-isim{font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:2px;color:#1a1a1a;}
.tb-isim-input{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:2px;background:#fff;border:1px solid #e85d26;color:#1a1a1a;padding:4px 10px;outline:none;border-radius:1px;width:220px;}
.tb-edit-btn{background:#1a1a1a;border:none;color:#aaa;font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:1px;padding:5px 10px;cursor:pointer;border-radius:1px;transition:all .2s;}
.tb-edit-btn:hover{background:#e85d26;color:#fff;}
.tb-not-sec{background:#1a1a1a;border:1px solid #333;color:#f0ede6;padding:8px 12px;font-family:'IBM Plex Mono',monospace;font-size:11px;outline:none;border-radius:1px;cursor:pointer;}
.tb-not-sec:focus{border-color:#e85d26;}

/* EXCEL TABLO */
.excel-wrap{overflow-x:auto;border:2px solid #1a1a1a;border-radius:1px;background:#fff;}
.excel-tbl{width:100%;border-collapse:collapse;min-width:400px;}
.excel-th{background:#1a1a1a;padding:0;border-right:1px solid #333;min-width:120px;}
.excel-th:last-of-type{border-right:none;}
.excel-th-inner{display:flex;align-items:center;gap:4px;padding:2px 4px;}
.excel-th-input{background:transparent;border:none;color:#f0ede6;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;padding:8px 6px;outline:none;width:100%;cursor:text;}
.excel-th-input:focus{background:rgba(232,93,38,.15);}
.excel-del-col{background:none;border:none;color:#555;cursor:pointer;font-size:14px;padding:2px 4px;line-height:1;transition:color .15s;flex-shrink:0;}
.excel-del-col:hover{color:#f87171;}
.excel-th-action{background:#1a1a1a;padding:4px;text-align:center;width:36px;border-left:1px solid #333;}
.excel-add-col{background:none;border:1px solid #444;color:#888;width:26px;height:26px;border-radius:1px;cursor:pointer;font-size:16px;line-height:1;display:flex;align-items:center;justify-content:center;margin:0 auto;transition:all .15s;}
.excel-add-col:hover{border-color:#e85d26;color:#e85d26;}
.excel-tr-even td{background:#fff;}
.excel-tr-odd td{background:#faf8f4;}
.excel-td{padding:0;border-right:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;}
.excel-cell{width:100%;background:transparent;border:none;color:#1a1a1a;font-family:'IBM Plex Mono',monospace;font-size:12px;padding:9px 10px;outline:none;transition:background .1s;}
.excel-cell:focus{background:rgba(232,93,38,.06);}
.excel-td-action{padding:4px;text-align:center;width:36px;border-bottom:1px solid #e5e7eb;background:#faf8f4;}
.excel-del-row{background:none;border:none;cursor:pointer;font-size:13px;padding:2px;opacity:.4;transition:opacity .15s;}
.excel-del-row:hover{opacity:1;}
.excel-add-row{display:flex;align-items:center;gap:6px;margin-top:8px;background:#1a1a1a;border:none;color:#f0ede6;font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:1px;padding:9px 16px;cursor:pointer;border-radius:1px;transition:background .2s;}
.excel-add-row:hover{background:#e85d26;}
.empty{text-align:center;padding:48px 20px;color:#ccc;}
.empty .ico{font-size:36px;margin-bottom:10px;}
.empty p{font-size:12px;}
.loading{display:flex;align-items:center;justify-content:center;height:200px;font-size:12px;color:#aaa;letter-spacing:2px;}

@media(max-width:900px){
  .layout{grid-template-columns:1fr;}
  .sidebar{display:none;}
  .stats{grid-template-columns:repeat(2,1fr);}
  .hdr-mid{display:flex;}
}
@media(max-width:600px){
  .main{padding:14px;}
  .hdr-user{display:none;}
  .kurum-select{min-width:120px;font-size:11px;padding:5px 8px;}
}
`;

export default function App() {
  const [aktifKullanici, setAktifKullanici] = useState(null);
  const [loginForm, setLoginForm]   = useState(() => {
    const kayitli = localStorage.getItem("bakim_mail");
    return { mail: kayitli || "", sifre: "" };
  });
  const [beniHatirla, setBeniHatirla] = useState(() => !!localStorage.getItem("bakim_mail"));
  const [loginErr, setLoginErr]     = useState("");
  const [sifreSifirlamaMsg, setSifreSifirlamaMsg] = useState("");
  const [sifreSifirlamaErr, setSifreSifirlamaErr] = useState("");

  const [kurumlar, setKurumlar]   = useState(INITIAL_KURUMLAR);
  const [cihazlar, setCihazlar]   = useState([]);
  const [bakimlar, setBakimlar]   = useState([]);
  const [yuklendi, setYuklendi]   = useState(false);
  const [syncing, setSyncing]     = useState(false);

  const [ekran, setEkran]               = useState("kurumlar");
  const [seciliKurumId, setSeciliKurumId] = useState(null);
  const [seciliCihazId, setSeciliCihazId] = useState(null);
  const [arama, setArama]               = useState("");

  const [modal, setModal]         = useState(null); // "cihazEkle"|"bakimEkle"|"isim"|"sifre"
  const [isimModal, setIsimModal] = useState(null);
  const [yeniIsim, setYeniIsim]   = useState("");
  const [yeniKurumAd, setYeniKurumAd] = useState("");
  const [cihazForm, setCihazForm] = useState({ ad: CIHAZ_TURLERI[0], seri: "" });
  const [bakimForm, setBakimForm] = useState({ tarih: new Date().toISOString().split("T")[0], notlar: "" });

  // Şifre state (kullanılmıyor - Firebase Auth kullanılıyor)
  const [sifreForm, setSifreForm] = useState({});
  const [sifreErr, setSifreErr]   = useState("");
  const [sifreOk, setSifreOk]     = useState("");

  // Yedek parça tabloları (5 adet, her biri satır listesi + sütun başlıkları)
  const DEFAULT_SUTUNLAR = ["Parça Adı", "Miktar", "Açıklama"];
  const [yedekTablolar, setYedekTablolar] = useState(
    Array.from({length:5}, (_,i) => ({
      id: i+1,
      isim: `Not ${i+1}`,
      sutunlar: [...DEFAULT_SUTUNLAR],
      satirlar: []
    }))
  );
  const [seciliYedekNo, setSeciliYedekNo] = useState("");
  const [teknikBilgiEkran, setTeknikBilgiEkran] = useState(false);
  const [notIsmiDuzenle, setNotIsmiDuzenle] = useState(null);
  const [seciliLine, setSeciliLine] = useState("");
  const [statFiltre, setStatFiltre] = useState("");
  const [bakimSilModal, setBakimSilModal] = useState(null);
  const [cihazSilModal, setCihazSilModal] = useState(null);
  const LINES = Array.from({length:8}, (_,i) => `${i+1} LINE`);

  // Veri yükleme - Firebase Realtime Database
  const yukleVeri = useCallback(async () => {
    try {
      const snap = await get(ref(db, "bakimApp"));
      if (snap.exists()) {
        const d = snap.val();
        const toArr = v => Array.isArray(v) ? v : Object.values(v || {});
        if (d.kurumlar) setKurumlar(toArr(d.kurumlar));
        if (d.cihazlar) setCihazlar(toArr(d.cihazlar));
        if (d.bakimlar) setBakimlar(toArr(d.bakimlar));
        if (d.yedekTablolar) {
          const arr = toArr(d.yedekTablolar);
          setYedekTablolar(arr.map((t,i) => normalizeTablo(t, i)));
        }
      }
    } catch(e) { console.error("Veri yükleme hatası:", e); }
    setYuklendi(true);
  }, []);

  const kaydetVeri = useCallback(async (k, c, b, yt) => {
    setSyncing(true);
    try {
      await set(ref(db, "bakimApp"), { kurumlar: k, cihazlar: c, bakimlar: b, yedekTablolar: yt });
    } catch(e) { console.error("Kayıt hatası:", e); }
    setTimeout(() => setSyncing(false), 600);
  }, []);

  // Firebase realtime listener
  useEffect(() => {
    const unsubscribe = onValue(ref(db, "bakimApp"), (snap) => {
      if (snap.exists() && yuklendi) {
        const d = snap.val();
        const toArr = v => Array.isArray(v) ? v : Object.values(v || {});
        if (d.kurumlar) setKurumlar(toArr(d.kurumlar));
        if (d.cihazlar) setCihazlar(toArr(d.cihazlar));
        if (d.bakimlar) setBakimlar(toArr(d.bakimlar));
        if (d.yedekTablolar) {
          const arr = toArr(d.yedekTablolar);
          setYedekTablolar(prev => arr.map((t,i) => ({ ...normalizeTablo(t,i), isim: prev[i]?.isim || `Not ${i+1}` })));
        }
      }
    });
    return () => unsubscribe();
  }, [yuklendi]);

  useEffect(() => { yukleVeri(); }, []);

  function normalizeTablo(t, i) {
    return {
      isim: `Not ${i+1}`,
      ...t,
      id: t.id ?? i+1,
      sutunlar: Array.isArray(t.sutunlar) ? t.sutunlar : Object.values(t.sutunlar || {}),
      satirlar: Array.isArray(t.satirlar)
        ? t.satirlar.map(s => ({ ...s, hücreler: Array.isArray(s.hücreler) ? s.hücreler : Object.values(s.hücreler || {}) }))
        : Object.values(t.satirlar || {}).map(s => ({ ...s, hücreler: Array.isArray(s.hücreler) ? s.hücreler : Object.values(s.hücreler || {}) }))
    };
  }

  async function login() {
    setLoginErr("");
    try {
      const uc = await signInWithEmailAndPassword(auth, loginForm.mail.trim(), loginForm.sifre);
      const mail = uc.user.email;
      const bilgi = KULLANICI_MAP[mail];
      if (bilgi) {
        if (beniHatirla) localStorage.setItem("bakim_mail", mail);
        else localStorage.removeItem("bakim_mail");
        setAktifKullanici({ ...bilgi, mail });
      } else setLoginErr("Bu hesap sisteme tanımlı değil.");
    } catch(e) {
      setLoginErr("Mail adresi veya şifre hatalı.");
    }
  }

  async function cikisYap() {
    await signOut(auth);
    setAktifKullanici(null);
  }

  async function sifreSifirla() {
    setSifreSifirlamaMsg(""); setSifreSifirlamaErr("");
    const mail = aktifKullanici?.mail;
    if (!mail) return;
    try {
      await sendPasswordResetEmail(auth, mail);
      setSifreSifirlamaMsg(`Şifre sıfırlama maili ${mail} adresine gönderildi!`);
      setTimeout(() => { setSifreSifirlamaMsg(""); setModal(null); }, 3000);
    } catch(e) {
      setSifreSifirlamaErr("Mail gönderilemedi, tekrar deneyin.");
    }
  }

  const seciliKurum = kurumlar.find(k => k.id === seciliKurumId);
  const seciliCihaz = cihazlar.find(c => c.id === seciliCihazId);

  const sonBakimlar = useMemo(() => {
    const m = {};
    bakimlar.forEach(b => {
      if (!m[b.cihazId] || new Date(b.tarih) > new Date(m[b.cihazId].tarih)) m[b.cihazId] = b;
    });
    return m;
  }, [bakimlar]);

  function ist(kurumId) {
    const l = cihazlar.filter(c => c.kurumId === kurumId);
    return {
      toplam: l.length,
      ok:     l.filter(c => { const g = gunFarki(sonBakimlar[c.id]?.tarih); return g !== null && g <= 30; }).length,
      warn:   l.filter(c => { const g = gunFarki(sonBakimlar[c.id]?.tarih); return g !== null && g > 30 && g <= 90; }).length,
      kritik: l.filter(c => { const g = gunFarki(sonBakimlar[c.id]?.tarih); return g === null || g > 90; }).length,
    };
  }

  const genelIst = useMemo(() => ({
    toplam: cihazlar.length,
    ok:     cihazlar.filter(c => { const g = gunFarki(sonBakimlar[c.id]?.tarih); return g !== null && g <= 60; }).length,
    warn:   cihazlar.filter(c => { const g = gunFarki(sonBakimlar[c.id]?.tarih); return g !== null && g > 60 && g <= 90; }).length,
    kritik: cihazlar.filter(c => { const g = gunFarki(sonBakimlar[c.id]?.tarih); return g === null || g > 90; }).length,
  }), [cihazlar, sonBakimlar]);

  function goGenel()   { setEkran("kurumlar"); setSeciliKurumId(null); setSeciliCihazId(null); }
  function goKurum(id) { setSeciliKurumId(id); setEkran("kurumDetay"); setArama(""); setSeciliCihazId(null); setSeciliLine(""); }
  function goCihaz(id) { setSeciliCihazId(id); setEkran("cihazDetay"); }

  async function kurumEkle(ad) {
    if (!ad.trim()) return;
    const yeniId = Date.now();
    const yeni = [...kurumlar, { id: yeniId, ad: ad.trim() }];
    setKurumlar(yeni);
    await kaydetVeri(yeni, cihazlar, bakimlar, yedekTablolar);
    setModal(null);
  }

  async function kurumSil(kurumId) {
    const yeniKurumlar = kurumlar.filter(k => k.id !== kurumId);
    const yeniCihazlar = cihazlar.filter(c => c.kurumId !== kurumId);
    const silCihazIds = cihazlar.filter(c => c.kurumId === kurumId).map(c => c.id);
    const yeniBakimlar = bakimlar.filter(b => !silCihazIds.includes(b.cihazId));
    setKurumlar(yeniKurumlar);
    setCihazlar(yeniCihazlar);
    setBakimlar(yeniBakimlar);
    if (seciliKurumId === kurumId) goGenel();
    await kaydetVeri(yeniKurumlar, yeniCihazlar, yeniBakimlar, yedekTablolar);
    setModal(null);
  }

  async function isimKaydet() {
    if (!yeniIsim.trim() || !isimModal) return;
    const yeni = kurumlar.map(k => k.id === isimModal.id ? { ...k, ad: yeniIsim.trim() } : k);
    setKurumlar(yeni);
    await kaydetVeri(yeni, cihazlar, bakimlar, yedekTablolar);
    setIsimModal(null); setModal(null);
  }

  async function cihazEkle() {
    if (!cihazForm.ad.trim() || !seciliKurumId) return;
    const yeniCihaz = {
      id: Date.now(), kurumId: seciliKurumId,
      ad: cihazForm.ad, seri: cihazForm.seri,
      ekleyen: aktifKullanici.ad,
      ...(seciliKurumId === 1 && seciliLine ? { line: seciliLine } : {})
    };
    const yeni = [...cihazlar, yeniCihaz];
    setCihazlar(yeni);
    await kaydetVeri(kurumlar, yeni, bakimlar, yedekTablolar);
    setCihazForm({ ad: CIHAZ_TURLERI[0], seri: "" });
    setModal(null);
  }

  async function bakimEkle() {
    if (!seciliCihazId || !bakimForm.tarih) return;
    const yeni = [...bakimlar, { id: Date.now(), cihazId: seciliCihazId, tarih: bakimForm.tarih, yapan: aktifKullanici.ad, notlar: bakimForm.notlar, ekleyen: aktifKullanici.ad }];
    setBakimlar(yeni);
    await kaydetVeri(kurumlar, cihazlar, yeni, yedekTablolar);
    setBakimForm({ tarih: new Date().toISOString().split("T")[0], notlar: "" });
    setModal(null);
  }

  async function cihazSilOnayla() {
    if (!cihazSilModal) return;
    const yeniCihazlar = cihazlar.filter(c => c.id !== cihazSilModal.id);
    const silBakimlar = bakimlar.filter(b => b.cihazId === cihazSilModal.id);
    const yeniBakimlar = bakimlar.filter(b => b.cihazId !== cihazSilModal.id);
    setCihazlar(yeniCihazlar);
    setBakimlar(yeniBakimlar);
    await kaydetVeri(kurumlar, yeniCihazlar, yeniBakimlar, yedekTablolar);
    if (seciliCihazId === cihazSilModal.id) goKurum(seciliCihazId);
    setBakimSilModal(null);
  }
  // Diğer fonksiyonlar ve render mantığı devam ediyor...
}
