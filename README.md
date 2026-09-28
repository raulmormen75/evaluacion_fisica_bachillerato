# IFR | Evaluación de Física I

Aplicación: https://evaluacion-fisica-ifr.vercel.app/

Evaluación web estática del Instituto Fernando Ramírez para el tercer cuatrimestre de bachillerato. El alumno registra su nombre, responde 20 ejercicios en secuencia y obtiene calificación sobre 10, porcentaje, puntos por tema, detalle y PDF al entregar. La duración prevista es de unos 75 minutos: 14 ejercicios de resolución y seis preguntas de conceptos.

## Alcance del contenido

La fuente es `Física I.html`, ubicada en la carpeta superior. Se revisaron sus cuatro temas, explicaciones, conceptos y actividades. Esta evaluación cubre los temas 1 y 2, incluidos los procedimientos de la práctica de la Unidad 1, y el tema 3 hasta el ejercicio 5, «Una cuerda eleva una cubeta». Incluye el concepto de fricción estática ya explicado en clase. Excluye resortes, rampas, los ejercicios 6 a 10 del tema 3 y el tema 4. Las preguntas nuevas cambian los datos de los ejercicios resueltos; cada reactivo registra el localizador de origen en `questions.js`.

## Uso

Sirve como sitio estático, sin compilación. Para abrirlo localmente, inicia un servidor HTTP en esta carpeta y visita su dirección en el navegador. El escudo, la fuente Plus Jakarta Sans y el generador del PDF se sirven desde archivos locales.

El orden de temas y ejercicios se mezcla en cada intento y se guarda junto con las respuestas en el almacenamiento de ese navegador. Las opciones mantienen el orden del banco y de la guía PDF para todos los alumnos, incluidos los intentos en curso al recargar; las respuestas se conservan por su texto. El alumno no puede volver a respuestas anteriores ni iniciar otro intento antes de entregar. Se admite punto o coma decimal; las unidades aparecen junto a cada casilla y no deben escribirse dentro de ella. Los ejercicios con varias partes reciben crédito proporcional por cada parte correcta.

Las revisiones aprobadas incorporan cálculos de precisión y exactitud, conversiones de distancia, una pregunta de dos opciones sobre desplazamiento, cuatro esquemas 2D para las opciones de fricción, una gráfica de posición y tiempo, una tabla y fórmulas para los problemas de movimiento. El banco vigente contiene únicamente los primeros 20 reactivos aprobados, hasta «Cuerda y cubeta». Los intentos en curso se ajustan a ese alcance conservando las respuestas de los reactivos incluidos; los resultados ya entregados conservan su banco histórico. El grupo se fija en «Tercer cuatrimestre» sin pedirlo al alumno.

El banco vigente (versión 5) incluye el cálculo simplificado de la separación de dos personas y la redacción aprobada de la interacción entre cuerda y cubeta. Sus respuestas numéricas son exactas: se aceptan representaciones decimales equivalentes, sin ampliar el margen para aceptar valores incorrectos. La portada incorpora un ratón gris con lentes, playera blanca y short azul, generado con transparencia a partir de la pose de la mascota de la evaluación de inglés.

Todas las casillas numéricas incluyen un control «±» para escribir valores negativos aun cuando el teclado decimal del teléfono no tenga signo menos. Un signo aislado no permite avanzar. Las respuestas ya entregadas en intentos anteriores se conservan. El PDF se prepara al mostrar los resultados y se ofrece mediante un enlace directo; si falla la preparación, puede reintentarse.

Los datos y las respuestas permanecen en el navegador del alumno. No hay envío automático, cuenta docente ni protección contra la consulta del banco público de preguntas. El alumno debe descargar y entregar su PDF bajo supervisión docente. Si se borran los datos del navegador, no existe recuperación desde un servidor.

## Verificación

- `node tests/scoring.cjs`: banco, cálculos, variantes numéricas y calificación parcial.
- `node tests/pdf.cjs`: informe con respuestas correctas, incorrectas y parciales.
- `node tests/flow.cjs`: recorrido completo con Playwright, recarga, opciones fijas entre intentos, continuidad de intentos anteriores, diagramas, gráfica, fórmulas, PDF y vistas de escritorio y celular. Requiere Playwright disponible en el entorno de pruebas y Chrome instalado.
- `node tests/mixed-flow.cjs`: intento con aciertos, errores y respuestas parciales; contrasta la calificación y el detalle de pantalla con el PDF descargado. Requiere Playwright, Chrome y PyMuPDF disponibles en el entorno.
- `node tests/mobile-platforms.cjs`: WebKit con perfil iPhone y Chromium con perfil Pixel, interacción táctil, imágenes, fórmulas, 20 preguntas, signo numérico, recargas, animaciones y PDF. Usa `EXAM_URL` para elegir el sitio; requiere motores de Playwright instalados y PyMuPDF.

Las pruebas de celular se realizan con una ventana emulada de 390 × 844; no sustituyen una comprobación en un teléfono físico. La duración de 75 minutos es una estimación de diseño, pendiente de una aplicación cronometrada con alumnos. Esta evaluación no utiliza audio.

La revisión móvil adicional emplea WebKit y Chromium en Windows con perfiles de iPhone y Pixel, anchos de 320 y 375 px y orientación horizontal de 667 px. Esta emulación comprueba los motores y las interacciones del sitio; no reproduce el teclado nativo, la aplicación Archivos ni la hoja de compartir de iOS. La comprobación en Safari de un iPhone físico y Chrome de un Android físico permanece pendiente. No se certifican versiones antiguas de iOS o Android.

El sitio usa el escudo institucional y la familia tipográfica del proyecto de referencia. Los archivos de fuente conservan su licencia SIL OFL en `assets/fonts/OFL.txt`; jsPDF conserva su aviso de licencia en `vendor/jspdf.umd.min.js`.
