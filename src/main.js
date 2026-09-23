const MAX_FILES = 20;
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_TOTAL_SIZE = 60 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const ALLOWED_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png']);

const form = document.getElementById('financingForm');
const fileInput = document.getElementById('documentos_archivos');
const fileUploadLabel = document.getElementById('fileUploadLabel');
const fileUploadTitle = document.getElementById('fileUploadTitle');
const selectedFilesContainer = document.getElementById('selectedFiles');
const submitButton = document.getElementById('submitButton');
const submitButtonText = document.getElementById('submitButtonText');
const submitStatus = document.getElementById('submitStatus');

let selectedFiles = [];

const FIELD_LABELS = {
    titular1_nombre: 'Nombre y Apellidos del titular principal',
    titular1_dni: 'DNI / NIE del titular principal',
    titular1_fecha_nacimiento: 'Fecha de Nacimiento del titular principal',
    titular1_nacionalidad: 'Nacionalidad del titular principal',
    titular1_estado_civil: 'Estado Civil del titular principal',
    titular1_profesion: 'Profesión / Ocupación del titular principal',
    titular1_tipo_contrato: 'Tipo de Contrato del titular principal',
    titular1_antiguedad_laboral: 'Antigüedad Laboral del titular principal',
    titular1_ingresos: 'Ingresos Netos Mensuales del titular principal',
    telefono: 'Teléfono de Contacto Principal',
    email: 'Email de Contacto Principal',
    ahorros_disponibles: 'Ahorros Propios Disponibles',
    consentimiento_rgpd: 'Consentimiento para el tratamiento de datos',
};

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

function clearStatus() {
    submitStatus.className = 'status';
    submitStatus.textContent = '';
}

function setSubmitting(isSubmitting, text = '') {
    submitButton.disabled = isSubmitting;
    submitButtonText.textContent = isSubmitting
        ? text || 'Enviando solicitud…'
        : 'Enviar Datos y Documentación para Estudio';
}

function getFieldLabel(field) {
    if (FIELD_LABELS[field.name]) {
        return FIELD_LABELS[field.name];
    }

    if (field.id) {
        const explicitLabel = form.querySelector(`label[for="${CSS.escape(field.id)}"]`);
        if (explicitLabel) {
            return explicitLabel.textContent.replace('*', '').trim();
        }
    }

    const nearbyLabel = field.closest('.group, .form-group, .check, .checkbox-group')?.querySelector('label');
    return nearbyLabel?.textContent.replace('*', '').trim() || 'un campo obligatorio';
}

function clearInvalidField(field) {
    field.removeAttribute('aria-invalid');
    field.style.removeProperty('border-color');
    field.style.removeProperty('box-shadow');
}

function markInvalidField(field) {
    field.setAttribute('aria-invalid', 'true');
    field.style.borderColor = '#b42318';
    field.style.boxShadow = '0 0 0 4px rgba(180, 35, 24, 0.12)';
}

function focusInvalidField(field) {
    field.scrollIntoView({ behavior: 'smooth', block: 'center' });

    window.setTimeout(() => {
        try {
            field.focus({ preventScroll: true });
        } catch {
            field.focus();
        }

        if (typeof field.reportValidity === 'function') {
            field.reportValidity();
        }
    }, 450);
}

function validateRequiredFields() {
    const fields = Array.from(form.querySelectorAll('input, select, textarea'))
        .filter((field) => field !== fileInput && !field.disabled);

    fields.forEach(clearInvalidField);

    const firstInvalidField = fields.find((field) => !field.checkValidity());
    if (!firstInvalidField) {
        return true;
    }

    const label = getFieldLabel(firstInvalidField);
    markInvalidField(firstInvalidField);
    showStatus('error', `Falta completar un campo obligatorio: ${label}.`);
    focusInvalidField(firstInvalidField);
    return false;
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

function fileKey(file) {
    return [file.name, file.size, file.lastModified].join('::');
}

function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) {
        return '0 KB';
    }

    if (bytes < 1024 * 1024) {
        return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    })[character]);
}

