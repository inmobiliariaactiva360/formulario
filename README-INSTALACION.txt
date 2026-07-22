INSTALACIÓN DEL FORMULARIO DE FINANCIACIÓN
===========================================

ARCHIVOS
--------
1. formulario-financiacion.html
2. procesar-formulario.php
3. config.php

PASOS
-----
1. Suba los tres archivos a la misma carpeta de su hosting.
2. Abra config.php y cambie:
   - recipient_email: correo donde desea recibir las solicitudes.
   - from_email: correo remitente de su propio dominio.
3. Compruebe que su hosting utiliza PHP 8.1 o superior.
4. Compruebe que PHP permite subidas con el tamaño necesario.
5. Abra formulario-financiacion.html y haga una prueba real.

QUÉ HACE
--------
Cada envío crea automáticamente una carpeta parecida a:

solicitudes_financiacion/
└── Nombre_Apellidos__2026-07-22_09-35-10__a1b2c3d4/
    ├── resultado-formulario.html
    ├── resultado-formulario.txt
    ├── datos-formulario.json
    └── documentos/
        ├── 01_nomina.pdf
        ├── 02_renta.pdf
        └── 03_dni.jpg

Además, intenta enviar por correo:
- El resultado del formulario en HTML.
- Todos los archivos adjuntos.

IMPORTANTE SOBRE EL CORREO
--------------------------
La función mail() depende de la configuración del hosting. Si la carpeta se
crea correctamente pero el correo no llega, solicite al hosting los datos SMTP
y utilice PHPMailer o el servicio SMTP del proveedor.

SEGURIDAD
---------
- Utilice siempre HTTPS.
- La carpeta se protege automáticamente con .htaccess en servidores Apache.
- En Nginx, guarde storage_dir fuera de la carpeta pública o bloquee el acceso.
- Estos documentos contienen datos personales y financieros: limite el acceso,
  configure copias de seguridad cifradas y establezca un periodo de borrado.
- Revise que su texto RGPD, base legitimadora y política de conservación hayan
  sido validados por su asesor de protección de datos.

AJUSTES PHP RECOMENDADOS
------------------------
En php.ini o en el panel del hosting:

upload_max_filesize = 20M
post_max_size = 70M
max_file_uploads = 20
max_execution_time = 120

Si su hosting permite .user.ini, puede crear uno con esos valores.
