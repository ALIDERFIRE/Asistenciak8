/* Envía notificaciones push. Lo llama el Apps Script de la hoja.
   Variables de entorno en Vercel: VAPID_PUBLIC, VAPID_PRIVATE, PUSH_SECRET */
const webpush = require('web-push');

const limpio = v => String(v || '').trim();

module.exports = async (req, res) => {
  const SECRETO = limpio(process.env.PUSH_SECRET);
  const PUB = limpio(process.env.VAPID_PUBLIC);
  const PRIV = limpio(process.env.VAPID_PRIVATE);
  /* Sólo dice si cada variable está cargada, nunca su valor */
  const variables = { PUSH_SECRET: !!SECRETO, VAPID_PUBLIC: !!PUB, VAPID_PRIVATE: !!PRIV };

  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Sólo POST', variables });
  let b = req.body || {};
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }

  if (!SECRETO) return res.status(500).json({ ok: false, error: 'PUSH_SECRET no está cargada en este despliegue de Vercel', variables });
  if (limpio(b.secret) !== SECRETO) return res.status(401).json({ ok: false, error: 'Clave incorrecta: PUSH_SECRET de Vercel no coincide con la del Apps Script', variables });
  if (!PUB || !PRIV) return res.status(500).json({ ok: false, error: 'Faltan VAPID_PUBLIC / VAPID_PRIVATE en Vercel', variables });

  try {
    webpush.setVapidDetails(limpio(process.env.VAPID_SUBJECT) || 'mailto:admin@asistenciak8.vercel.app', PUB, PRIV);
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'Claves VAPID mal cargadas: ' + String(e && e.message || e), variables });
  }

  const subs = Array.isArray(b.subs) ? b.subs.slice(0, 200) : [];
  const cuerpo = JSON.stringify(b.payload || {});
  const urgente = b.payload && b.payload.tipo === 'llamado';
  const resultados = await Promise.all(subs.map(async s => {
    try {
      await webpush.sendNotification(s, cuerpo, { TTL: urgente ? 1800 : 86400, urgency: urgente ? 'high' : 'normal' });
      return { endpoint: s.endpoint, ok: true };
    } catch (e) {
      /* 404 / 410: el celular ya no tiene esa suscripción, hay que borrarla */
      return { endpoint: s.endpoint, ok: false, status: e.statusCode || 0, vencida: e.statusCode === 404 || e.statusCode === 410 };
    }
  }));
  res.status(200).json({ ok: true, enviados: resultados.filter(r => r.ok).length, resultados });
};
