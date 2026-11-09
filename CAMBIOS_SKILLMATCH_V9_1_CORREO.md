# SkillMatch V9.1 · Preparación de integración de correo

Esta versión prepara el módulo de Estadías para correo real sin obligar a activar el envío durante las pruebas.

## Arquitectura
- Cola existente: `eventos_notificacion_estadia`.
- Proveedores soportados: `disabled`, `resend`, `gmail`, `smtp`.
- Resolución automática de destinatarios simbólicos: alumno, asesor, empresa, servicios_escolares, biblioteca, laboratorios, centro_idiomas, vinculacion y direccion.
- El modal "Enviar por correo" consulta el estado del backend y muestra si el proveedor está configurado.
- Con proveedor desactivado, el correo se conserva en cola.
- Con proveedor configurado, el mismo botón puede enviar en el momento.
- Súper administrador dispone de endpoint para procesar correos pendientes.

## Variables Render
```
MAIL_PROVIDER=disabled
MAIL_FROM=SkillMatch UTEQ <no-reply@dominio.edu.mx>
APP_URL=https://skill-match-web.vercel.app
```

### Resend
```
MAIL_PROVIDER=resend
RESEND_API_KEY=...
MAIL_FROM=SkillMatch UTEQ <no-reply@dominio-verificado.mx>
```

### Gmail API
```
MAIL_PROVIDER=gmail
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
GOOGLE_MAIL=cuenta@dominio.mx
MAIL_FROM=cuenta@dominio.mx
```

### SMTP
```
MAIL_PROVIDER=smtp
SMTP_HOST=smtp.dominio.mx
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
MAIL_FROM=SkillMatch UTEQ <cuenta@dominio.mx>
```

## Endpoints
- `GET /api/estadias/correo/configuracion`
- `POST /api/estadias/estadias/:idEstadia/preparar-correo`
- `POST /api/estadias/correo/eventos/:idEvento/enviar`
- `POST /api/estadias/correo/procesar-pendientes` (sólo súper administrador)

## Nota
No requiere migración nueva: reutiliza `eventos_notificacion_estadia` de la migración 22.
