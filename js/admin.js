import { auth, db, firebaseConfig } from './firebase-config.js';
import { onAuthStateChanged, signOut, createUserWithEmailAndPassword, getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, query, where, doc, updateDoc, getDoc, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";

let currentUserRole = null;

const GEMINI_API_KEY = 'AIzaSyDzrT5-NODjHflf1eTDgbxu59h3AwoeCgM';

const RUBRICA_EVALUACION = `
CRITERIOS DE EVALUACIÓN (Media Buyer Coordinator):
Evalúa considerando que este rol exige mentalidad de sistemas, madurez emocional y disciplina operativa, no solo ejecución táctica.

GUÍA POR PREGUNTA (Usa estrictamente estos valores y criterios):
- 1.1 (3 pts): Espera diferencias en foco operativo, KPIs y toma de decisiones. Bandera roja: cree que es el mismo rol con más responsabilidad.
- 1.2 (3 pts): SLA = Acuerdo formal de tiempos/estándares. Debe dar ejemplos con números. Bandera roja: confunde SLA con KPI.
- 1.3 (4 pts): QA checklist. Mencionar al menos 5: tracking, presupuesto, audiencias, naming, creatividades, UTMs.
- 2.1 (4 pts): Naming convention. Parseable, sin espacios. Bandera roja: falta de fecha o estructura inconsistente.
- 2.2 (3 pts): Píxel mal etiquetado. Única válida: Pausar, corregir, documentar, retroalimentar y reportar. Bandera roja: esperar o corregir en silencio.
- 2.3 (4 pts): 5 errores comunes. (ej. CBO mal asignado, overlap, bid strategy incorrecta).
- 2.4 (4 pts): Proceso auditoría. Definir frecuencia, formato, responsables y escalación.
- 3.1 (5 pts): Onboarding Junior (2 semanas). Inducción, shadow con senior, tareas de bajo riesgo, mentor, certificación.
- 3.2 (5 pts): Mid con errores. Proceso: Preparación, escuchar contexto, buscar causa raíz sin juzgar, plan de acción documentado.
- 3.3 (5 pts): Conflicto Seniors. Bajar temperatura, pedir DATA objetiva, no tomar partido, acuerdo escrito.
- 4.1 (3 pts): Pacing $50k. $32k gastado al día 15 es SOBRE-PACING (~32%). Acción: investigar causa, ajustar presupuestos, avisar al cliente.
- 4.2 (4 pts): Pacing = ritmo de gasto vs plan. Causas: cambios de bidding, subasta cara, pausas no documentadas.
- 4.3 (5 pts): Priorización. 1. Resolver sobre-pacing, 2. Resolver sub-pacing, 3. Reportar al Lead con matriz resumen.
- 5.1 (4 pts): Píxel caído viernes 5pm. Escalar al Lead inmediato, evaluar impacto, pausar si está ciego, coordinar con AM.
- 5.2 (3 pts): Escalar: impacto financiero, riesgo reputacional, error propio. Resolver solo: error menor, pacing ajustable.
- 5.3 (3 pts): Caída Meta. Confirmar global, alinear con AMs, avisar a clientes factual en <2 hrs. Post-mortem.
- 6.1 (3 pts): Google QS vs Meta Ranking. Entenderlos para leer salud a nivel agregado.
- 6.2 (3 pts): Tracking cross-platform. Validar: definiciones idénticas, ventanas de atribución, deduplicación, UTMs.
- 6.3 (3 pts): Brand Safety. Google: topic exclusions. Meta: Inventory Filter. DV360: verification 3rd party.
- 6.4 (4 pts): Discrepancia BI vs Plataforma. Revisar ventanas atribución, deduplicación, modelado vs data firme.
- 7.1 (4 pts): Planning. Coordinator VALIDA viabilidad del plan. Discrepancias se documentan.
- 7.2 (3 pts): Data. Pide: reportes consolidados, alertas de pacing, dashboards cross-channel.
- 7.3 (3 pts): PMO. Entrega: estado de cuentas, capacidad. Recibe: calendario global, asignación de recursos.
- Caso Práctico (Sección 8, 25 pts total): Valora que priorice apagar incendios financieros (sobre-pacing), que no sature al junior, implemente checklists QA, defina SLAs operativos medibles, y comunique cambios con humildad y co-creación.
`;

const SYSTEM_PROMPT = `Actúa como el Director de una Agencia de Marketing evaluando una prueba técnica para Media Buyer Coordinator. Revisa las respuestas del candidato y asigna un puntaje basándote ESTRICTAMENTE en esta rúbrica: \n\n${RUBRICA_EVALUACION}\n\nSé estricto y aplica las penalizaciones de las banderas rojas. Devuelve ÚNICAMENTE un objeto JSON puro (sin bloques de código markdown \`\`\`json) con esta estructura exacta: { "evaluaciones": [ { "id_pregunta": "1.1", "puntaje_asignado": 3, "feedback_interno": "Justificación breve" } ] }`;

const btnLogout = document.getElementById('btn-logout');
const topContainer = document.getElementById('top-candidates-container');
const tableBody = document.getElementById('candidates-table-body');
const filterStatus = document.getElementById('filter-status');
const sortScoreBtn = document.getElementById('sort-score');
const sortTimeBtn = document.getElementById('sort-time');

const modal = document.getElementById('candidate-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const modalHeader = document.getElementById('modal-header-info');
const modalBody = document.getElementById('modal-body-content');

let candidates = [];
let filteredCandidates = [];
let currentCandidate = null;

function formatTime(seconds) {
    if (!seconds) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (userDoc.exists()) {
            currentUserRole = userDoc.data().rol;
            if (currentUserRole === 'admin' || currentUserRole === 'evaluador') {
                if (currentUserRole === 'admin') {
                    const managementSection = document.getElementById('admin-management-section');
                    if (managementSection) managementSection.style.display = 'block';
                }
                await loadCandidates();
            } else {
                window.location.href = '../index.html';
            }
        } else {
            window.location.href = '../index.html';
        }
    } else {
        window.location.href = '../index.html';
    }
});

