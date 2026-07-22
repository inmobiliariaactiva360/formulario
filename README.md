# Formulario de financiación — Activa Inmobiliaria 360

Proyecto preparado para desplegar en Vercel desde GitHub.

## Qué hace

- Recibe todos los datos del formulario.
- Sube los documentos directamente desde el navegador a Vercel Blob privado.
- Crea una carpeta lógica con nombre, fecha, hora y código aleatorio.
- Guarda dentro de esa carpeta:
  - `resultado-formulario.html`
  - `resultado-formulario.txt`
  - `datos-formulario.json`
  - carpeta `documentos/` con los adjuntos
- Envía el resultado a `inmobiliariaactiva360@gmail.com` mediante Resend.
- Adjunta los documentos al correo cuando el tamaño conjunto no supera 20 MB. Si lo supera, los conserva en Blob privado y envía el resumen sin los documentos.

## Configuración en Vercel

### 1. Importar el repositorio

En Vercel seleccione **Add New → Project**, importe el repositorio de GitHub y pulse **Deploy**. Vercel detectará Vite automáticamente.

### 2. Crear el almacenamiento privado

Dentro del proyecto:

1. Abra **Storage**.
2. Seleccione **Create Database → Blob**.
3. Elija **Private**.
4. Conecte el almacén al proyecto y a Production/Preview.

Vercel añadirá automáticamente `BLOB_READ_WRITE_TOKEN`.

### 3. Configurar el correo

Cree una cuenta en Resend, verifique el dominio `activainmobiliaria360.com` y cree una API Key.

En **Project Settings → Environment Variables**, añada:

```text
RESEND_API_KEY=re_xxxxxxxxx
EMAIL_FROM=Activa Inmobiliaria 360 <formularios@activainmobiliaria360.com>
RECIPIENT_EMAIL=inmobiliariaactiva360@gmail.com
```

Aplique las variables a Production, Preview y Development. Después haga **Redeploy**.

## Límites incluidos

- Máximo 20 archivos.
- Máximo 15 MB por archivo.
- Máximo 60 MB por solicitud.
- PDF, JPG, JPEG y PNG.

## Seguridad

Los documentos financieros se guardan en un Blob privado. No use un almacén público para esta documentación. La descarga debe realizarse desde el panel de almacenamiento de Vercel o mediante una futura zona privada autenticada.
