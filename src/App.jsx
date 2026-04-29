import { useState, useMemo, useEffect, useCallback } from "react";
import { db, ref, get, onValue, auth, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "./firebase.js";
import { update } from "firebase/database";

// Güvenli array çevirici
const toArr = v => Array.isArray(v) ? v : Object.values(v || {});

const KULLANICI_MAP = {
  "bkahraman@nukleus.com.tr": { kullanici: "kahraman", ad: "Burhan Kahraman" },
  "ysahan@nukleus.com.tr":    { kullanici: "sahan",    ad: "Yunus Şahan" },
  "aturhan@nukleus.com.tr":   { kullanici: "turhan",   ad: "Arif Turhan" },
  "dkilic@nukleus.com.tr":    { kullanici: "kilic",    ad: "Diyarcan Kılıç" },
};

function gunFarki(t) {
  if (!t) return null;
  return Math.floor((new Date() - new Date(t)) / 86400000);
}

export default function App() {

  const [aktifKullanici, setAktifKullanici] = useState(null);
  const [kurumlar, setKurumlar] = useState([]);
  const [cihazlar, setCihazlar] = useState([]);
  const [bakimlar, setBakimlar] = useState([]);
  const [yuklendi, setYuklendi] = useState(false);

  const [seciliKurumId, setSeciliKurumId] = useState(null);
  const [seciliCihazId, setSeciliCihazId] = useState(null);

  const [arama, setArama] = useState("");

  // 🔥 VERİ YÜKLE
  const yukleVeri = useCallback(async () => {
    try {
      const snap = await get(ref(db, "bakimApp"));
      if (snap.exists()) {
        const d = snap.val();
        if (d.kurumlar) setKurumlar(toArr(d.kurumlar));
        if (d.cihazlar) setCihazlar(toArr(d.cihazlar));
        if (d.bakimlar) setBakimlar(toArr(d.bakimlar));
      }
    } catch(e) {
      console.error(e);
    }
    setYuklendi(true);
  }, []);

  // 🔥 VERİ KAYDET (FIX)
  const kaydetVeri = useCallback(async (k, c, b) => {
    try {
      await update(ref(db, "bakimApp"), {
        kurumlar: k,
        cihazlar: c,
        bakimlar: b
      });
    } catch(e) {
      console.error("Kayıt hatası:", e);
    }
  }, []);

  // 🔥 REALTIME
  useEffect(() => {
    const unsub = onValue(ref(db, "bakimApp"), snap => {
      if (snap.exists()) {
        const d = snap.val();
        if (d.kurumlar) setKurumlar(toArr(d.kurumlar));
        if (d.cihazlar) setCihazlar(toArr(d.cihazlar));
        if (d.bakimlar) setBakimlar(toArr(d.bakimlar));
        setYuklendi(true);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => { yukleVeri(); }, []);

  // 🔥 PINCH / HAT TARİHİ (FIX)
  function sonPinchHatTarih(cihazId) {
    const ilgili = bakimlar.filter(b =>
      b.cihazId === cihazId &&
      (
        (b.notlar || "").includes("Pinch Tube Değişimi") ||
        (b.notlar || "").includes("Hat Bakımı")
      )
    );

    if (ilgili.length === 0) return null;

    return ilgili.reduce((en, b) =>
      (!en || new Date(b.tarih) > new Date(en) ? b.tarih : en),
      null
    );
  }

  // 🔥 CİHAZ SİL (FIX)
  async function cihazSil(cihaz) {
    const yeniCihazlar = cihazlar.filter(c => c.id !== cihaz.id);
    const yeniBakimlar = bakimlar.filter(b => b.cihazId !== cihaz.id);

    setCihazlar(yeniCihazlar);
    setBakimlar(yeniBakimlar);

    await kaydetVeri(kurumlar, yeniCihazlar, yeniBakimlar);

    if (seciliCihazId === cihaz.id) {
      setSeciliCihazId(null);
      setSeciliKurumId(cihaz.kurumId); // FIX
    }
  }

  if (!yuklendi) return <div>Yükleniyor...</div>;

  return (
    <div>
      <h2>BAKIM TAKİP</h2>

      <input
        placeholder="Ara..."
        value={arama}
        onChange={e => setArama(e.target.value)}
      />

      <ul>
        {cihazlar
          .filter(c => {
            const kurum = kurumlar.find(k => k.id === c.kurumId)?.ad || "";

            return (
              kurum.toLowerCase().includes(arama.toLowerCase()) ||
              (c.seri || "").toLowerCase().includes(arama.toLowerCase())
            );
          })
          .map(c => (
            <li key={c.id}>
              {c.ad} - {c.seri}

              <button onClick={() => cihazSil(c)}>Sil</button>

              <div>
                Son bakım: {sonPinchHatTarih(c.id) || "Yok"}
                ({gunFarki(sonPinchHatTarih(c.id)) ?? "-"} gün)
              </div>
            </li>
          ))
        }
      </ul>
    </div>
  );
}