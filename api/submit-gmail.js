import nodemailer from 'nodemailer';
import { get, head, put } from '@vercel/blob';

const DEFAULT_EMAIL = 'inmobiliariaactiva360@gmail.com';
const MAX_FILES = 20;
const MAX_TOTAL_BYTES = 60 * 1024 * 1024;
const MAX_EMAIL_ATTACHMENT_BYTES = 18 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

const LABELS = {
  promocion: 'Inmueble / Promoción de interés',
  titular1_nombre: 'Titular 1 - Nombre y apellidos',
  titular1_dni: 'Titular 1 - DNI / NIE',
  titular1_fecha_nacimiento: 'Titular 1 - Fecha de nacimiento',
  titular1_nacionalidad: 'Titular 1 - Nacionalidad',
  titular1_estado_civil: 'Titular 1 - Estado civil',
  titular1_profesion: 'Titular 1 - Profesión / Ocupación',
  titular1_tipo_contrato: 'Titular 1 - Tipo de contrato',
  titular1_antiguedad_laboral: 'Titular 1 - Antigüedad laboral',
  titular1_ingresos: 'Titular 1 - Ingresos netos mensuales',
  titular2_nombre: 'Titular 2 - Nombre y apellidos',
  titular2_dni: 'Titular 2 - DNI / NIE',
  titular2_fecha_nacimiento: 'Titular 2 - Fecha de nacimiento',
  titular2_nacionalidad: 'Titular 2 - Nacionalidad',
  titular2_estado_civil: 'Titular 2 - Estado civil',
  titular2_profesion: 'Titular 2 - Profesión / Ocupación',
  titular2_tipo_contrato: 'Titular 2 - Tipo de contrato',
  titular2_antiguedad_laboral: 'Titular 2 - Antigüedad laboral',
  titular2_ingresos: 'Titular 2 - Ingresos netos mensuales',
  telefono: 'Teléfono de contacto',
  email: 'Email de contacto',
  ahorros_disponibles: 'Ahorros propios disponibles',
  otros_prestamos: 'Pago mensual de otros préstamos',
  otras_propiedades: 'Otras propiedades y cargas',
  consentimiento_rgpd: 'Consentimiento RGPD',
};

const REQUIRED_FIELDS = [
  'promocion',
  'titular1_nombre',
  'titular1_dni',
  'titular1_fecha_nacimiento',
  'titular1_nacionalidad',
  'titular1_estado_civil',
  'titular1_profesion',
  'titular1_tipo_contrato',
  'titular1_antiguedad_laboral',
  'titular1_ingresos',
  'telefono',
  'email',
  'ahorros_disponibles',
  'consentimiento_rgpd',
];

function cleanText(value, maxLength = 5000) {
  return typeof value === 'string'
    ? value.replace(/[\u0000\r]/g, '').trim().slice(0, maxLength)
    : '';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function isSafeFolder(folder) {
  return typeof folder === 'string'
    && /^solicitudes_financiacion\/[A-Za-z0-9._-]+__[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{2}-[0-9]{2}-[0-9]{2}__[a-f0-9]{12}$/.test(folder);
}

function formatMoney(value) {
  const number = Number(String(value || '').replace(',', '.'));
  if (!Number.isFinite(number)) return value || 'No indicado';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(number);
}

function formattedValue(field, value) {
  if (['titular1_ingresos', 'titular2_ingresos', 'ahorros_disponibles', 'otros_prestamos'].includes(field)) {
    return formatMoney(value);
  }
  return value || 'No indicado';
}

function madridDate() {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    dateStyle: 'full',
    timeStyle: 'medium',
  }).format(new Date());
}

