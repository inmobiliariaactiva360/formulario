import { upload } from '@vercel/blob/client';

const MAX_FILES = 20;
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_TOTAL_SIZE = 60 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const ALLOWED_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png']);

const form = document.getElementById('financingForm');
const fileInput = document.getElementById('documentos_archivos');
const submitButton = document.getElementById('submitButton');
const submitButtonText = document.getElementById('submitButtonText');
const submitStatus = document.getElementById('submitStatus');

function safeSegment(value, fallback = 'solicitud') {
    const normalized = String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^[._-]+|[._-]+$/g, '')
        .slice(0, 90);

    return normalized || fallback;
}

function madridTimestamp() {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Madrid',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(new Date());

    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}_${values.hour}-${values.minute}-${values.second}`;
}

function randomCode() {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function showStatus(type, message) {
    submitStatus.className = `status visible ${type}`;
    submitStatus.textContent = message;
}

function setSubmitting(isSubmitting, text = '') {
    submitButton.disabled = isSubmitting;
    submitButtonText.textContent = isSubmitting
        ? text || 'Enviando solicitud…'
        : 'Enviar Datos y Documentación para Estudio';
}

function validateFiles(files) {
    if (!files.length) {
        throw new Error('Debe adjuntar al menos un documento.');
    }

    if (files.length > MAX_FILES) {
        throw new Error(`Puede adjuntar un máximo de ${MAX_FILES} archivos.`);
    }

    let total = 0;

    files.forEach((file) => {
        const extension = file.name.split('.').pop()?.toLowerCase() || '';
        if (!ALLOWED_TYPES.has(file.type) || !ALLOWED_EXTENSIONS.has(extension)) {
            throw new Error(`El archivo “${file.name}” no es PDF, JPG o PNG.`);
        }

        if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
            throw new Error(`El archivo “${file.name}” supera el límite de 15 MB.`);
        }

        total += file.size;
    });

    if (total > MAX_TOTAL_SIZE) {
        throw new Error('El tamaño total de los documentos supera los 60 MB.');
    }
}

function collectFields() {
    const data = new FormData(form);
    data.delete('documentos_archivos');
    data.delete('documentos_archivos[]');
    return Object.fromEntries(
        Array.from(data.entries()).map(([key, value]) => [key, String(value)])
    );
}

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!form.reportValidity()) {
        return;
    }

    const files = Array.from(fileInput.files || []);

    try {
        validateFiles(files);

        const fields = collectFields();
        const clientName = safeSegment(fields.titular1_nombre, 'Sin_nombre');
        const folder = `solicitudes_financiacion/${clientName}__${madridTimestamp()}__${randomCode()}`;
        const uploadedFiles = [];

        setSubmitting(true, 'Subiendo documentación…');
        showStatus('loading', `Preparando ${files.length} archivo${files.length === 1 ? '' : 's'}…`);

        for (let index = 0; index < files.length; index += 1) {
            const file = files[index];
            const storedName = `${String(index + 1).padStart(2, '0')}_${safeSegment(file.name, `documento_${index + 1}`)}`;
            const pathname = `${folder}/documentos/${storedName}`;

            submitButtonText.textContent = `Subiendo archivo ${index + 1} de ${files.length}…`;

            const blob = await upload(pathname, file, {
                access: 'private',
                handleUploadUrl: '/api/blob-upload',
                multipart: file.size > 5 * 1024 * 1024,
                clientPayload: JSON.stringify({
                    folder,
                    originalName: file.name,
                    storedName,
                    size: file.size,
                    type: file.type,
                }),
                onUploadProgress(progress) {
                    const percentage = Math.max(0, Math.min(100, Math.round(progress.percentage || 0)));
                    showStatus(
                        'loading',
                        `Subiendo ${file.name} (${index + 1}/${files.length}): ${percentage}%`
                    );
                },
            });

            uploadedFiles.push({
                originalName: file.name,
                storedName,
                pathname: blob.pathname,
                url: blob.url,
                contentType: blob.contentType || file.type,
                size: file.size,
            });
        }

        submitButtonText.textContent = 'Guardando y enviando correo…';
        showStatus('loading', 'Documentación subida. Generando el expediente y enviando el correo…');

        const response = await fetch('/api/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folder, fields, files: uploadedFiles }),
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok || !result.ok) {
            throw new Error(result.error || 'No se pudo completar la solicitud.');
        }

        if (result.emailSent) {
            showStatus(
                'success',
                'Solicitud recibida correctamente. Los datos y documentos han sido guardados y enviados por correo.'
            );
        } else {
            showStatus(
                'warning',
                `La solicitud y los documentos se han guardado correctamente, pero el correo no pudo enviarse: ${result.emailWarning || 'revise la configuración de correo en Vercel.'}`
            );
        }

        form.reset();
        if (typeof window.updateFileLabel === 'function') {
            window.updateFileLabel();
        }
        window.scrollTo({ top: submitStatus.getBoundingClientRect().top + window.scrollY - 30, behavior: 'smooth' });
    } catch (error) {
        console.error(error);
        showStatus('error', error instanceof Error ? error.message : 'Se produjo un error inesperado.');
    } finally {
        setSubmitting(false);
    }
});
