import { issueSignedToken, presignUrl } from '@vercel/blob';

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);
const ALLOWED_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png']);

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

function isSafePathname(pathname) {
  return typeof pathname === 'string'
    && /^solicitudes_financiacion\/[A-Za-z0-9._-]+__[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{2}-[0-9]{2}-[0-9]{2}__[a-f0-9]{12}\/documentos\/[A-Za-z0-9._-]+$/.test(pathname)
    && !pathname.includes('..')
    && !pathname.includes('\\');
}

async function handleRequest(request) {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Método no permitido.' }, 405);
  }

  try {
    const payload = await request.json();
    const pathname = String(payload?.pathname || '');
    const contentType = String(payload?.contentType || '');
    const size = Number(payload?.size || 0);
    const extension = pathname.split('.').pop()?.toLowerCase() || '';

    if (!isSafePathname(pathname)) {
      return json({ ok: false, error: 'La ruta del documento no es válida.' }, 400);
    }

    if (!ALLOWED_CONTENT_TYPES.has(contentType) || !ALLOWED_EXTENSIONS.has(extension)) {
      return json({ ok: false, error: 'El tipo de documento no está permitido.' }, 400);
    }

    if (!Number.isFinite(size) || size <= 0 || size > MAX_FILE_SIZE) {
      return json({ ok: false, error: 'El documento supera el límite de 15 MB.' }, 400);
    }

    const validUntil = Date.now() + 15 * 60 * 1000;

    const signedToken = await issueSignedToken({
      pathname,
      operations: ['put'],
      validUntil,
    });

    const { presignedUrl } = await presignUrl(signedToken, {
      pathname,
      operation: 'put',
      validUntil,
    });

    return json({
      ok: true,
      pathname,
      presignedUrl,
      expiresAt: validUntil,
    });
  } catch (error) {
    console.error('No se pudo crear la URL firmada de subida:', error);
    return json(
      {
        ok: false,
        error: error instanceof Error
          ? error.message
          : 'No se pudo autorizar la subida del documento.',
      },
      500,
    );
  }
}

export default {
  fetch: handleRequest,
};
