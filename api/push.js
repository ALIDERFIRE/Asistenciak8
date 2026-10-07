/* Envía notificaciones push. Lo llama el Apps Script de la hoja.
   Variables de entorno en Vercel: VAPID_PUBLIC, VAPID_PRIVATE, PUSH_SECRET */
const webpush = require('web-push');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Sólo POST' });
  let b = req.body || {};
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  if (!process.env.PUSH_SECRET || b.secret !== process.env.PUSH_SECRET) {
    return res.status(401).json({ ok: false, error: 'Clave incorrecta' });
  }
  if (!process.env.VAPID_PUBLIC || !process.env.VAPID_PRIVATE) {
    return res.status(500).json({ ok: false, error: 'Faltan VAPID_PUBLIC / VAPID_PRIVATE en Vercel' });
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@asistenciak8.vercel.app',
    process.env.VAPID_PUBLIC, process.env.VAPID_PRIVATE);

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
