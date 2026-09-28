# IFR | Evaluación de Física I

Evaluación web estática del Instituto Fernando Ramírez para el tercer cuatrimestre de bachillerato. El alumno registra nombre y grupo, responde 27 ejercicios en secuencia y obtiene calificación sobre 10, porcentaje, puntos por tema, detalle y PDF al entregar. La duración prevista es de unos 75 minutos: 18 problemas de varios pasos y nueve preguntas de conceptos.

## Alcance del contenido

La fuente es `Física I.html`, ubicada en la carpeta superior. Se revisaron sus cuatro temas, explicaciones, conceptos y actividades. Esta evaluación cubre los temas 1 y 2, incluidos los procedimientos de la práctica de la Unidad 1, y el tema 3 hasta el ejercicio 5, «Una cuerda eleva una cubeta». Incluye el concepto de fricción estática ya explicado en clase. Excluye resortes, rampas, los ejercicios 6 a 10 del tema 3 y el tema 4. Las preguntas nuevas cambian los datos de los ejercicios resueltos; cada reactivo registra el localizador de origen en `questions.js`.

## Uso

Sirve como sitio estático, sin compilación. Para abrirlo localmente, inicia un servidor HTTP en esta carpeta y visita su dirección en el navegador. El escudo, la fuente Plus Jakarta Sans y el generador del PDF se sirven desde archivos locales.

El orden de temas, ejercicios y opciones se mezcla en cada intento y se guarda junto con las respuestas en el almacenamiento de ese navegador. El alumno no puede volver a respuestas anteriores ni iniciar otro intento antes de entregar. Se admite punto o coma decimal; las unidades aparecen junto a cada casilla y no deben escribirse dentro de ella. Los ejercicios con varias partes reciben crédito proporcional por cada parte correcta.

La revisión del primer bloque incorpora cálculos de precisión y exactitud, conversiones de distancia, una pregunta de dos opciones sobre desplazamiento y cuatro esquemas 2D para las opciones de fricción. Los intentos iniciados antes de esta revisión conservan sus preguntas y respuestas originales hasta terminar; los intentos nuevos usan el banco revisado.

Los datos y las respuestas permanecen en el navegador del alumno. No hay envío automático, cuenta docente ni protección contra la consulta del banco público de preguntas. El alumno debe descargar y entregar su PDF bajo supervisión docente. Si se borran los datos del navegador, no existe recuperación desde un servidor.

## Verificación

- `node tests/scoring.cjs`: banco, cálculos, variantes numéricas y calificación parcial.
- `node tests/pdf.cjs`: informe con respuestas correctas, incorrectas y parciales.
- `node tests/flow.cjs`: recorrido completo con Playwright, recarga, mezcla de opciones, continuidad de intentos anteriores, diagramas, PDF y vistas de escritorio y celular. Requiere Playwright disponible en el entorno de pruebas y Chrome instalado.

El sitio usa el escudo institucional y la familia tipográfica del proyecto de referencia. Los archivos de fuente conservan su licencia SIL OFL en `assets/fonts/OFL.txt`; jsPDF conserva su aviso de licencia en `vendor/jspdf.umd.min.js`.