function renderSelectedFiles() {
    const totalBytes = selectedFiles.reduce((sum, file) => sum + file.size, 0);
    const count = selectedFiles.length;

    fileUploadTitle.textContent = count
        ? `${count} archivo${count === 1 ? '' : 's'} preparado${count === 1 ? '' : 's'}`
        : 'Haga clic aquí para seleccionar los archivos';

    if (!count) {
        selectedFilesContainer.innerHTML = '';
        selectedFilesContainer.classList.remove('visible');
        return;
    }

    const rows = selectedFiles.map((file, index) => `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0;${index ? 'border-top:1px solid #dce2ea;' : ''}">
            <span style="min-width:0;overflow-wrap:anywhere;">
                <strong>${escapeHtml(file.name)}</strong><br>
                <span style="color:#687386;">${formatBytes(file.size)}</span>
            </span>
            <button
                type="button"
                data-remove-file="${index}"
                aria-label="Quitar ${escapeHtml(file.name)}"
                style="flex:0 0 auto;border:1px solid #dce2ea;border-radius:9px;background:#fff;color:#b42318;padding:7px 10px;font:inherit;font-size:12px;font-weight:700;cursor:pointer;"
            >Quitar</button>
        </div>
    `).join('');

    selectedFilesContainer.innerHTML = `
        <div style="margin-bottom:10px;">
            <strong>${count} de ${MAX_FILES} documentos · ${formatBytes(totalBytes)} de 60 MB</strong><br>
            <span style="color:#687386;">Puede pulsar otra vez en el recuadro para añadir más documentos.</span>
        </div>
        ${rows}
    `;
    selectedFilesContainer.classList.add('visible');
}

function addFiles(files) {
    if (!files.length) {
        return;
    }

    const knownKeys = new Set(selectedFiles.map(fileKey));
    const uniqueNewFiles = files.filter((file) => !knownKeys.has(fileKey(file)));

    if (!uniqueNewFiles.length) {
        showStatus('warning', 'Esos documentos ya estaban añadidos.');
        renderSelectedFiles();
        return;
    }

    const candidateFiles = [...selectedFiles, ...uniqueNewFiles];
    validateFiles(candidateFiles);
    selectedFiles = candidateFiles;
    clearStatus();
    renderSelectedFiles();
}

function removeFile(index) {
    if (!Number.isInteger(index) || index < 0 || index >= selectedFiles.length) {
        return;
    }

    selectedFiles.splice(index, 1);
    clearStatus();
    renderSelectedFiles();
}

function collectFields() {
    const data = new FormData(form);
    data.delete('documentos_archivos');
    data.delete('documentos_archivos[]');
    return Object.fromEntries(
        Array.from(data.entries()).map(([key, value]) => [key, String(value)])
    );
}

async function fetchWithTimeout(url, options, timeoutMs, timeoutMessage) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw new Error(timeoutMessage);
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

async function requestPresignedUpload(pathname, file) {
    const response = await fetchWithTimeout(
        '/api/presign-upload',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pathname,
                contentType: file.type,
                size: file.size,
            }),
        },
        20000,
        'El servidor tardó demasiado en autorizar la subida del documento.'
    );

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok || !result.presignedUrl) {
        throw new Error(result.error || `No se pudo autorizar la subida (${response.status}).`);
    }

    return result.presignedUrl;
}

function uploadToPresignedUrl(presignedUrl, file, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', presignedUrl, true);
        xhr.timeout = 90000;
        xhr.setRequestHeader('Content-Type', file.type);

        xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable && typeof onProgress === 'function') {
                onProgress(Math.round((event.loaded / event.total) * 100));
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                let metadata = {};
                try {
                    metadata = JSON.parse(xhr.responseText || '{}');
                } catch {
                    metadata = {};
                }
                resolve(metadata);
                return;
            }

            let details = '';
            try {
                const parsed = JSON.parse(xhr.responseText || '{}');
                details = parsed.error || parsed.message || '';
            } catch {
                details = xhr.responseText || '';
            }

            reject(new Error(details || `Vercel Blob rechazó el archivo con el error ${xhr.status}.`));
        });

        xhr.addEventListener('timeout', () => {
            reject(new Error(`La subida de “${file.name}” tardó demasiado y fue cancelada.`));
        });

        xhr.addEventListener('error', () => {
            reject(new Error(`No se pudo conectar con Vercel Blob para subir “${file.name}”.`));
        });

        xhr.send(file);
    });
}

