import { handleUpload } from '@vercel/blob/client';

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

function isSafeFolder(folder) {
    return typeof folder === 'string'
        && /^solicitudes_financiacion\/[A-Za-z0-9._-]+__[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{2}-[0-9]{2}-[0-9]{2}__[a-f0-9]{12}$/.test(folder);
}

export default async function handler(request) {
    if (request.method !== 'POST') {
        return Response.json(
            { error: 'Método no permitido.' },
            { status: 405, headers: { Allow: 'POST' } }
        );
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
        console.error('Falta BLOB_READ_WRITE_TOKEN en este despliegue de Vercel.');
        return Response.json(
            {
                error: 'El almacenamiento privado no está conectado a este entorno. Falta BLOB_READ_WRITE_TOKEN.',
            },
            { status: 500 }
        );
    }

    try {
        const body = await request.json();

        const response = await handleUpload({
            body,
            request,
            onBeforeGenerateToken: async (pathname, clientPayload) => {
                let payload;
                try {
                    payload = JSON.parse(clientPayload || '{}');
                } catch {
                    throw new Error('Datos de subida no válidos.');
                }

                if (!isSafeFolder(payload.folder)) {
                    throw new Error('Carpeta de solicitud no válida.');
                }

                const expectedPrefix = `${payload.folder}/documentos/`;
                if (
                    typeof pathname !== 'string'
                    || !pathname.startsWith(expectedPrefix)
                    || pathname.includes('..')
                    || pathname.includes('\\')
                ) {
                    throw new Error('Ruta de archivo no permitida.');
                }

                if (!ALLOWED_CONTENT_TYPES.includes(payload.type)) {
                    throw new Error('Tipo de archivo no permitido.');
                }

                return {
                    allowedContentTypes: ALLOWED_CONTENT_TYPES,
                    maximumSizeInBytes: MAX_FILE_SIZE,
                    addRandomSuffix: false,
                    allowOverwrite: false,
                    tokenPayload: JSON.stringify({
                        folder: payload.folder,
                        originalName: String(payload.originalName || '').slice(0, 255),
                        storedName: String(payload.storedName || '').slice(0, 255),
                    }),
                };
            },
            onUploadCompleted: async ({ blob, tokenPayload }) => {
                console.log('Documento recibido', {
                    pathname: blob.pathname,
                    tokenPayload,
                });
            },
        });

        return Response.json(response);
    } catch (error) {
        console.error('Error de subida:', error);
        return Response.json(
            { error: error instanceof Error ? error.message : 'No se pudo autorizar la subida.' },
            { status: 400 }
        );
    }
}
