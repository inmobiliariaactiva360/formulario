import { POST } from './submit.js';

export default async function handler(request) {
    if (request.method !== 'POST') {
        return Response.json(
            { ok: false, error: 'Método no permitido.' },
            { status: 405, headers: { Allow: 'POST' } }
        );
    }

    return POST(request);
}