function withTimeout(promise, milliseconds, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), milliseconds);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function buildSummaryHtml(fields, files, receivedAt) {
  const rows = Object.entries(LABELS).map(([field, label]) => {
    const value = formattedValue(field, fields[field]);
    return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value).replaceAll('\n', '<br>')}</td></tr>`;
  }).join('');

  const fileRows = files.map((file) => (
    `<li><strong>${escapeHtml(file.storedName)}</strong> — original: ${escapeHtml(file.originalName)} (${Math.round(file.size / 1024)} KB)</li>`
  )).join('');

  return `<!doctype html><html lang="es"><head><meta charset="UTF-8"><title>Solicitud de financiación</title></head><body style="font-family:Arial,sans-serif;color:#283344;line-height:1.5"><h1 style="color:#172033">Solicitud de estudio de financiación</h1><p><strong>Fecha de recepción:</strong> ${escapeHtml(receivedAt)}</p><table style="border-collapse:collapse;width:100%;max-width:950px"><style>th,td{padding:10px;border:1px solid #dce2ea;text-align:left}th{background:#f4f6f9;width:38%}</style>${rows}</table><h2 style="color:#172033">Documentación recibida</h2><ul>${fileRows}</ul></body></html>`;
}

function buildSummaryText(fields, files, receivedAt) {
  const lines = [
    'SOLICITUD DE ESTUDIO DE FINANCIACIÓN',
    `Fecha de recepción: ${receivedAt}`,
    '='.repeat(70),
  ];

  Object.entries(LABELS).forEach(([field, label]) => {
    lines.push(`${label}: ${formattedValue(field, fields[field])}`);
  });

  lines.push('', 'DOCUMENTACIÓN RECIBIDA', '-'.repeat(70));
  files.forEach((file) => lines.push(`- ${file.storedName} (original: ${file.originalName})`));
  return `${lines.join('\n')}\n`;
}

async function readPrivateBlob(pathname, filename) {
  const result = await withTimeout(
    get(pathname, { access: 'private' }),
    12000,
    `Tiempo agotado al recuperar ${filename}.`,
  );

  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error(`No se pudo recuperar ${filename} para adjuntarlo.`);
  }

  const arrayBuffer = await withTimeout(
    new Response(result.stream).arrayBuffer(),
    12000,
    `Tiempo agotado al leer ${filename}.`,
  );

  return Buffer.from(arrayBuffer);
}

function gmailTransport() {
  const user = cleanText(process.env.GMAIL_USER, 320);
  const password = String(process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

  if (!user || !password) {
    throw new Error('Faltan GMAIL_USER o GMAIL_APP_PASSWORD en Vercel.');
  }

  return {
    user,
    transporter: nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass: password,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
    }),
  };
}

async function sendWithGmailSmtp({ fields, files, summaryHtml, summaryText, folder }) {
  const { user, transporter } = gmailTransport();
  const attachments = [
    {
      filename: 'resultado-formulario.html',
      content: Buffer.from(summaryHtml, 'utf8'),
      contentType: 'text/html; charset=utf-8',
    },
    {
      filename: 'resultado-formulario.txt',
      content: Buffer.from(summaryText, 'utf8'),
      contentType: 'text/plain; charset=utf-8',
    },
  ];

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  let attachmentNote = '';

  if (totalBytes <= MAX_EMAIL_ATTACHMENT_BYTES) {
    for (const file of files) {
      attachments.push({
        filename: file.storedName,
        content: await readPrivateBlob(file.pathname, file.storedName),
        contentType: file.contentType,
      });
    }
  } else {
    attachmentNote = '<p><strong>Aviso:</strong> los documentos superan el límite para adjuntarlos al correo y han quedado guardados en el almacenamiento privado de Vercel.</p>';
  }

  const emailHtml = `${summaryHtml.replace('</body></html>', '')}${attachmentNote}<p><strong>Carpeta privada:</strong> ${escapeHtml(folder)}</p></body></html>`;

  const info = await withTimeout(
    transporter.sendMail({
      from: `"Activa Inmobiliaria 360" <${user}>`,
      to: user,
      replyTo: fields.email,
      subject: `Nueva solicitud de financiación - ${fields.titular1_nombre || 'Sin nombre'}`,
      html: emailHtml,
      text: summaryText,
      attachments,
    }),
    45000,
    'Gmail tardó demasiado en enviar el correo.',
  );

  return { sent: true, id: info.messageId || null };
}

