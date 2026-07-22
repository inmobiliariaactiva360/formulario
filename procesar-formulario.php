<?php
declare(strict_types=1);

date_default_timezone_set('Europe/Madrid');

$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    http_response_code(500);
    exit('Falta el archivo config.php.');
}

$config = require $configFile;

function respondPage(string $title, string $message, bool $success, int $statusCode = 200): never
{
    http_response_code($statusCode);
    $safeTitle = htmlspecialchars($title, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $safeMessage = nl2br(htmlspecialchars($message, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'));
    $accent = $success ? '#16803c' : '#b42318';
    $button = $success ? 'Enviar otra solicitud' : 'Volver al formulario';

    echo '<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>' . $safeTitle . '</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#f4f6f9;font-family:Arial,sans-serif;color:#283344}
.card{width:min(620px,100%);padding:38px;background:#fff;border:1px solid #dce2ea;border-radius:20px;box-shadow:0 18px 50px rgba(23,32,51,.12);text-align:center}
.icon{width:64px;height:64px;margin:0 auto 20px;display:grid;place-items:center;border-radius:50%;background:' . $accent . ';color:#fff;font-size:32px;font-weight:800}
h1{margin:0 0 14px;color:#172033;font-size:30px}
p{margin:0;line-height:1.7;color:#526075}
a{display:inline-block;margin-top:25px;padding:14px 22px;border-radius:10px;background:linear-gradient(135deg,#d8b74b,#efcf68);color:#172033;text-decoration:none;font-weight:800}
</style>
</head>
<body>
<div class="card">
<div class="icon">' . ($success ? '✓' : '!') . '</div>
<h1>' . $safeTitle . '</h1>
<p>' . $safeMessage . '</p>
<a href="formulario-financiacion.html">' . $button . '</a>
</div>
</body>
</html>';
    exit;
}

function cleanText(mixed $value): string
{
    if (!is_string($value)) {
        return '';
    }

    $value = trim($value);
    $value = str_replace(["\0", "\r"], '', $value);

    return mb_substr($value, 0, 5000, 'UTF-8');
}

function safeName(string $value, string $fallback = 'solicitud'): string
{
    $value = trim($value);

    if (function_exists('iconv')) {
        $converted = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
        if ($converted !== false) {
            $value = $converted;
        }
    }

    $value = preg_replace('/[^A-Za-z0-9._-]+/', '_', $value) ?? '';
    $value = trim($value, '._-');
    $value = preg_replace('/_+/', '_', $value) ?? '';

    return $value !== '' ? mb_substr($value, 0, 90, 'UTF-8') : $fallback;
}

function normalizeUploads(array $files): array
{
    if (!isset($files['name'], $files['tmp_name'], $files['error'], $files['size'])) {
        return [];
    }

    if (!is_array($files['name'])) {
        return [[
            'name'     => (string) $files['name'],
            'tmp_name' => (string) $files['tmp_name'],
            'error'    => (int) $files['error'],
            'size'     => (int) $files['size'],
        ]];
    }

    $normalized = [];
    foreach ($files['name'] as $index => $name) {
        $normalized[] = [
            'name'     => (string) $name,
            'tmp_name' => (string) ($files['tmp_name'][$index] ?? ''),
            'error'    => (int) ($files['error'][$index] ?? UPLOAD_ERR_NO_FILE),
            'size'     => (int) ($files['size'][$index] ?? 0),
        ];
    }

    return $normalized;
}

function formatMoney(string $value): string
{
    if ($value === '' || !is_numeric(str_replace(',', '.', $value))) {
        return $value;
    }

    return number_format((float) str_replace(',', '.', $value), 2, ',', '.') . ' €';
}

function buildSummaryHtml(array $data, array $labels, array $savedFiles, string $receivedAt): string
{
    $rows = '';
    foreach ($labels as $field => $label) {
        $value = $data[$field] ?? '';

        if (in_array($field, ['titular1_ingresos', 'titular2_ingresos', 'ahorros_disponibles', 'otros_prestamos'], true)) {
            $value = formatMoney($value);
        }

        if ($value === '') {
            $value = 'No indicado';
        }

        $rows .= '<tr>
            <th style="padding:10px;border:1px solid #dce2ea;text-align:left;background:#f4f6f9;width:38%;">'
            . htmlspecialchars($label, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') .
            '</th>
            <td style="padding:10px;border:1px solid #dce2ea;">'
            . nl2br(htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')) .
            '</td>
        </tr>';
    }

    $filesList = '';
    foreach ($savedFiles as $file) {
        $filesList .= '<li>' . htmlspecialchars($file['stored_name'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
            . ' — original: ' . htmlspecialchars($file['original_name'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
            . '</li>';
    }

    return '<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Solicitud de financiación</title>
</head>
<body style="font-family:Arial,sans-serif;color:#283344;line-height:1.5;">
<h1 style="color:#172033;">Solicitud de estudio de financiación</h1>
<p><strong>Fecha de recepción:</strong> ' . htmlspecialchars($receivedAt, ENT_QUOTES, 'UTF-8') . '</p>
<table style="border-collapse:collapse;width:100%;max-width:900px;">' . $rows . '</table>
<h2 style="color:#172033;">Documentación recibida</h2>
<ul>' . $filesList . '</ul>
</body>
</html>';
}

function buildSummaryText(array $data, array $labels, array $savedFiles, string $receivedAt): string
{
    $lines = [
        'SOLICITUD DE ESTUDIO DE FINANCIACIÓN',
        'Fecha de recepción: ' . $receivedAt,
        str_repeat('=', 65),
    ];

    foreach ($labels as $field => $label) {
        $value = $data[$field] ?? '';
        if (in_array($field, ['titular1_ingresos', 'titular2_ingresos', 'ahorros_disponibles', 'otros_prestamos'], true)) {
            $value = formatMoney($value);
        }
        $lines[] = $label . ': ' . ($value !== '' ? $value : 'No indicado');
    }

    $lines[] = '';
    $lines[] = 'DOCUMENTACIÓN RECIBIDA';
    $lines[] = str_repeat('-', 65);

    foreach ($savedFiles as $file) {
        $lines[] = '- ' . $file['stored_name'] . ' (original: ' . $file['original_name'] . ')';
    }

    return implode(PHP_EOL, $lines) . PHP_EOL;
}

function addAttachmentPart(string &$body, string $boundary, string $filePath, string $displayName, string $mimeType): void
{
    $content = file_get_contents($filePath);
    if ($content === false) {
        throw new RuntimeException('No se pudo leer un archivo para adjuntarlo al correo.');
    }

    $safeDisplayName = str_replace(['"', "\r", "\n"], ['', '', ''], $displayName);

    $body .= '--' . $boundary . "\r\n";
    $body .= 'Content-Type: ' . $mimeType . '; name="' . $safeDisplayName . '"' . "\r\n";
    $body .= 'Content-Transfer-Encoding: base64' . "\r\n";
    $body .= 'Content-Disposition: attachment; filename="' . $safeDisplayName . '"' . "\r\n\r\n";
    $body .= chunk_split(base64_encode($content)) . "\r\n";
}

function sendSubmissionEmail(
    array $config,
    array $data,
    string $folderName,
    string $summaryHtmlPath,
    array $savedFiles,
    int $attachmentBytes
): bool {
    if (empty($config['send_email'])) {
        return true;
    }

    $to = filter_var((string) ($config['recipient_email'] ?? ''), FILTER_VALIDATE_EMAIL);
    $from = filter_var((string) ($config['from_email'] ?? ''), FILTER_VALIDATE_EMAIL);
    $replyTo = filter_var((string) ($data['email'] ?? ''), FILTER_VALIDATE_EMAIL);

    if (!$to || !$from) {
        throw new RuntimeException('Configure recipient_email y from_email correctamente en config.php.');
    }

    $clientName = $data['titular1_nombre'] ?: 'Sin nombre';
    $subjectText = 'Nueva solicitud de financiación - ' . $clientName;
    $encodedSubject = '=?UTF-8?B?' . base64_encode($subjectText) . '?=';

    $boundary = '=_Activa_' . bin2hex(random_bytes(12));
    $fromName = str_replace(["\r", "\n"], '', (string) ($config['from_name'] ?? 'Formulario web'));

    $headers = [];
    $headers[] = 'MIME-Version: 1.0';
    $headers[] = 'From: ' . $fromName . ' <' . $from . '>';
    if ($replyTo) {
        $headers[] = 'Reply-To: ' . $replyTo;
    }
    $headers[] = 'Content-Type: multipart/mixed; boundary="' . $boundary . '"';

    $attachFiles = $attachmentBytes <= (int) ($config['max_email_attachments_bytes'] ?? 0);

    $plainMessage = "Se ha recibido una nueva solicitud de financiación.\n\n";
    $plainMessage .= "Titular principal: " . $clientName . "\n";
    $plainMessage .= "Teléfono: " . ($data['telefono'] ?: 'No indicado') . "\n";
    $plainMessage .= "Email: " . ($data['email'] ?: 'No indicado') . "\n";
    $plainMessage .= "Promoción: " . ($data['promocion'] ?: 'No indicada') . "\n";
    $plainMessage .= "Carpeta guardada: " . $folderName . "\n\n";

    if ($attachFiles) {
        $plainMessage .= "El resumen y los documentos se adjuntan a este correo.";
    } else {
        $plainMessage .= "Los archivos se han guardado correctamente, pero no se adjuntan porque superan el límite configurado para el correo.";
    }

    $body = '--' . $boundary . "\r\n";
    $body .= 'Content-Type: text/plain; charset=UTF-8' . "\r\n";
    $body .= 'Content-Transfer-Encoding: 8bit' . "\r\n\r\n";
    $body .= $plainMessage . "\r\n\r\n";

    if ($attachFiles) {
        addAttachmentPart($body, $boundary, $summaryHtmlPath, 'resultado-formulario.html', 'text/html');

        foreach ($savedFiles as $file) {
            addAttachmentPart(
                $body,
                $boundary,
                $file['absolute_path'],
                $file['stored_name'],
                $file['mime_type']
            );
        }
    }

    $body .= '--' . $boundary . '--' . "\r\n";

    return mail($to, $encodedSubject, $body, implode("\r\n", $headers));
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respondPage(
        'Acceso no permitido',
        'Esta página solo procesa formularios enviados mediante POST.',
        false,
        405
    );
}

$labels = [
    'promocion'                    => 'Inmueble / Promoción de interés',
    'titular1_nombre'              => 'Titular 1 - Nombre y apellidos',
    'titular1_dni'                 => 'Titular 1 - DNI / NIE',
    'titular1_fecha_nacimiento'    => 'Titular 1 - Fecha de nacimiento',
    'titular1_nacionalidad'        => 'Titular 1 - Nacionalidad',
    'titular1_estado_civil'        => 'Titular 1 - Estado civil',
    'titular1_profesion'           => 'Titular 1 - Profesión / Ocupación',
    'titular1_tipo_contrato'       => 'Titular 1 - Tipo de contrato',
    'titular1_antiguedad_laboral'  => 'Titular 1 - Antigüedad laboral',
    'titular1_ingresos'            => 'Titular 1 - Ingresos netos mensuales',
    'titular2_nombre'              => 'Titular 2 - Nombre y apellidos',
    'titular2_dni'                 => 'Titular 2 - DNI / NIE',
    'titular2_fecha_nacimiento'    => 'Titular 2 - Fecha de nacimiento',
    'titular2_nacionalidad'        => 'Titular 2 - Nacionalidad',
    'titular2_estado_civil'        => 'Titular 2 - Estado civil',
    'titular2_profesion'           => 'Titular 2 - Profesión / Ocupación',
    'titular2_tipo_contrato'       => 'Titular 2 - Tipo de contrato',
    'titular2_antiguedad_laboral'  => 'Titular 2 - Antigüedad laboral',
    'titular2_ingresos'            => 'Titular 2 - Ingresos netos mensuales',
    'telefono'                     => 'Teléfono de contacto',
    'email'                        => 'Email de contacto',
    'ahorros_disponibles'          => 'Ahorros propios disponibles',
    'otros_prestamos'              => 'Pago mensual de otros préstamos',
    'otras_propiedades'            => 'Otras propiedades y cargas',
    'consentimiento_rgpd'          => 'Consentimiento RGPD',
];

$data = [];
foreach ($labels as $field => $label) {
    $data[$field] = cleanText($_POST[$field] ?? '');
}

$requiredFields = [
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

$missing = [];
foreach ($requiredFields as $field) {
    if ($data[$field] === '') {
        $missing[] = $labels[$field] ?? $field;
    }
}

if ($missing !== []) {
    respondPage(
        'Faltan datos obligatorios',
        "Revise estos campos:\n- " . implode("\n- ", $missing),
        false,
        422
    );
}

if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
    respondPage('Email no válido', 'Introduzca una dirección de correo válida.', false, 422);
}

$uploads = normalizeUploads($_FILES['documentos_archivos'] ?? []);
$uploads = array_values(array_filter(
    $uploads,
    static fn(array $file): bool => $file['error'] !== UPLOAD_ERR_NO_FILE
));

if ($uploads === []) {
    respondPage('Faltan los documentos', 'Debe adjuntar al menos un archivo PDF, JPG o PNG.', false, 422);
}

if (count($uploads) > (int) $config['max_files']) {
    respondPage(
        'Demasiados archivos',
        'Puede adjuntar un máximo de ' . (int) $config['max_files'] . ' archivos.',
        false,
        413
    );
}

$totalUploadBytes = array_sum(array_column($uploads, 'size'));
if ($totalUploadBytes > (int) $config['max_total_upload_bytes']) {
    respondPage('Archivos demasiado grandes', 'El tamaño total de los archivos supera el límite permitido.', false, 413);
}

$storageDir = (string) $config['storage_dir'];
if (!is_dir($storageDir) && !mkdir($storageDir, 0750, true) && !is_dir($storageDir)) {
    error_log('No se pudo crear el directorio de almacenamiento: ' . $storageDir);
    respondPage('Error del servidor', 'No se pudo crear la carpeta de almacenamiento.', false, 500);
}

// Protección para Apache. En Nginx conviene guardar esta carpeta fuera de public_html.
$htaccessPath = $storageDir . DIRECTORY_SEPARATOR . '.htaccess';
if (!is_file($htaccessPath)) {
    @file_put_contents(
        $htaccessPath,
        "Options -Indexes\n<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n"
    );
}

$receivedAt = date('d/m/Y H:i:s');
$folderName = safeName($data['titular1_nombre'], 'solicitud')
    . '__' . date('Y-m-d_H-i-s')
    . '__' . bin2hex(random_bytes(4));

$requestDir = $storageDir . DIRECTORY_SEPARATOR . $folderName;
$documentsDir = $requestDir . DIRECTORY_SEPARATOR . 'documentos';

if (!mkdir($documentsDir, 0750, true) && !is_dir($documentsDir)) {
    error_log('No se pudo crear la carpeta de solicitud: ' . $requestDir);
    respondPage('Error del servidor', 'No se pudo crear la carpeta de esta solicitud.', false, 500);
}

$allowedMimeTypes = [
    'application/pdf' => 'pdf',
    'image/jpeg'      => 'jpg',
    'image/png'       => 'png',
];

$finfo = new finfo(FILEINFO_MIME_TYPE);
$savedFiles = [];

try {
    foreach ($uploads as $index => $upload) {
        if ($upload['error'] !== UPLOAD_ERR_OK) {
            throw new RuntimeException('Uno de los archivos no pudo subirse. Código: ' . $upload['error']);
        }

        if ($upload['size'] <= 0 || $upload['size'] > (int) $config['max_file_size_bytes']) {
            throw new RuntimeException('El archivo "' . $upload['name'] . '" supera el límite permitido o está vacío.');
        }

        if (!is_uploaded_file($upload['tmp_name'])) {
            throw new RuntimeException('Se detectó un archivo no válido.');
        }

        $mimeType = $finfo->file($upload['tmp_name']);
        if (!is_string($mimeType) || !isset($allowedMimeTypes[$mimeType])) {
            throw new RuntimeException('Formato no permitido en "' . $upload['name'] . '". Solo PDF, JPG y PNG.');
        }

        $extension = $allowedMimeTypes[$mimeType];
        $originalBase = pathinfo($upload['name'], PATHINFO_FILENAME);
        $storedName = sprintf(
            '%02d_%s.%s',
            $index + 1,
            safeName($originalBase, 'documento'),
            $extension
        );

        $destination = $documentsDir . DIRECTORY_SEPARATOR . $storedName;
        $counter = 2;

        while (is_file($destination)) {
            $storedName = sprintf(
                '%02d_%s_%d.%s',
                $index + 1,
                safeName($originalBase, 'documento'),
                $counter,
                $extension
            );
            $destination = $documentsDir . DIRECTORY_SEPARATOR . $storedName;
            $counter++;
        }

        if (!move_uploaded_file($upload['tmp_name'], $destination)) {
            throw new RuntimeException('No se pudo guardar el archivo "' . $upload['name'] . '".');
        }

        @chmod($destination, 0640);

        $savedFiles[] = [
            'original_name' => $upload['name'],
            'stored_name'   => $storedName,
            'mime_type'     => $mimeType,
            'size_bytes'    => $upload['size'],
            'absolute_path' => $destination,
            'relative_path' => 'documentos/' . $storedName,
        ];
    }

    $summaryHtml = buildSummaryHtml($data, $labels, $savedFiles, $receivedAt);
    $summaryText = buildSummaryText($data, $labels, $savedFiles, $receivedAt);

    $summaryHtmlPath = $requestDir . DIRECTORY_SEPARATOR . 'resultado-formulario.html';
    $summaryTextPath = $requestDir . DIRECTORY_SEPARATOR . 'resultado-formulario.txt';
    $jsonPath = $requestDir . DIRECTORY_SEPARATOR . 'datos-formulario.json';

    if (file_put_contents($summaryHtmlPath, $summaryHtml, LOCK_EX) === false) {
        throw new RuntimeException('No se pudo crear el resumen HTML.');
    }

    if (file_put_contents($summaryTextPath, $summaryText, LOCK_EX) === false) {
        throw new RuntimeException('No se pudo crear el resumen de texto.');
    }

    $jsonData = [
        'fecha_recepcion' => $receivedAt,
        'carpeta'         => $folderName,
        'datos'           => $data,
        'archivos'        => array_map(
            static fn(array $file): array => [
                'nombre_original' => $file['original_name'],
                'nombre_guardado' => $file['stored_name'],
                'ruta_relativa'   => $file['relative_path'],
                'tipo_mime'       => $file['mime_type'],
                'tamano_bytes'    => $file['size_bytes'],
            ],
            $savedFiles
        ),
    ];

    $json = json_encode($jsonData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false || file_put_contents($jsonPath, $json, LOCK_EX) === false) {
        throw new RuntimeException('No se pudo crear el archivo JSON.');
    }

    @chmod($summaryHtmlPath, 0640);
    @chmod($summaryTextPath, 0640);
    @chmod($jsonPath, 0640);

    $attachmentBytes = (int) filesize($summaryHtmlPath);
    foreach ($savedFiles as $file) {
        $attachmentBytes += (int) $file['size_bytes'];
    }

    $emailSent = sendSubmissionEmail(
        $config,
        $data,
        $folderName,
        $summaryHtmlPath,
        $savedFiles,
        $attachmentBytes
    );

    if (!$emailSent && !empty($config['send_email'])) {
        error_log('La solicitud se guardó, pero mail() devolvió false. Carpeta: ' . $folderName);
        respondPage(
            'Solicitud guardada',
            "Los datos y documentos se han guardado correctamente.\n"
            . "Sin embargo, el servidor no pudo enviar el correo. Revise la configuración de correo del hosting.\n"
            . "Referencia: " . $folderName,
            true,
            200
        );
    }

    respondPage(
        'Solicitud enviada correctamente',
        "Hemos recibido los datos y la documentación.\nReferencia: " . $folderName,
        true,
        200
    );
} catch (Throwable $exception) {
    error_log('Error procesando solicitud: ' . $exception->getMessage());

    @file_put_contents(
        $requestDir . DIRECTORY_SEPARATOR . 'ERROR.txt',
        date('c') . ' - ' . $exception->getMessage() . PHP_EOL,
        FILE_APPEND | LOCK_EX
    );

    respondPage(
        'No se pudo completar el envío',
        'La solicitud no se procesó correctamente. Revise los archivos e inténtelo de nuevo.',
        false,
        500
    );
}
