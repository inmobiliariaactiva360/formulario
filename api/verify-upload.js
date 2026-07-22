import { head } from '@vercel/blob';

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function isSafePathname(pathname) {
  return typeof pathname === 'string'
    && /^solicitudes_financiacion\/[A-Za-z0-9._-]+__[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{2}-[0-9]{2}-[0-9]{2}__[a-f0-9]{12}\/documentos\/[A-Za-z0-9._-]+$/.test(pathname)
    && !pathname.includes('..')
    && !pathname.includes('\\');
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function findBlob(pathname) {
  let lastError;

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      return await head(pathname);
    } catch (error) {
      lastError = error;
      if (attempt < 6) {
        await sleep(750);
      }
    }
  }

  throw lastError || new Error('El documento todavía no aparece en Vercel Blob.');
}

async function handleRequest(request) {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Método no permitido.' }, 405);
  }

  try {
    const payload = await request.json();
    const pathname = String(payload?.pathname || '');
    const expectedContentType = String(payload?.contentType || '');
    const expectedSize = Number(payload?.size || 0);

    if (!isSafePathname(pathname)) {
      return json({ ok: false, error: 'La ruta del documento no es válida.' }, 400);
    }

    const metadata = await findBlob(pathname);

    if (!ALLOWED_CONTENT_TYPES.has(metadata.contentType)) {
      return json({ ok: false, error: 'El documento guardado tiene un tipo no permitido.' }, 400);
    }

    if (expectedContentType && metadata.contentType !== expectedContentType) {
      return json({ ok: false, error: 'El tipo del documento guardado no coincide con el enviado.' }, 400);
    }

    if (metadata.size <= 0 || metadata.size > MAX_FILE_SIZE) {
      return json({ ok: false, error: 'El tamaño del documento guardado no es válido.' }, 400);
    }

    if (expectedSize > 0 && metadata.size !== expectedSize) {
      return json({ ok: false, error: 'El archivo no se guardó completamente. Vuelva a seleccionarlo.' }, 400);
    }

    return json({
      ok: true,
      pathname: metadata.pathname,
      contentType: metadata.contentType,
      size: metadata.size,
    });
  } catch (error) {
    console.error('No se pudo verificar el documento subido:', error);
    return json(
      {
        ok: false,
        error: error instanceof Error
          ? error.message
          : 'No se pudo verificar el documento subido.',
      },
      500,
    );
  }
}

export default {
  fetch: handleRequest,
};