btnLogout.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = '../index.html';
});

async function loadCandidates() {
    try {
        const q = query(collection(db, "usuarios"), where("rol", "==", "postulante"));
        const snapshot = await getDocs(q);
        
        candidates = [];
        snapshot.forEach(d => {
            const data = d.data();
            data.uid = d.id;
            
            if (data.evaluacion) {
                if (data.evaluacion.score !== undefined && data.evaluacion.score !== null) {
                    data._estado = 'calificado';
                    data._score = data.evaluacion.score;
                } else {
                    data._estado = 'revision';
                    data._score = null;
                }
                data._tiempo = data.evaluacion.tiempoTotalSegundos || 0;
            } else if (data.progreso) {
                data._estado = 'progreso';
                data._tiempo = data.progreso.tiempo || 0;
                data._score = null;
            } else {
                data._estado = 'nuevo';
                data._tiempo = 0;
                data._score = null;
            }
            candidates.push(data);
        });

        filteredCandidates = [...candidates];
        renderTop3();
        renderTable();
    } catch (error) {
        console.error("Error loading candidates:", error);
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">Error de lectura de Firebase.</td></tr>`;
    }
}

function renderTop3() {
    const completed = candidates.filter(c => c._estado === 'calificado' && c._score !== null);
    completed.sort((a, b) => b._score - a._score);
    const top3 = completed.slice(0, 3);

    if (top3.length === 0) {
        topContainer.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">No hay candidatos calificados aún.</p>`;
        return;
    }

    topContainer.innerHTML = top3.map((c, index) => `
        <div class="top-card">
            <h3>#${index + 1} - <a href="#" class="top-candidate-link" data-uid="${c.uid}" style="color: inherit; text-decoration: underline; text-decoration-color: var(--accent-red); cursor: pointer;">${c.nombre_completo}</a></h3>
            <p>${c.vacante || 'N/A'}</p>
            <p>Tiempo: ${formatTime(c._tiempo)}</p>
            <div class="score">${c._score} pts</div>
        </div>
    `).join('');

    document.querySelectorAll('.top-candidate-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            openModal(link.getAttribute('data-uid'));
        });
    });
}