async function verifyUploadedFile(pathname, file) {
    const response = await fetchWithTimeout(
        '/api/verify-upload',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pathname,
                contentType: file.type,
                size: file.size,
            }),
        },
        15000,
        `Vercel tardó demasiado en confirmar la subida de “${file.name}”.`
    );

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
        throw new Error(result.error || `No se pudo verificar la subida (${response.status}).`);
    }

    return result;
}

async function postSolicitud(payload) {
    return fetchWithTimeout(
        '/api/submit',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        },
        70000,
        'El servidor tardó demasiado en responder. La solicitud puede haberse guardado; revise Vercel Blob antes de volver a enviarla.'
    );
}

fileInput.required = false;

form.addEventListener('input', (event) => {
    if (event.target instanceof HTMLElement) {
        clearInvalidField(event.target);
    }
});

form.addEventListener('change', (event) => {
    if (event.target instanceof HTMLElement) {
        clearInvalidField(event.target);
    }
});

fileInput.addEventListener('change', () => {
    try {
        addFiles(Array.from(fileInput.files || []));
    } catch (error) {
        showStatus('error', error instanceof Error ? error.message : 'No se pudieron añadir los documentos.');
        renderSelectedFiles();
    } finally {
        fileInput.value = '';
    }
});

selectedFilesContainer.addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-file]');
    if (!button) {
        return;
    }

    removeFile(Number(button.dataset.removeFile));
});

fileUploadLabel.addEventListener('drop', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    fileUploadLabel.classList.remove('drag');

    try {
        addFiles(Array.from(event.dataTransfer?.files || []));
    } catch (error) {
        showStatus('error', error instanceof Error ? error.message : 'No se pudieron añadir los documentos.');
        renderSelectedFiles();
    }
}, true);

window.updateFileLabel = renderSelectedFiles;
renderSelectedFiles();

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!validateRequiredFields()) {
        return;
    }

    const files = selectedFiles.slice();

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

            submitButtonText.textContent = `Autorizando archivo ${index + 1} de ${files.length}…`;
            showStatus('loading', `Autorizando la subida de ${file.name}…`);

            const presignedUrl = await requestPresignedUpload(pathname, file);

            submitButtonText.textContent = `Subiendo archivo ${index + 1} de ${files.length}…`;
            const uploadMetadata = await uploadToPresignedUrl(presignedUrl, file, (percentage) => {
                showStatus(
                    'loading',
                    `Subiendo ${file.name} (${index + 1}/${files.length}): ${percentage}%`
                );
            });

            const uploadedPathname = uploadMetadata?.pathname || pathname;
            submitButtonText.textContent = `Verificando archivo ${index + 1} de ${files.length}…`;
            showStatus('loading', `Verificando que ${file.name} se ha guardado correctamente…`);

            const verifiedFile = await verifyUploadedFile(uploadedPathname, file);

            uploadedFiles.push({
                originalName: file.name,
                storedName,
                pathname: verifiedFile.pathname,
                contentType: verifiedFile.contentType,
                size: verifiedFile.size,
            });
        }

        submitButtonText.textContent = 'Guardando y enviando correo…';
        showStatus('loading', 'Documentación subida y verificada. Generando el expediente y enviando el correo…');

        const response = await postSolicitud({ folder, fields, files: uploadedFiles });
        const result = await response.json().catch(() => ({}));

        if (!response.ok || !result.ok) {
            throw new Error(result.error || `El servidor respondió con el error ${response.status}.`);
        }

        if (result.emailSent) {
            showStatus(
                'success',
                'Solicitud recibida correctamente. Los datos y documentos han sido guardados y enviados a inmobiliariaactiva360@gmail.com.'
            );
        } else {
            showStatus(
                'warning',
                `La solicitud y los documentos se han guardado correctamente, pero el correo no pudo enviarse: ${result.emailWarning || 'revise la configuración de correo en Vercel y Resend.'}`
            );
        }

        form.reset();
        selectedFiles = [];
        fileInput.value = '';
        renderSelectedFiles();
        window.scrollTo({
            top: submitStatus.getBoundingClientRect().top + window.scrollY - 30,
            behavior: 'smooth',
        });
    } catch (error) {
        console.error(error);
        showStatus('error', error instanceof Error ? error.message : 'Se produjo un error inesperado.');

        if (!selectedFiles.length) {
            fileUploadLabel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    } finally {
        setSubmitting(false);
    }
});
