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
  if (g <= 45)    return <span className={`${b} bwarn`}>⚠ {g}g</span>;
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
.b-note{font-size:11px;color:#888;font-weight:700;}
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
  const [bakimForm, setBakimForm] = useState({ tarih: new Date().toISOString().split("T")[0], notlar: "", checkboxlar: [] });

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

  function sonPinchHatTarih(cihazId) {
    // Bu cihaza ait bakımlardan Pinch Tube veya Hat Bakımı geçen en son tarihi bul
    const ilgiliBakimlar = bakimlar.filter(b => b.cihazId === cihazId && b.notlar && (
      b.notlar.includes("Pinch Tube Değişimi") || b.notlar.includes("Hat Bakımı")
    ));
    if (ilgiliBakimlar.length === 0) return null;
    return ilgiliBakimlar.reduce((en, b) => (!en || new Date(b.tarih) > new Date(en)) ? b.tarih : en, null);
  }

  function ist(kurumId) {
    const l = cihazlar.filter(c => c.kurumId === kurumId);
    return {
      toplam: l.length,
      ok:     l.filter(c => { const t = sonPinchHatTarih(c.id); const g = gunFarki(t); return g !== null && g <= 30; }).length,
      warn:   l.filter(c => { const t = sonPinchHatTarih(c.id); const g = gunFarki(t); return g !== null && g > 30 && g <= 45; }).length,
      kritik: l.filter(c => { const t = sonPinchHatTarih(c.id); const g = gunFarki(t); return g === null || g > 45; }).length,
    };
  }

  const genelIst = useMemo(() => {
    function _sonPinchHat(cihazId) {
      const ilgiliBakimlar = bakimlar.filter(b => b.cihazId === cihazId && b.notlar && (
        b.notlar.includes("Pinch Tube Değişimi") || b.notlar.includes("Hat Bakımı")
      ));
      if (ilgiliBakimlar.length === 0) return null;
      return ilgiliBakimlar.reduce((en, b) => (!en || new Date(b.tarih) > new Date(en)) ? b.tarih : en, null);
    }
    return {
      toplam: cihazlar.length,
      ok:     cihazlar.filter(c => { const t = _sonPinchHat(c.id); const g = gunFarki(t); return g !== null && g <= 30; }).length,
      warn:   cihazlar.filter(c => { const t = _sonPinchHat(c.id); const g = gunFarki(t); return g !== null && g > 30 && g <= 45; }).length,
      kritik: cihazlar.filter(c => { const t = _sonPinchHat(c.id); const g = gunFarki(t); return g === null || g > 45; }).length,
    };
  }, [cihazlar, bakimlar]);

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
    const checkNotlar = bakimForm.checkboxlar.length > 0 ? bakimForm.checkboxlar.join(", ") : "";
    const birlesikNot = [checkNotlar, bakimForm.notlar].filter(Boolean).join("\n");
    const yeni = [...bakimlar, {
      id: Date.now(), cihazId: seciliCihazId, tarih: bakimForm.tarih,
      yapan: aktifKullanici.ad, notlar: birlesikNot,
      ekleyen: aktifKullanici.ad
    }];
    setBakimlar(yeni);
    await kaydetVeri(kurumlar, cihazlar, yeni, yedekTablolar);
    setBakimForm({ tarih: new Date().toISOString().split("T")[0], notlar: "", checkboxlar: [] });
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
    setCihazSilModal(null);
  }

  async function bakimSilOnayla() {
    if (!bakimSilModal) return;
    const yeni = bakimlar.filter(b => b.id !== bakimSilModal.id);
    setBakimlar(yeni);
    await kaydetVeri(kurumlar, cihazlar, yeni, yedekTablolar);
    setBakimSilModal(null);
  }

  async function yedekTablo_satirEkle(tabloId) {
    const yeni = yedekTablolar.map(t => t.id === tabloId
      ? { ...t, satirlar: [...t.satirlar, { id: Date.now(), hücreler: Array(t.sutunlar.length).fill("") }] }
      : t
    );
    setYedekTablolar(yeni);
    await kaydetVeri(kurumlar, cihazlar, bakimlar, yeni);
  }

  async function yedekTablo_satirSil(tabloId, satirId) {
    const yeni = yedekTablolar.map(t => t.id === tabloId
      ? { ...t, satirlar: t.satirlar.filter(s => s.id !== satirId) }
      : t
    );
    setYedekTablolar(yeni);
    await kaydetVeri(kurumlar, cihazlar, bakimlar, yeni);
  }

  async function yedekTablo_hucreGuncelle(tabloId, satirId, kolIdx, deger) {
    const yeni = yedekTablolar.map(t => t.id === tabloId
      ? { ...t, satirlar: t.satirlar.map(s => s.id === satirId
          ? { ...s, hücreler: s.hücreler.map((c, i) => i === kolIdx ? deger : c) } : s) }
      : t
    );
    setYedekTablolar(yeni);
    await kaydetVeri(kurumlar, cihazlar, bakimlar, yeni);
  }

  async function yedekTablo_baslikGuncelle(tabloId, kolIdx, deger) {
    const yeni = yedekTablolar.map(t => t.id === tabloId
      ? { ...t, sutunlar: t.sutunlar.map((s, i) => i === kolIdx ? deger : s) }
      : t
    );
    setYedekTablolar(yeni);
    await kaydetVeri(kurumlar, cihazlar, bakimlar, yeni);
  }

  async function yedekTablo_sutunEkle(tabloId) {
    const yeni = yedekTablolar.map(t => t.id === tabloId
      ? {
          ...t,
          sutunlar: [...t.sutunlar, "YENİ SÜTUN"],
          satirlar: t.satirlar.map(s => ({ ...s, hücreler: [...s.hücreler, ""] }))
        }
      : t
    );
    setYedekTablolar(yeni);
    await kaydetVeri(kurumlar, cihazlar, bakimlar, yeni);
  }

  async function yedekTablo_sutunSil(tabloId, kolIdx) {
    const yeni = yedekTablolar.map(t => t.id === tabloId
      ? {
          ...t,
          sutunlar: t.sutunlar.filter((_, i) => i !== kolIdx),
          satirlar: t.satirlar.map(s => ({ ...s, hücreler: s.hücreler.filter((_, i) => i !== kolIdx) }))
        }
      : t
    );
    setYedekTablolar(yeni);
    await kaydetVeri(kurumlar, cihazlar, bakimlar, yeni);
  }

  async function yedekTablo_isimKaydet() {
    if (!notIsmiDuzenle) return;
    const yeni = yedekTablolar.map(t => t.id === notIsmiDuzenle.id ? { ...t, isim: yeniIsim.trim() || t.isim } : t);
    setYedekTablolar(yeni);
    await kaydetVeri(kurumlar, cihazlar, bakimlar, yeni);
    setNotIsmiDuzenle(null); setYeniIsim("");
  }

  if (!aktifKullanici) return (
    <div className="login-wrap">
      <style>{CSS}</style>
      <div className="login-bg" />
      <div className="login-card">
        <div className="login-logo">BAKIM<span>TAKİP</span></div>
        <div className="login-sub">Servis Yönetim Sistemi</div>
        <div className="fg">
          <label className="login-label">Mail Adresi</label>
          <input className="login-input" type="email" value={loginForm.mail} onChange={e => setLoginForm({ ...loginForm, mail: e.target.value })} onKeyDown={e => e.key === "Enter" && login()} />
        </div>
        <div className="fg">
          <label className="login-label">Şifre</label>
          <input className="login-input" type="password" value={loginForm.sifre} onChange={e => setLoginForm({ ...loginForm, sifre: e.target.value })} onKeyDown={e => e.key === "Enter" && login()} />
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:20}}>
          <input type="checkbox" id="bh" checked={beniHatirla} onChange={e => setBeniHatirla(e.target.checked)} />
          <label htmlFor="bh" style={{margin:0,cursor:"pointer",textTransform:"none",letterSpacing:1}}>Beni Hatırla</label>
        </div>
        <button className="login-btn" onClick={login}>GİRİŞ YAP</button>
        {loginErr && <div className="login-err">{loginErr}</div>}
      </div>
    </div>
  );

  if (!yuklendi) return <div className="loading"><style>{CSS}</style>Senkronize ediliyor...</div>;

  return (
    <div className="app">
      <style>{CSS}</style>
      <header className="hdr">
        <div className="logo" onClick={goGenel}>BAKIM<span>TAKİP</span></div>
        <div className="hdr-mid" style={{flex:1,maxWidth:400,margin:"0 20px"}}>
          <select className="kurum-select-main" value={seciliKurumId || ""} onChange={e => goKurum(Number(e.target.value))}>
            <option value="">TÜM KURUMLARI LİSTELE</option>
            {kurumlar.map(k => <option key={k.id} value={k.id}>{k.ad}</option>)}
          </select>
        </div>
        <div className="hdr-right">
          <div className="hdr-user">
            <span className="sync-doting"><div className={`sync-dot ${syncing ? "syncing" : ""}`} /></span>
            {aktifKullanici.ad} <span>({aktifKullanici.kullanici})</span>
          </div>
          <button className="hdr-btn" onClick={() => setModal("sifre")}>ŞİFRE</button>
          <button className="hdr-btn" onClick={cikisYap}>ÇIKIŞ</button>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="sb-home" onClick={goGenel}>
            <div className="sb-home-txt">ANA SAYFA</div>
          </div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 16px 12px"}}>
            <div className="sb-title" style={{padding:0}}>KURUMLAR ({kurumlar.length})</div>
            <button className="sb-add-btn" onClick={() => setModal("kurumEkle")}>+</button>
          </div>
          {kurumlar.map(k => {
            const s = ist(k.id);
            return (
              <div key={k.id} className={`ki ${seciliKurumId === k.id ? "active" : ""}`} onClick={() => goKurum(k.id)}>
                <div style={{overflow:"hidden"}}>
                  <div className="ki-name">{k.ad}</div>
                  <div className="ki-meta">Cihaz: {s.toplam} | Kritik: {s.kritik}</div>
                </div>
                <button className="ki-edit" onClick={e => { e.stopPropagation(); setIsimModal(k); setYeniIsim(k.ad); setModal("isim"); }}>✎</button>
              </div>
            );
          })}
        </aside>

        <main className="main">
          {ekran === "kurumlar" && (
            <>
              <div className="page-hdr">
                <div className="kd-title">GENEL DURUM</div>
              </div>
              <div className="stats">
                <div className="sc t" style={{cursor:"pointer",border:statFiltre===""?"2px solid #e85d26":"none"}} onClick={()=>setStatFiltre("")}>
                  <div className="sc-l">TOPLAM CİHAZ</div>
                  <div className="sc-v">{genelIst.toplam}</div>
                </div>
                <div className="sc ok" style={{cursor:"pointer",border:statFiltre==="ok"?"2px solid #4ade80":"none"}} onClick={()=>setStatFiltre("ok")}>
                  <div className="sc-l">BAKIMI GÜNCEL</div>
                  <div className="sc-v">{genelIst.ok}</div>
                </div>
                <div className="sc wn" style={{cursor:"pointer",border:statFiltre==="warn"?"2px solid #fbbf24":"none"}} onClick={()=>setStatFiltre("warn")}>
                  <div className="sc-l">BAKIM YAKLAŞAN</div>
                  <div className="sc-v">{genelIst.warn}</div>
                </div>
                <div className="sc cr" style={{cursor:"pointer",border:statFiltre==="kritik"?"2px solid #f87171":"none"}} onClick={()=>setStatFiltre("kritik")}>
                  <div className="sc-l">BAKIM GEREKLİ</div>
                  <div className="sc-v">{genelIst.kritik}</div>
                </div>
              </div>

              <div className="tb">
                <input className="inp inp-g" placeholder="Kurum veya seri no ile ara..." value={arama} onChange={e => setArama(e.target.value)} />
              </div>

              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>KURUM</th>
                      <th>CİHAZ</th>
                      <th>SERİ NO</th>
                      <th>SON PINCH/HAT</th>
                      <th>DURUM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cihazlar
                      .filter(c => {
                        const k = kurumlar.find(kr => kr.id === c.kurumId)?.ad || "";
                        const match = k.toLowerCase().includes(arama.toLowerCase()) || c.seri.toLowerCase().includes(arama.toLowerCase());
                        if (!match) return false;
                        if (!statFiltre) return true;
                        const t = sonPinchHatTarih(c.id);
                        const g = gunFarki(t);
                        if (statFiltre === "ok") return g !== null && g <= 30;
                        if (statFiltre === "warn") return g !== null && g > 30 && g <= 45;
                        if (statFiltre === "kritik") return g === null || g > 45;
                        return true;
                      })
                      .sort((a,b) => {
                        const ga = gunFarki(sonPinchHatTarih(a.id)) ?? 999;
                        const gb = gunFarki(sonPinchHatTarih(b.id)) ?? 999;
                        return gb - ga;
                      })
                      .map(c => (
                        <tr key={c.id} onClick={() => { setSeciliKurumId(c.kurumId); setSeciliCihazId(c.id); setEkran("cihazDetay"); }} style={{cursor:"pointer"}}>
                          <td style={{fontWeight:600}}>{kurumlar.find(k => k.id === c.kurumId)?.ad}</td>
                          <td>{c.ad}</td>
                          <td style={{fontFamily:"monospace"}}>{c.seri}</td>
                          <td>{fmt(sonPinchHatTarih(c.id))}</td>
                          <td><Durum tarih={sonPinchHatTarih(c.id)} sm /></td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </>
          )}

          {ekran === "kurumDetay" && seciliKurum && (
            <>
              <div className="kd-hdr">
                <div className="bc">
                  <button className="bcl" onClick={goGenel}>Kurumlar</button> / {seciliKurum.ad}
                </div>
                <div className="kd-ust">
                  <div>
                    <h1 className="kd-title">{seciliKurum.ad}</h1>
                    <div className="kd-meta">Toplam {cihazlar.filter(c => c.kurumId === seciliKurumId).length} cihaz kayıtlı</div>
                  </div>
                  <div className="kd-acts">
                    <button className="btn btn-sm" onClick={() => setModal("cihazEkle")}>+ YENİ CİHAZ</button>
                    <button className="btn btn-sm" style={{background:"#1a1a1a"}} onClick={() => setTeknikBilgiEkran(true)}>TEKNİK BİLGİLER</button>
                    <button className="btn-s btn-s-sm" style={{color:"#dc2626"}} onClick={() => setModal("kurumSilOnay")}>SİL</button>
                  </div>
                </div>
              </div>

              {seciliKurum.id === 1 && (
                <div style={{display:"flex",gap:8,marginBottom:20,overflowX:"auto",paddingBottom:4}}>
                  <button className={`btn-s btn-s-sm ${!seciliLine ? "active" : ""}`} onClick={() => setSeciliLine("")} style={{background: !seciliLine ? "#1a1a1a" : "", color: !seciliLine ? "#fff" : ""}}>TÜMÜ</button>
                  {LINES.map(l => (
                    <button key={l} className={`btn-s btn-s-sm ${seciliLine === l ? "active" : ""}`} onClick={() => setSeciliLine(l)} style={{background: seciliLine === l ? "#1a1a1a" : "", color: seciliLine === l ? "#fff" : ""}}>{l}</button>
                  ))}
                </div>
              )}

              <div className="cg">
                {cihazlar
                  .filter(c => c.kurumId === seciliKurumId && (!seciliLine || c.line === seciliLine))
                  .map(c => (
                    <div key={c.id} className="cc" onClick={() => goCihaz(c.id)}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                         <div className="cc-ad">{c.ad}</div>
                         <button className="cc-del" onClick={e => { e.stopPropagation(); setCihazSilModal(c); }}>×</button>
                      </div>
                      <div className="ktag">{c.seri}</div>
                      {c.line && <div className="ktag" style={{marginLeft:4,background:"#1a1a1a",color:"#fff"}}>{c.line}</div>}
                      <div className="cc-sb">Son Pinch/Hat:</div>
                      <div className="cc-alt">
                        <div style={{fontSize:11,fontWeight:500}}>{fmt(sonPinchHatTarih(c.id))}</div>
                        <Durum tarih={sonPinchHatTarih(c.id)} sm />
                      </div>
                    </div>
                  ))
                }
              </div>
            </>
          )}

          {ekran === "cihazDetay" && seciliCihaz && (
            <>
              <div className="dh">
                <div>
                  <div className="bc">
                    <button className="bcl" onClick={goGenel}>Kurumlar</button> /
                    <button className="bcl" onClick={() => goKurum(seciliKurumId)}>{seciliKurum?.ad}</button> / {seciliCihaz.ad}
                  </div>
                  <h1 className="d-title">{seciliCihaz.ad}</h1>
                  <div className="d-meta">
                    <span className="ktag">SERİ: {seciliCihaz.seri}</span>
                    {seciliCihaz.line && <span className="ktag" style={{background:"#1a1a1a",color:"#fff"}}>{seciliCihaz.line}</span>}
                    <Durum tarih={sonPinchHatTarih(seciliCihaz.id)} />
                  </div>
                </div>
                <button className="btn" onClick={() => setModal("bakimEkle")}>+ BAKIM KAYDI GİR</button>
              </div>

              <div className="sb-title">BAKIM GEÇMİŞİ</div>
              <div className="bl">
                {bakimlar
                  .filter(b => b.cihazId === seciliCihazId)
                  .sort((a,b) => new Date(b.tarih) - new Date(a.tarih))
                  .map(b => {
                    const dt = new Date(b.tarih);
                    return (
                      <div key={b.id} className="bi">
                        <div className="b-box">
                          <div className="b-gun">{dt.getDate()}</div>
                          <div className="b-ay">{dt.toLocaleDateString("tr-TR",{month:"short"})}</div>
                        </div>
                        <div className="b-det">
                          <div className="b-who">{b.yapan}</div>
                          <div className="b-note" style={{whiteSpace:"pre-wrap"}}>{b.notlar}</div>
                          {b.ekleyen && <div className="b-editor">Kayıt: {b.ekleyen}</div>}
                        </div>
                        <button className="b-del" onClick={() => setBakimSilModal(b)}>🗑️</button>
                      </div>
                    );
                  })
                }
                {bakimlar.filter(b => b.cihazId === seciliCihazId).length === 0 && (
                  <div className="empty">
                    <div className="ico">∅</div>
                    <p>Henüz bakım kaydı bulunmuyor.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {teknikBilgiEkran && (
        <div className="tb-overlay">
          <div className="tb-page">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div className="kd-title">{seciliKurum?.ad} <span style={{color:"#aaa"}}>/ TEKNİK BİLGİLER</span></div>
              <button className="btn" onClick={() => setTeknikBilgiEkran(false)}>KAPAT (ESC)</button>
            </div>

            <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"center"}}>
              <select className="tb-not-sec" value={seciliYedekNo} onChange={e => setSeciliYedekNo(e.target.value)}>
                <option value="">LÜTFEN BİR TABLO SEÇİN</option>
                {yedekTablolar.map(t => <option key={t.id} value={t.id}>{t.isim}</option>)}
              </select>
            </div>

            {seciliYedekNo ? (
              (() => {
                const tablo = yedekTablolar.find(t => t.id === Number(seciliYedekNo));
                if (!tablo) return null;
                return (
                  <div className="excel-wrap">
                    <div className="tb-hdr" style={{padding:16,background:"#fff",borderBottom:"1px solid #eee"}}>
                      <div className="tb-hdr-left">
                        {notIsmiDuzenle?.id === tablo.id ? (
                          <div style={{display:"flex",gap:6}}>
                            <input className="tb-isim-input" value={yeniIsim} onChange={e => setYeniIsim(e.target.value)} autoFocus />
                            <button className="btn btn-sm" onClick={yedekTablo_isimKaydet}>KAYDET</button>
                            <button className="btn-s btn-s-sm" onClick={() => setNotIsmiDuzenle(null)}>İPTAL</button>
                          </div>
                        ) : (
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <div className="tb-isim">{tablo.isim}</div>
                            <button className="tb-edit-btn" onClick={() => { setNotIsmiDuzenle(tablo); setYeniIsim(tablo.isim); }}>İSMİ DÜZENLE</button>
                          </div>
                        )}
                      </div>
                    </div>
                    <table className="excel-tbl">
                      <thead>
                        <tr>
                          {tablo.sutunlar.map((s, i) => (
                            <th key={i} className="excel-th">
                              <div className="excel-th-inner">
                                <input className="excel-th-input" value={s} onChange={e => yedekTablo_baslikGuncelle(tablo.id, i, e.target.value)} />
                                <button className="excel-del-col" onClick={() => yedekTablo_sutunSil(tablo.id, i)}>×</button>
                              </div>
                            </th>
                          ))}
                          <th className="excel-th-action">
                            <button className="excel-add-col" onClick={() => yedekTablo_sutunEkle(tablo.id)} title="Sütun Ekle">+</button>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {tablo.satirlar.map((satir, sIdx) => (
                          <tr key={satir.id} className={sIdx % 2 === 0 ? "excel-tr-even" : "excel-tr-odd"}>
                            {satir.hücreler.map((huc, cIdx) => (
                              <td key={cIdx} className="excel-td">
                                <input className="excel-cell" value={huc} onChange={e => yedekTablo_hucreGuncelle(tablo.id, satir.id, cIdx, e.target.value)} />
                              </td>
                            ))}
                            <td className="excel-td-action">
                              <button className="excel-del-row" onClick={() => yedekTablo_satirSil(tablo.id, satir.id)}>🗑️</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{padding:12,background:"#f9f9f9"}}>
                      <button className="excel-add-row" onClick={() => yedekTablo_satirEkle(tablo.id)}>+ YENİ SATIR EKLE</button>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="empty" style={{background:"#fff",border:"2px dashed #d0ccc4"}}>
                <div className="ico">📋</div>
                <p>Görüntülemek istediğiniz teknik bilgi tablosunu yukarıdan seçin.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {modal === "kurumEkle" && (
        <div className="ov" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="m-title">YENİ KURUM EKLE</div>
            <div className="fg">
              <label>Kurum Adı</label>
              <input className="fi" value={yeniKurumAd} onChange={e => setYeniKurumAd(e.target.value)} autoFocus />
            </div>
            <div className="m-acts">
              <button className="btn-s" onClick={() => setModal(null)}>İPTAL</button>
              <button className="btn" onClick={() => kurumEkle(yeniKurumAd)}>KURUMU KAYDET</button>
            </div>
          </div>
        </div>
      )}

      {modal === "isim" && (
        <div className="ov" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="m-title">KURUM İSMİNİ DÜZENLE</div>
            <div className="fg">
              <label>Yeni İsim</label>
              <input className="fi" value={yeniIsim} onChange={e => setYeniIsim(e.target.value)} autoFocus />
            </div>
            <div className="m-acts">
              <button className="btn-s" onClick={() => setModal(null)}>İPTAL</button>
              <button className="btn" onClick={isimKaydet}>GÜNCELLE</button>
            </div>
          </div>
        </div>
      )}

      {modal === "cihazEkle" && (
        <div className="ov" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="m-title">YENİ CİHAZ EKLE</div>
            <div className="fg">
              <label>Cihaz Modeli</label>
              <select className="fi" value={cihazForm.ad} onChange={e => setCihazForm({ ...cihazForm, ad: e.target.value })}>
                {CIHAZ_TURLERI.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="fg">
              <label>Seri Numarası</label>
              <input className="fi" value={cihazForm.seri} onChange={e => setCihazForm({ ...cihazForm, seri: e.target.value.toUpperCase() })} />
            </div>
            {seciliKurumId === 1 && (
              <div className="fg">
                <label>Line Seçimi</label>
                <select className="fi" value={seciliLine} onChange={e => setSeciliLine(e.target.value)}>
                  <option value="">Line Seçin (Opsiyonel)</option>
                  {LINES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            )}
            <div className="m-acts">
              <button className="btn-s" onClick={() => setModal(null)}>İPTAL</button>
              <button className="btn" onClick={cihazEkle}>CİHAZI EKLE</button>
            </div>
          </div>
        </div>
      )}

      {modal === "bakimEkle" && (
        <div className="ov" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="m-title">BAKIM KAYDI GİRİŞİ</div>
            <div className="fg">
              <label>Bakım Tarihi</label>
              <input className="fi" type="date" value={bakimForm.tarih} onChange={e => setBakimForm({ ...bakimForm, tarih: e.target.value })} />
            </div>
            <div className="fg">
              <label>Hızlı Seçimler</label>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,background:"#f9f9f9",padding:10,borderRadius:2,border:"1px solid #eee"}}>
                {["Pinch Tube Değişimi", "Hat Bakımı", "Genel Temizlik", "Parça Değişimi", "Kalibrasyon", "Yazılım Güncelleme"].map(opt => (
                  <label key={opt} style={{display:"flex",alignItems:"center",gap:6,fontSize:10,cursor:"pointer",textTransform:"none",color:"#555",margin:0}}>
                    <input type="checkbox" checked={bakimForm.checkboxlar.includes(opt)} onChange={e => {
                      const current = bakimForm.checkboxlar;
                      setBakimForm({ ...bakimForm, checkboxlar: e.target.checked ? [...current, opt] : current.filter(x => x !== opt) });
                    }} /> {opt}
                  </label>
                ))}
              </div>
            </div>
            <div className="fg">
              <label>Ek Notlar</label>
              <textarea className="fi" placeholder="Yapılan işlemler hakkında detay..." value={bakimForm.notlar} onChange={e => setBakimForm({ ...bakimForm, notlar: e.target.value })} />
            </div>
            <div className="m-acts">
              <button className="btn-s" onClick={() => setModal(null)}>İPTAL</button>
              <button className="btn" onClick={bakimEkle}>KAYDI TAMAMLA</button>
            </div>
          </div>
        </div>
      )}

      {modal === "sifre" && (
        <div className="ov" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="m-title">HESAP AYARLARI</div>
            <div style={{fontSize:12,color:"#666",marginBottom:20,lineHeight:1.6}}>
              Güvenliğiniz için şifre işlemleri kayıtlı e-posta adresiniz üzerinden yürütülür. Aşağıdaki butona bastığınızda <strong>{aktifKullanici.mail}</strong> adresine bir sıfırlama bağlantısı gönderilecektir.
            </div>
            <button className="btn" style={{width:"100%"}} onClick={sifreSifirla}>ŞİFRE SIFIRLAMA MAİLİ GÖNDER</button>
            {sifreSifirlamaMsg && <div className="m-ok">{sifreSifirlamaMsg}</div>}
            {sifreSifirlamaErr && <div className="m-err">{sifreSifirlamaErr}</div>}
            <div className="m-acts">
              <button className="btn-s" onClick={() => setModal(null)}>KAPAT</button>
            </div>
          </div>
        </div>
      )}

      {modal === "kurumSilOnay" && (
        <div className="ov" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{textAlign:\"center\",marginBottom:16}}>
              <div style={{fontSize:32,marginBottom:8}}>⚠️</div>
              <div className="m-title" style={{color:\"#dc2626\"}}>KURUMU SİL</div>
            </div>
            <div style={{fontSize:13,color:\"#1a1a1a\",marginBottom:20,lineHeight:1.8,padding:\"12px\",background:\"#fef2f2\",border:\"1px solid #fecaca\",borderRadius:\"4px\"}}>
               <strong>{seciliKurum?.ad}</strong> kurumunu ve bu kuruma bağlı tüm cihaz ve bakım kayıtlarını silmek istediğinize emin misiniz?<br/>
               <span style={{color:\"#dc2626\",fontWeight:600}}>Bu işlem geri alınamaz!</span>
            </div>
            <div className="m-acts">
              <button className="btn-s" onClick={() => setModal(null)} style={{flex:1}}>İPTAL</button>
              <button className="btn" onClick={() => kurumSil(seciliKurumId)} style={{background:\"#dc2626\",flex:1}}>EVET, SİL</button>
            </div>
          </div>
        </div>
      )}

      {cihazSilModal && (
        <div className="ov" onClick={() => setCihazSilModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{textAlign:\"center\",marginBottom:16}}>
              <div style={{fontSize:32,marginBottom:8}}>⚠️</div>
              <div className="m-title" style={{color:\"#dc2626\"}}>CİHAZI SİL</div>
            </div>
            <div style={{fontSize:13,color:\"#1a1a1a\",marginBottom:20,lineHeight:1.8,padding:\"12px\",background:\"#fef2f2\",border:\"1px solid #fecaca\",borderRadius:\"4px\"}}>
              <strong>{cihazSilModal.ad} ({cihazSilModal.seri})</strong> cihazını ve tüm bakım geçmişini silmek istediğinize emin misiniz?<br/>
              <span style={{color:\"#dc2626\",fontWeight:600}}>Bu işlem geri alınamaz!</span>
            </div>
            <div className="m-acts">
              <button className="btn-s" onClick={() => setCihazSilModal(null)} style={{flex:1}}>İptal</button>
              <button className="btn" onClick={cihazSilOnayla} style={{background:\"#dc2626\",flex:1}}>Cihazı Sil</button>
            </div>
          </div>
        </div>
      )}

      {bakimSilModal && (
        <div className="ov" onClick={() => setBakimSilModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{textAlign:"center",marginBottom:16}}>
              <div style={{fontSize:32,marginBottom:8}}>⚠️</div>
              <div className="m-title" style={{color:"#dc2626"}}>BAKIM KAYDINI SİL</div>
            </div>
            <div style={{fontSize:13,color:"#1a1a1a",marginBottom:20,lineHeight:1.8,padding:"12px",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:"4px"}}>
              <div style={{marginBottom:8}}><strong>Bu işlem geri alınamaz!</strong></div>
              <div style={{marginBottom:10}}>
                <strong>{new Date(bakimSilModal.tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })}</strong> tarihindeki bakım kaydını silmek istediğinize emin misiniz?
              </div>
              <div style={{fontSize:12,color:"#666",borderTop:"1px solid #fecaca",paddingTop:8}}>
                <div>👤 Teknisyen: <strong>{bakimSilModal.yapan}</strong></div>
                {bakimSilModal.notlar && <div>📝 Not: <strong>{bakimSilModal.notlar}</strong></div>}
              </div>
            </div>
            <div className="m-acts">
              <button className="btn-s" onClick={() => setBakimSilModal(null)} style={{flex:1}}>İptal</button>
              <button className="btn btn-sm" onClick={bakimSilOnayla} style={{background:"#dc2626",flex:1}}>Sil</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
