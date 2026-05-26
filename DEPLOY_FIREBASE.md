Guía rápida para desplegar la app en Firebase Hosting (para este proyecto Vite — salida en dist)

1) Compilar la app
- En la raíz del proyecto:
  npm run build
  (Genera la carpeta dist/)

2) Instalar Firebase CLI (si no está)
- Global:
  npm install -g firebase-tools

3) Login en Firebase
- Ejecuta:
  firebase login
- Abre el navegador y autoriza.

4) Inicializar Hosting (solo la primera vez)
- Ejecuta:
  firebase init hosting
- Cuando el asistente pregunte:
  - Selecciona el proyecto Firebase existente.
  - Public directory: escribe dist
  - Configure as a single-page app (rewrite all URLs to /index.html)? → Yes
  - ¿Sobrescribir index.html? → No (elige "No" si te pregunta)

5) (Opcional) Revisar firebase.json
- Asegúrate de que contiene algo como:
  {
    "hosting": {
      "public": "dist",
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
      "rewrites": [{ "source": "**", "destination": "/index.html" }]
    }
  }

6) Desplegar a Hosting
- Ejecuta:
  firebase deploy --only hosting

7) Verificar
- Al terminar la CLI muestra la URL pública; también puedes verificar en Firebase Console → Hosting.

Consejos y fallos comunes
- Si manejas varios proyectos: firebase use --add y luego firebase use <PROJECT_ID>.
- Si la CLI da error de permisos, revisa firebase login --reauth.
- Si la carpeta build no existe, verifica el script "build" en package.json.
- Si necesitas subir sólo archivos estáticos pero tu build usa otra carpeta, usa esa carpeta en el paso de init.

Si quieres, puedo ejecutar los comandos aquí (necesitarás estar autenticado y confirmar). También puedo generar el firebase.json configurado por ti.