export async function POST(request) {
  const startedAt = Date.now();

  try {
    const payload = await request.json();
    const folder = payload?.folder;
    const incomingFields = payload?.fields;
    const incomingFiles = payload?.files;

    if (!isSafeFolder(folder)) {
      return Response.json({ ok: false, error: 'Carpeta de solicitud no válida.' }, { status: 400 });
    }

    if (!incomingFields || typeof incomingFields !== 'object' || Array.isArray(incomingFields)) {
      return Response.json({ ok: false, error: 'Los datos del formulario no son válidos.' }, { status: 400 });
    }

    const fields = {};
    Object.keys(LABELS).forEach((field) => {
      fields[field] = cleanText(incomingFields[field]);
    });

    for (const field of REQUIRED_FIELDS) {
      if (!fields[field]) {
        return Response.json({ ok: false, error: `Falta el campo obligatorio: ${LABELS[field]}.` }, { status: 400 });
      }
    }

    if (!/^\S+@\S+\.\S+$/.test(fields.email)) {
      return Response.json({ ok: false, error: 'El email de contacto no es válido.' }, { status: 400 });
    }

    if (!Array.isArray(incomingFiles) || incomingFiles.length < 1 || incomingFiles.length > MAX_FILES) {
      return Response.json({ ok: false, error: 'La lista de documentos no es válida.' }, { status: 400 });
    }

    const files = [];
    let totalBytes = 0;

    for (const item of incomingFiles) {
      const pathname = cleanText(item?.pathname, 1000);
      const expectedPrefix = `${folder}/documentos/`;

      if (!pathname.startsWith(expectedPrefix) || pathname.includes('..')) {
        return Response.json({ ok: false, error: 'Se ha detectado una ruta de documento no válida.' }, { status: 400 });
      }

      const metadata = await withTimeout(
        head(pathname),
        10000,
        `Tiempo agotado al verificar ${pathname}.`,
      );

      if (!ALLOWED_CONTENT_TYPES.has(metadata.contentType)) {
        return Response.json({ ok: false, error: `Tipo de documento no permitido: ${pathname}.` }, { status: 400 });
      }

      totalBytes += metadata.size;
      files.push({
        originalName: cleanText(item?.originalName, 255) || metadata.pathname.split('/').pop(),
        storedName: cleanText(item?.storedName, 255) || metadata.pathname.split('/').pop(),
        pathname: metadata.pathname,
        contentType: metadata.contentType,
        size: metadata.size,
      });
    }

    if (totalBytes > MAX_TOTAL_BYTES) {
      return Response.json({ ok: false, error: 'El tamaño total de los documentos supera los 60 MB.' }, { status: 400 });
    }

    const receivedAt = madridDate();
    const summaryHtml = buildSummaryHtml(fields, files, receivedAt);
    const summaryText = buildSummaryText(fields, files, receivedAt);
    const jsonContent = JSON.stringify({ receivedAt, folder, fields, files }, null, 2);

    await withTimeout(
      Promise.all([
        put(`${folder}/resultado-formulario.html`, summaryHtml, {
          access: 'private',
          contentType: 'text/html; charset=utf-8',
          addRandomSuffix: false,
        }),
        put(`${folder}/resultado-formulario.txt`, summaryText, {
          access: 'private',
          contentType: 'text/plain; charset=utf-8',
          addRandomSuffix: false,
        }),
        put(`${folder}/datos-formulario.json`, jsonContent, {
          access: 'private',
          contentType: 'application/json; charset=utf-8',
          addRandomSuffix: false,
        }),
      ]),
      20000,
      'Tiempo agotado al guardar el resumen del expediente.',
    );

    let emailResult;
    try {
      emailResult = await sendWithGmailSmtp({
        fields,
        files,
        summaryHtml,
        summaryText,
        folder,
      });
    } catch (emailError) {
      console.error('Expediente guardado, pero falló Gmail SMTP:', emailError);
      emailResult = {
        sent: false,
        warning: emailError instanceof Error ? emailError.message : 'error de Gmail no identificado',
      };
    }

    console.log('Solicitud finalizada con Gmail SMTP', {
      emailSent: emailResult.sent,
      durationMs: Date.now() - startedAt,
    });

    return Response.json({
      ok: true,
      saved: true,
      emailSent: emailResult.sent,
      emailWarning: emailResult.warning || null,
    });
  } catch (error) {
    console.error('Error procesando formulario:', error);
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error interno del servidor.' },
      { status: 500 },
    );
  }
}