function renderTable() {
    if (filteredCandidates.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">No hay resultados con estos filtros.</td></tr>`;
        return;
    }

    tableBody.innerHTML = filteredCandidates.map(c => {
        let badgeClass = '';
        let badgeText = '';
        if (c._estado === 'calificado') { badgeClass = 'status-completado'; badgeText = 'Calificado'; }
        else if (c._estado === 'revision') { badgeClass = 'status-nuevo'; badgeText = 'En revisión'; }
        else if (c._estado === 'progreso') { badgeClass = 'status-progreso'; badgeText = 'En progreso'; }
        else { badgeClass = 'status-nuevo'; badgeText = 'Nuevo'; }

        const scoreText = c._score !== null ? `${c._score} pts` : '-';
        const dateText = c.timestamp ? new Date(c.timestamp).toLocaleDateString() : 'N/A';

        return `
            <tr data-uid="${c.uid}" class="candidate-row">
                <td style="font-weight: 500;">${c.nombre_completo}</td>
                <td>${c.vacante || 'N/A'}</td>
                <td>${dateText}</td>
                <td>${formatTime(c._tiempo)}</td>
                <td>${scoreText}</td>
                <td><span class="status-badge ${badgeClass}">${badgeText}</span></td>
            </tr>
        `;
    }).join('');

    document.querySelectorAll('.candidate-row').forEach(row => {
        row.addEventListener('click', () => openModal(row.getAttribute('data-uid')));
    });
}

filterStatus.addEventListener('change', (e) => {
    const val = e.target.value;
    // Adaptamos los values para coincidir con la nueva lógica si es necesario
    if (val === 'all') {
        filteredCandidates = [...candidates];
    } else if (val === 'completado') {
        filteredCandidates = candidates.filter(c => c._estado === 'revision' || c._estado === 'calificado');
    } else {
        filteredCandidates = candidates.filter(c => c._estado === val);
    }
    renderTable();
});

sortScoreBtn.addEventListener('click', () => {
    filteredCandidates.sort((a, b) => (b._score || 0) - (a._score || 0));
    renderTable();
});

sortTimeBtn.addEventListener('click', () => {
    filteredCandidates.sort((a, b) => {
        if (a._tiempo === 0) return 1;
        if (b._tiempo === 0) return -1;
        return a._tiempo - b._tiempo;
    });
    renderTable();
});

btnCloseModal.addEventListener('click', () => modal.classList.remove('active'));
// modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });

function openModal(uid) {
    currentCandidate = candidates.find(c => c.uid === uid);
    if (!currentCandidate) return;

    modalHeader.innerHTML = `
        <h2 style="margin-bottom: 0.5rem;">${currentCandidate.nombre_completo}</h2>
        <p><strong>Vacante:</strong> ${currentCandidate.vacante || 'N/A'}</p>
        <p><strong>Email:</strong> ${currentCandidate.email}</p>
        <p><strong>Teléfono:</strong> ${currentCandidate.telefono || 'N/A'}</p>
        <div style="margin-top: 1rem; display: flex; gap: 1rem; flex-wrap: wrap;">
            ${currentCandidate.linkedinUrl ? `<a href="${currentCandidate.linkedinUrl}" target="_blank" class="btn-primary" style="padding: 0.5rem 1rem; font-size: 0.85rem; text-decoration: none; display: inline-block;">Ver perfil de LinkedIn</a>` : ''}
            ${currentCandidate.cv_filename ? `<span style="background-color: #f1f5f9; padding: 0.5rem 1rem; border-radius: 4px; font-size: 0.85rem; border: 1px dashed #cbd5e1;">📄 Archivo subido: ${currentCandidate.cv_filename}</span>` : (!currentCandidate.cvUrl ? '<span style="color: var(--text-muted); font-size: 0.85rem; align-self: center;">Sin CV adjunto</span>' : '')}
        </div>
    `;

    const scoreVal = currentCandidate._score !== null ? `${currentCandidate._score} pts` : '<span style="font-size: 1.1rem; color: #999;">Pendiente de calificar</span>';
    
    let auditLogsArr = [];
    if (currentCandidate.evaluacion && currentCandidate.evaluacion.auditLogs) auditLogsArr = currentCandidate.evaluacion.auditLogs;
    else if (currentCandidate.progreso && currentCandidate.progreso.auditLogs) auditLogsArr = currentCandidate.progreso.auditLogs;

    const auditHtml = auditLogsArr.length === 0 
        ? `<div class="audit-box audit-clean"><strong>✓ Prueba limpia.</strong> Sin incidentes detectados.</div>`
        : `<div class="audit-box audit-issues">
             <strong>⚠️ Incidentes detectados:</strong>
             <ul>${auditLogsArr.map(log => `<li>${log}</li>`).join('')}</ul>
           </div>`;

    let respuestasArr = [];
    if (currentCandidate.evaluacion && currentCandidate.evaluacion.respuestas) respuestasArr = currentCandidate.evaluacion.respuestas;
    else if (currentCandidate.progreso && currentCandidate.progreso.respuestas) respuestasArr = currentCandidate.progreso.respuestas;

    const showGrading = (currentCandidate._estado === 'revision' || currentCandidate._estado === 'calificado');

    const answersHtml = respuestasArr.length > 0 
        ? `<div class="answers-section">
             <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                <h3 style="margin: 0; border: none; padding: 0;">Respuestas del Candidato</h3>
                <button id="btn-ai-grade" class="btn-primary" style="width: auto; background-color: var(--black); font-size: 0.85rem; padding: 0.5rem 1rem; margin: 0;">✨ Pre-calificar con Gemini AI</button>
             </div>
             ${respuestasArr.map((r, i) => {
                 const match = r.pregunta.match(/\((\d+)\s*pts\)/i);
                 const maxPts = match ? parseInt(match[1]) : 5;
                 const isAutoEval = !r.pregunta.toLowerCase().includes('pts');

                 let gradeHtml = '';
                 if (showGrading && !isAutoEval) {
                     // Recuperar valores previos si ya estaba calificado
                     let prevScore = '';
                     let prevFeedback = '';
                     if (currentCandidate.evaluacion && currentCandidate.evaluacion.revisionDetalle) {
                        const det = currentCandidate.evaluacion.revisionDetalle.find(d => d.id == r.id); // Usamos == por si difieren entre int y string
                        if (det) {
                            prevScore = det.score;
                            prevFeedback = det.feedback || '';
                        }
                    } 

                     const disabledAttr = showGrading && currentCandidate._estado === 'calificado' ? 'disabled' : '';
                     gradeHtml = `
                     <div class="grading-controls" style="margin-top: 1rem; padding: 1rem; background: #fafafa; border: 1px solid var(--border-color); border-radius: 6px; display: flex; gap: 1rem; align-items: flex-start;">
                        <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                            <label style="font-size: 0.8rem; font-weight: 500;">Puntaje (Max ${maxPts})</label>
                            <input type="number" class="grade-input" data-id="${r.id}" max="${maxPts}" min="0" value="${prevScore}" style="width: 100px; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;" placeholder="0" ${disabledAttr}>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 0.3rem; flex: 1;">
                            <label style="font-size: 0.8rem; font-weight: 500;">Feedback interno</label>
                            <textarea class="feedback-input" data-id="${r.id}" style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; resize: vertical; min-height: 40px;" placeholder="Feedback interno (opcional)" ${disabledAttr}>${prevFeedback}</textarea>
                        </div>
                     </div>`;
                 }

                 return `
                 <div class="answer-item">
                    <h4>${r.id}. ${r.pregunta}</h4>
                    <p>${r.respuesta || '<em style="color: #ccc;">(Vacío)</em>'}</p>
                    ${gradeHtml}
                 </div>`;
             }).join('')}
             
             ${showGrading ? `
             <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                <div>
                    ${currentUserRole === 'admin' ? `<button id="btn-delete-candidate" class="btn-primary" style="background-color: #ef4444; padding: 0.8rem 1.5rem; font-size: 0.9rem;">Eliminar Registro</button>` : ''}
                </div>
                <div style="display: flex; gap: 1rem;">
                    ${currentCandidate._estado === 'calificado' ? `<button id="btn-edit-grade" class="btn-primary" style="background-color: transparent; color: var(--black); border: 1px solid var(--border-color); padding: 0.8rem 2rem; font-size: 1rem;">Editar Calificación</button>` : ''}
                    <button id="btn-save-grade" class="btn-primary" style="width: auto; padding: 0.8rem 2rem; font-size: 1rem;">Guardar Calificación Final</button>
                </div>
             </div>` : ''}
           </div>`
        : `<p style="color: var(--text-muted); text-align: center; margin-top: 2rem;">Aún no hay respuestas guardadas.</p>`;

    modalBody.innerHTML = `
        <div style="margin-bottom: 1.5rem; display: flex; gap: 10px; background: #fafafa; padding: 1rem; border-radius: 6px; border: 1px solid var(--border-color); flex-wrap: wrap; align-items: center;">
            <strong style="font-size: 0.85rem; color: #555; margin-right: 0.5rem;">Acciones:</strong>
            <button id="btn-copilot-copy" class="btn-primary" style="background-color: #2563eb; width: auto; font-size: 0.85rem; padding: 0.6rem 1rem; margin: 0;">Copiar Datos para IA</button>
            <button id="btn-copilot-download" class="btn-primary" style="background-color: #10b981; width: auto; font-size: 0.85rem; padding: 0.6rem 1rem; margin: 0;">Descargar Examen para IA</button>
            <button id="btn-dummy-cv" class="btn-primary" style="background-color: #030309; width: auto; font-size: 0.85rem; padding: 0.6rem 1rem; margin: 0;">Descargar CV</button>
        </div>
        <div class="metrics-grid">
            <div class="metric-box">
                <h4>Calificación</h4>
                <div class="value" style="color: var(--accent-red);">${scoreVal}</div>
            </div>
            <div class="metric-box">
                <h4>Tiempo Invertido</h4>
                <div class="value">${formatTime(currentCandidate._tiempo)}</div>
            </div>
        </div>
        ${auditHtml}
        ${answersHtml}
    `;

    modal.classList.add('active');

    // Funcionalidad de los botones de Copilot
    const btnCopilotCopy = document.getElementById('btn-copilot-copy');
    const btnCopilotDownload = document.getElementById('btn-copilot-download');
    
    if (btnCopilotCopy || btnCopilotDownload) {
        let copilotText = `CANDIDATO: ${currentCandidate.nombre_completo}\n`;
        copilotText += `VACANTE: ${currentCandidate.vacante || 'N/A'}\n`;
        copilotText += `EMAIL: ${currentCandidate.email}\n`;
        copilotText += `TELÉFONO: ${currentCandidate.telefono || 'N/A'}\n`;
        copilotText += `LINKEDIN: ${currentCandidate.linkedinUrl || 'N/A'}\n\n`;
        copilotText += `RESPUESTAS DEL EXAMEN:\n`;
        respuestasArr.forEach(r => {
            copilotText += `\n[Pregunta ${r.id}]: ${r.pregunta}\n`;
            copilotText += `[Respuesta]: ${r.respuesta || '(Vacío)'}\n`;
        });

        if (btnCopilotCopy) {
            btnCopilotCopy.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(copilotText);
                    alert("Datos copiados al portapapeles correctamente.");
                } catch (err) {
                    alert("No se pudo copiar: " + err);
                }
            });
        }

        if (btnCopilotDownload) {
            btnCopilotDownload.addEventListener('click', () => {
                const blob = new Blob([copilotText], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Examen_${currentCandidate.nombre_completo.replace(/\s+/g, '_')}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });
        }
    }

    const btnDummyCv = document.getElementById('btn-dummy-cv');
    if (btnDummyCv) {
        btnDummyCv.addEventListener('click', () => {
            alert('Descarga de CV pendiente de almacenamiento');
        });
    }

    // Attach listeners a los nuevos botones
    const btnAi = document.getElementById('btn-ai-grade');
    if (btnAi) {
        btnAi.addEventListener('click', async () => {
            btnAi.textContent = "Analizando respuestas... (Esto tomará unos segundos)";
            btnAi.disabled = true;

            let respuestasRecolectadas = "";
            respuestasArr.forEach(r => {
                respuestasRecolectadas += `Pregunta ${r.id}: ${r.pregunta}\nRespuesta: ${r.respuesta || '(Vacío)'}\n\n`;
            });

            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: SYSTEM_PROMPT + "\n\nRespuestas del candidato:\n" + respuestasRecolectadas }]
                        }]
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Error de red: ${response.status} - ${errorText}`);
                }

                const data = await response.json();
                
                // Limpieza de Markdown
                let textoIA = data.candidates[0].content.parts[0].text;
                textoIA = textoIA.replace(/```json/g, '').replace(/```/g, '').trim();
                
                const resultadoJSON = JSON.parse(textoIA);

                // Lógica para inyectar en el DOM
                resultadoJSON.evaluaciones.forEach(evaluacion => {
                    const gradeInput = document.querySelector(`.grade-input[data-id="${evaluacion.id_pregunta}"]`);
                    const feedbackInput = document.querySelector(`.feedback-input[data-id="${evaluacion.id_pregunta}"]`);
                    
                    if (gradeInput) gradeInput.value = evaluacion.puntaje_asignado;
                    if (feedbackInput) feedbackInput.value = evaluacion.feedback_interno;
                });

                alert("Pre-calificación completada con éxito.");

            } catch (error) {
                console.error("Error completo:", error);
                alert("Error en la IA: " + error.message);
            } finally {
                btnAi.textContent = "✨ Pre-calificar con Gemini AI";
                btnAi.disabled = false;
            }
        });
    }

    const btnEditGrade = document.getElementById('btn-edit-grade');
    if (btnEditGrade) {
        btnEditGrade.addEventListener('click', () => {
            document.querySelectorAll('.grade-input, .feedback-input').forEach(el => el.disabled = false);
            btnEditGrade.style.display = 'none';
        });
    }
    
    const btnDeleteCandidate = document.getElementById('btn-delete-candidate');
    if (btnDeleteCandidate) {
        btnDeleteCandidate.addEventListener('click', async () => {
            if (confirm("¿Estás seguro de eliminar permanentemente a este candidato?")) {
                try {
                    await deleteDoc(doc(db, "usuarios", currentCandidate.uid));
                    alert("Candidato eliminado.");
                    modal.classList.remove('active');
                    await loadCandidates();
                } catch (err) {
                    console.error(err);
                    alert("Error eliminando candidato.");
                }
            }
        });
    }

    const btnSaveGrade = document.getElementById('btn-save-grade');
    if (btnSaveGrade) {
        btnSaveGrade.addEventListener('click', async () => {
            const gradeInputs = document.querySelectorAll('.grade-input');
            const feedbackInputs = document.querySelectorAll('.feedback-input');
            
            let totalScore = 0;
            const revisionData = [];
            let isValid = true;

            gradeInputs.forEach((input, index) => {
                const max = parseFloat(input.getAttribute('max'));
                const score = parseFloat(input.value);
                const parsedScore = isNaN(score) ? 0 : score;
                
                if (!isNaN(max) && parsedScore > max) {
                    isValid = false;
                    input.style.borderColor = 'red';
                } else {
                    input.style.borderColor = '#ccc';
                }

                totalScore += parsedScore;
                revisionData.push({
                    id: input.getAttribute('data-id'),
                    score: parsedScore,
                    feedback: feedbackInputs[index].value
                });
            });

            if (!isValid) {
                alert("Error: Algunos puntajes exceden el límite máximo permitido para la pregunta (marcados en rojo).");
                return; // Bloqueamos el guardado
            }

            btnSaveGrade.textContent = "Guardando...";
            btnSaveGrade.disabled = true;

            try {
                await updateDoc(doc(db, "usuarios", currentCandidate.uid), {
                    "evaluacion.score": totalScore,
                    "evaluacion.estado": "Calificado",
                    "evaluacion.revisionDetalle": revisionData
                });
                alert(`Calificación final guardada exitosamente: ${totalScore} pts`);
                modal.classList.remove('active');
                await loadCandidates(); // Recargamos para reflejar cambios
            } catch (err) {
                console.error("Error saving grade:", err);
                alert("Hubo un error al guardar la calificación.");
                btnSaveGrade.textContent = "Guardar Calificación Final";
                btnSaveGrade.disabled = false;
            }
        });
    }
}

const evaluatorForm = document.getElementById('evaluator-form');
if (evaluatorForm) {
    evaluatorForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = document.getElementById('btn-create-ev');
        const prevText = btn.textContent;
        btn.textContent = 'Creando...';
        btn.disabled = true;

        const name = document.getElementById('ev-name').value;
        const email = document.getElementById('ev-email').value;
        const password = document.getElementById('ev-password').value;

        try {
            const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
            const secondaryAuth = getAuth(secondaryApp);

            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
            const newUid = userCredential.user.uid;

            await setDoc(doc(db, "usuarios", newUid), {
                nombre_completo: name,
                email: email,
                rol: "evaluador",
                timestamp: new Date().toISOString()
            });

            await signOut(secondaryAuth);
            alert("Evaluador creado exitosamente.");
            evaluatorForm.reset();
        } catch (error) {
            console.error("Error creando evaluador:", error);
            alert("Error al crear evaluador: " + error.message);
        } finally {
            btn.textContent = prevText;
            btn.disabled = false;
        }
    });
}
