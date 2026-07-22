<?php
declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| CONFIGURACIÓN
|--------------------------------------------------------------------------
| Cambie los correos por direcciones reales de su propio dominio.
| En muchos hostings, "from_email" debe pertenecer al mismo dominio web.
*/
return [
    'recipient_email' => 'inmobiliariaactiva360@gmail.com',
    'from_email'      => 'formularios@activainmobiliaria360.com',
    'from_name'       => 'Activa Inmobiliaria 360',

    // Carpeta donde se guardarán las solicitudes.
    // Se crea automáticamente al lado de estos archivos.
    'storage_dir'     => __DIR__ . '/solicitudes_financiacion',

    // Límites de seguridad.
    'max_files'                   => 20,
    'max_file_size_bytes'         => 15 * 1024 * 1024, // 15 MB por archivo
    'max_total_upload_bytes'      => 60 * 1024 * 1024, // 60 MB por solicitud
    'max_email_attachments_bytes' => 18 * 1024 * 1024, // Si se supera, se guarda todo pero el email va sin adjuntos

    // Active o desactive el correo. El guardado en carpeta siempre se realiza.
    'send_email' => true,
];
