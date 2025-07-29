// Sistema Integral de Informes Holter PA - Ergo SaniTas SpA
// Aplicación para optimización de informes MAPA

// Variables globales
let patients = JSON.parse(localStorage.getItem('patients')) || [];
let studies = JSON.parse(localStorage.getItem('studies')) || [];
let currentStudy = null;

// Criterios médicos oficiales basados en guías internacionales
const medicalCriteria = {
    bloodPressure: {
        normal24h: { sys: 130, dia: 80 },
        normalDay: { sys: 135, dia: 85 },
        normalNight: { sys: 120, dia: 70 }
    },
    dipping: {
        normal: { min: 10, max: 20 },
        reduced: { min: 1, max: 10 },
        extreme: { min: 20, max: 100 },
        nonDipper: { min: -100, max: 1 }
    },
    pulsePressure: {
        normal: 50,
        abnormal: 55
    },
    hypertensiveLoad: {
        normal: 25,
        high: 40
    }
};

// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    updateDateTime();
    setInterval(updateDateTime, 60000); // Actualizar cada minuto
});

// Inicializar aplicación
function initializeApp() {
    loadProfile();
    updateStatistics();
    loadPatients();
    populatePatientSelect();
    setDefaultValues();
    showSection('profile');
}

// Configurar event listeners
function setupEventListeners() {
    // Formulario de pacientes
    document.getElementById('patient-form').addEventListener('submit', handlePatientSubmit);
    
    // Validación en tiempo real del RUT
    document.getElementById('patient-rut').addEventListener('input', validateRUT);
    
    // Actualizar select de pacientes cuando se registra uno nuevo
    document.addEventListener('patientRegistered', populatePatientSelect);
}

// Actualizar fecha y hora
function updateDateTime() {
    const now = new Date();
    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    document.getElementById('current-datetime').textContent = 
        now.toLocaleDateString('es-CL', options);
}

// Navegación entre secciones
function showSection(sectionId) {
    // Ocultar todas las secciones
    const sections = ['profile', 'users', 'data-entry', 'analysis', 'report', 'history'];
    sections.forEach(id => {
        const section = document.getElementById(id + '-section');
        if (section) {
            section.classList.add('hidden');
        }
    });
    
    // Mostrar la sección seleccionada
    const targetSection = document.getElementById(sectionId + '-section');
    if (targetSection) {
        targetSection.classList.remove('hidden');
    }
    
    // Actualizar botones de navegación
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    const navButtons = document.querySelectorAll('.nav-btn');
    const sectionIndex = sections.indexOf(sectionId);
    if (sectionIndex !== -1 && navButtons[sectionIndex]) {
        navButtons[sectionIndex].classList.add('active');
    }
    
    // Acciones específicas por sección
    switch(sectionId) {
        case 'users':
            loadPatients();
            break;
        case 'data-entry':
            populatePatientSelect();
            break;
        case 'history':
            loadHistory();
            break;
    }
}

// === GESTIÓN DE PERFIL MÉDICO ===

function loadProfile() {
    const profile = JSON.parse(localStorage.getItem('doctorProfile')) || {};
    
    document.getElementById('doctor-name').value = profile.name || '';
    document.getElementById('doctor-specialty').value = profile.specialty || 'Cardiología';
    document.getElementById('doctor-institution').value = profile.institution || 'Ergo SaniTas SpA';
    document.getElementById('doctor-rut').value = profile.rut || '';
    document.getElementById('doctor-registry').value = profile.registry || '';
}

function saveProfile() {
    try {
        const profile = {
            name: document.getElementById('doctor-name').value.trim(),
            specialty: document.getElementById('doctor-specialty').value.trim(),
            institution: document.getElementById('doctor-institution').value.trim(),
            rut: document.getElementById('doctor-rut').value.trim(),
            registry: document.getElementById('doctor-registry').value.trim(),
            lastUpdate: new Date().toISOString()
        };
        
        if (!profile.name || !profile.rut) {
            throw new Error('Nombre y RUT son campos obligatorios');
        }
        
        localStorage.setItem('doctorProfile', JSON.stringify(profile));
        showNotification('Perfil guardado exitosamente', 'success');
        
    } catch (error) {
        showNotification('Error al guardar perfil: ' + error.message, 'error');
    }
}

function resetProfile() {
    if (confirm('¿Está seguro de restablecer el perfil?')) {
        localStorage.removeItem('doctorProfile');
        loadProfile();
        showNotification('Perfil restablecido', 'info');
    }
}

// === GESTIÓN DE PACIENTES ===

function handlePatientSubmit(e) {
    e.preventDefault();
    
    try {
        const patient = {
            id: generateId(),
            fullname: document.getElementById('patient-fullname').value.trim(),
            age: parseInt(document.getElementById('patient-age').value),
            rut: document.getElementById('patient-rut').value.trim(),
            gender: document.getElementById('patient-gender').value,
            phone: document.getElementById('patient-phone').value.trim(),
            email: document.getElementById('patient-email').value.trim(),
            diseases: document.getElementById('patient-diseases').value.trim(),
            medications: document.getElementById('patient-medications').value.trim(),
            registrationDate: new Date().toISOString()
        };
        
        // Validaciones
        if (!patient.fullname || !patient.age || !patient.rut || !patient.gender) {
            throw new Error('Complete todos los campos obligatorios');
        }
        
        if (!isValidRUT(patient.rut)) {
            throw new Error('RUT inválido');
        }
        
        if (patients.some(p => p.rut === patient.rut)) {
            throw new Error('Ya existe un paciente con este RUT');
        }
        
        // Guardar paciente
        patients.push(patient);
        localStorage.setItem('patients', JSON.stringify(patients));
        
        // Actualizar interfaz
        loadPatients();
        populatePatientSelect();
        resetPatientForm();
        updateStatistics();
        
        // Disparar evento personalizado
        document.dispatchEvent(new CustomEvent('patientRegistered'));
        
        showNotification('Paciente registrado exitosamente', 'success');
        
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

function loadPatients() {
    const patientsList = document.getElementById('patients-list');
    
    if (patients.length === 0) {
        patientsList.innerHTML = '<p class="no-patients">No hay pacientes registrados</p>';
        return;
    }
    
    patientsList.innerHTML = patients.map(patient => `
        <div class="patient-item" onclick="selectPatient('${patient.id}')">
            <div class="patient-name">${patient.fullname}</div>
            <div class="patient-details">
                RUT: ${patient.rut} | Edad: ${patient.age} años | ${patient.gender}
            </div>
            <div class="patient-details">
                Registrado: ${new Date(patient.registrationDate).toLocaleDateString('es-CL')}
            </div>
        </div>
    `).join('');
}

function populatePatientSelect() {
    const select = document.getElementById('selected-patient');
    select.innerHTML = '<option value="">Seleccione un paciente</option>';
    
    patients.forEach(patient => {
        const option = document.createElement('option');
        option.value = patient.id;
        option.textContent = `${patient.fullname} - ${patient.rut}`;
        select.appendChild(option);
    });
}

function selectPatient(patientId) {
    const patient = patients.find(p => p.id === patientId);
    if (patient) {
        document.getElementById('selected-patient').value = patientId;
        showSection('data-entry');
        showNotification(`Paciente seleccionado: ${patient.fullname}`, 'info');
    }
}

function resetPatientForm() {
    document.getElementById('patient-form').reset();
    clearErrors();
}

// === VALIDACIONES ===

function validateRUT() {
    const rutInput = document.getElementById('patient-rut');
    const rut = rutInput.value.trim();
    const errorElement = document.getElementById('rut-error');
    
    if (rut && !isValidRUT(rut)) {
        errorElement.textContent = 'RUT inválido';
        rutInput.style.borderColor = '#e74c3c';
    } else {
        errorElement.textContent = '';
        rutInput.style.borderColor = '#e0e6ed';
    }
}

function isValidRUT(rut) {
    // Limpiar RUT
    rut = rut.replace(/\./g, '').replace('-', '');
    
    if (rut.length < 8 || rut.length > 9) return false;
    
    const body = rut.slice(0, -1);
    const dv = rut.slice(-1).toLowerCase();
    
    // Calcular dígito verificador
    let sum = 0;
    let multiplier = 2;
    
    for (let i = body.length - 1; i >= 0; i--) {
        sum += parseInt(body[i]) * multiplier;
        multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }
    
    const remainder = sum % 11;
    const calculatedDV = remainder === 0 ? '0' : remainder === 1 ? 'k' : (11 - remainder).toString();
    
    return dv === calculatedDV;
}

function clearErrors() {
    document.querySelectorAll('.error-message').forEach(error => {
        error.textContent = '';
    });
    
    document.querySelectorAll('input, select, textarea').forEach(input => {
        input.style.borderColor = '#e0e6ed';
    });
}

// === ANÁLISIS DE DATOS MAPA ===

function validateAndAnalyze() {
    try {
        const selectedPatientId = document.getElementById('selected-patient').value;
        if (!selectedPatientId) {
            throw new Error('Debe seleccionar un paciente');
        }
        
        const studyData = collectStudyData();
        if (!validateStudyData(studyData)) {
            throw new Error('Complete todos los campos obligatorios del estudio');
        }
        
        currentStudy = {
            id: generateId(),
            patientId: selectedPatientId,
            ...studyData,
            createdAt: new Date().toISOString()
        };
        
        showNotification('Datos validados correctamente', 'success');
        showSection('analysis');
        
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

function collectStudyData() {
    return {
        studyDate: document.getElementById('study-date').value,
        duration: document.getElementById('study-duration').value,
        quality: parseFloat(document.getElementById('study-quality').value),
        device: document.getElementById('study-device').value,
        avg24hSys: parseFloat(document.getElementById('avg-24h-sys').value),
        avg24hDia: parseFloat(document.getElementById('avg-24h-dia').value),
        avgDaySys: parseFloat(document.getElementById('avg-day-sys').value),
        avgDayDia: parseFloat(document.getElementById('avg-day-dia').value),
        avgNightSys: parseFloat(document.getElementById('avg-night-sys').value),
        avgNightDia: parseFloat(document.getElementById('avg-night-dia').value),
        loadSys: parseFloat(document.getElementById('hypertensive-load-sys').value),
        loadDia: parseFloat(document.getElementById('hypertensive-load-dia').value),
        dippingSys: parseFloat(document.getElementById('dipping-sys').value),
        dippingDia: parseFloat(document.getElementById('dipping-dia').value),
        pulsePressure: parseFloat(document.getElementById('pulse-pressure').value),
        avgHeartRate: parseFloat(document.getElementById('avg-heart-rate').value),
        clinicalFindings: document.getElementById('clinical-findings').value,
        additionalNotes: document.getElementById('additional-notes').value
    };
}

function validateStudyData(data) {
    const requiredFields = ['studyDate', 'avg24hSys', 'avg24hDia', 'avgDaySys', 'avgDayDia', 'avgNightSys', 'avgNightDia'];
    return requiredFields.every(field => data[field] !== null && data[field] !== undefined && data[field] !== '');
}

// === ANÁLISIS INTELIGENTE CON IA ===

async function generateAIAnalysis() {
    if (!currentStudy) {
        showNotification('No hay datos de estudio para analizar', 'error');
        return;
    }
    
    const analysisContent = document.getElementById('analysis-content');
    analysisContent.innerHTML = `
        <div class="analysis-loading">
            <div class="loading"></div>
            <p>Generando análisis inteligente con IA...</p>
        </div>
    `;
    
    try {
        // Obtener datos del paciente
        const patient = patients.find(p => p.id === currentStudy.patientId);
        
        // Preparar prompt para IA
        const prompt = createAnalysisPrompt(patient, currentStudy);
        
        // Llamar a la API de IA
        const analysis = await callAIAnalysis(prompt);
        
        // Mostrar resultado
        displayAnalysisResult(analysis);
        
    } catch (error) {
        analysisContent.innerHTML = `
            <div class="analysis-warning">
                <h4>Error en el análisis con IA</h4>
                <p>No se pudo conectar con el servicio de análisis inteligente. Se mostrará el análisis básico.</p>
            </div>
        `;
        
        // Mostrar análisis básico como respaldo
        displayBasicAnalysis();
    }
}

function createAnalysisPrompt(patient, study) {
    return `
Analiza los siguientes datos de monitorización ambulatoria de presión arterial (MAPA) de 24 horas:

DATOS DEL PACIENTE:
- Nombre: ${patient.fullname}
- Edad: ${patient.age} años
- Sexo: ${patient.gender}
- Enfermedades: ${patient.diseases || 'No reportadas'}
- Medicamentos: ${patient.medications || 'No reportados'}

DATOS DEL ESTUDIO MAPA:
- Promedio 24h: ${study.avg24hSys}/${study.avg24hDia} mmHg
- Promedio diurno: ${study.avgDaySys}/${study.avgDayDia} mmHg
- Promedio nocturno: ${study.avgNightSys}/${study.avgNightDia} mmHg
- Dipping sistólico: ${study.dippingSys}%
- Dipping diastólico: ${study.dippingDia}%
- Carga hipertensiva sistólica: ${study.loadSys}%
- Carga hipertensiva diastólica: ${study.loadDia}%
- Presión de pulso: ${study.pulsePressure} mmHg
- Frecuencia cardíaca promedio: ${study.avgHeartRate} lpm

CRITERIOS DIAGNÓSTICOS:
- Normal 24h: <130/80 mmHg
- Normal diurno: <135/85 mmHg
- Normal nocturno: <120/70 mmHg
- Dipping normal: 10-20%
- Presión de pulso normal: <50 mmHg

Proporciona un análisis médico detallado que incluya:
1. Clasificación diagnóstica según criterios internacionales
2. Evaluación del patrón circadiano
3. Análisis de riesgo cardiovascular
4. Recomendaciones terapéuticas
5. Seguimiento sugerido

Responde en español con terminología médica apropiada para un informe profesional.
    `;
}

async function callAIAnalysis(prompt) {
    // Verificar si hay API key configurada
    const apiKey = localStorage.getItem('openrouter_api_key');
    if (!apiKey) {
        throw new Error('API key no configurada');
    }
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'anthropic/claude-sonnet-4',
            messages: [
                {
                    role: 'system',
                    content: 'Eres un cardiólogo especialista en hipertensión arterial y monitorización ambulatoria de presión arterial (MAPA). Proporciona análisis médicos precisos y profesionales basados en las guías internacionales más actuales.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.3,
            max_tokens: 2000
        })
    });
    
    if (!response.ok) {
        throw new Error('Error en la respuesta de la API');
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
}

function displayAnalysisResult(analysis) {
    const analysisContent = document.getElementById('analysis-content');
    analysisContent.innerHTML = `
        <div class="analysis-result">
            <h4>Análisis Inteligente con IA</h4>
            <div style="white-space: pre-line; line-height: 1.6;">${analysis}</div>
        </div>
    `;
}

function displayBasicAnalysis() {
    if (!currentStudy) return;
    
    const patient = patients.find(p => p.id === currentStudy.patientId);
    const analysis = generateBasicAnalysis(patient, currentStudy);
    
    const analysisContent = document.getElementById('analysis-content');
    analysisContent.innerHTML = `
        <div class="analysis-result">
            <h4>Análisis Básico del Estudio MAPA</h4>
            ${analysis}
        </div>
    `;
}

function generateBasicAnalysis(patient, study) {
    let analysis = '';
    
    // Clasificación de presión arterial
    const bp24h = classifyBloodPressure(study.avg24hSys, study.avg24hDia, '24h');
    const bpDay = classifyBloodPressure(study.avgDaySys, study.avgDayDia, 'day');
    const bpNight = classifyBloodPressure(study.avgNightSys, study.avgNightDia, 'night');
    
    analysis += `<h5>Clasificación de Presión Arterial:</h5>`;
    analysis += `<p><strong>24 horas:</strong> ${bp24h.classification} (${study.avg24hSys}/${study.avg24hDia} mmHg)</p>`;
    analysis += `<p><strong>Período diurno:</strong> ${bpDay.classification} (${study.avgDaySys}/${study.avgDayDia} mmHg)</p>`;
    analysis += `<p><strong>Período nocturno:</strong> ${bpNight.classification} (${study.avgNightSys}/${study.avgNightDia} mmHg)</p>`;
    
    // Análisis del dipping
    const dippingClass = classifyDipping(study.dippingSys);
    analysis += `<h5>Patrón Circadiano:</h5>`;
    analysis += `<p><strong>Dipping sistólico:</strong> ${dippingClass} (${study.dippingSys}%)</p>`;
    
    // Presión de pulso
    const ppClass = study.pulsePressure > medicalCriteria.pulsePressure.abnormal ? 'Elevada' : 'Normal';
    analysis += `<p><strong>Presión de pulso:</strong> ${ppClass} (${study.pulsePressure} mmHg)</p>`;
    
    // Carga hipertensiva
    analysis += `<h5>Carga Hipertensiva:</h5>`;
    analysis += `<p><strong>Sistólica:</strong> ${study.loadSys}% ${study.loadSys > medicalCriteria.hypertensiveLoad.high ? '(Elevada)' : '(Normal)'}</p>`;
    analysis += `<p><strong>Diastólica:</strong> ${study.loadDia}% ${study.loadDia > medicalCriteria.hypertensiveLoad.high ? '(Elevada)' : '(Normal)'}</p>`;
    
    // Interpretación general
    analysis += `<div class="analysis-highlight">`;
    analysis += `<h5>Interpretación:</h5>`;
    if (bp24h.isHypertensive || bpDay.isHypertensive || bpNight.isHypertensive) {
        analysis += `<p>Se confirma hipertensión arterial según criterios MAPA.</p>`;
    } else {
        analysis += `<p>Presión arterial dentro de rangos normales según criterios MAPA.</p>`;
    }
    analysis += `</div>`;
    
    return analysis;
}

function classifyBloodPressure(sys, dia, period) {
    const criteria = medicalCriteria.bloodPressure;
    let threshold;
    
    switch(period) {
        case '24h':
            threshold = criteria.normal24h;
            break;
        case 'day':
            threshold = criteria.normalDay;
            break;
        case 'night':
            threshold = criteria.normalNight;
            break;
    }
    
    const isHypertensive = sys >= threshold.sys || dia >= threshold.dia;
    
    return {
        isHypertensive,
        classification: isHypertensive ? 'Hipertensión' : 'Normal'
    };
}

function classifyDipping(dippingPercent) {
    const criteria = medicalCriteria.dipping;
    
    if (dippingPercent >= criteria.extreme.min) {
        return 'Dipper extremo';
    } else if (dippingPercent >= criteria.normal.min && dippingPercent <= criteria.normal.max) {
        return 'Dipper normal';
    } else if (dippingPercent >= criteria.reduced.min && dippingPercent < criteria.normal.min) {
        return 'Dipper reducido';
    } else {
        return 'Non-dipper';
    }
}

// === GENERACIÓN DE INFORMES ===

function generateReport() {
    if (!currentStudy) {
        showNotification('No hay datos de estudio para generar el informe', 'error');
        return;
    }
    
    const patient = patients.find(p => p.id === currentStudy.patientId);
    const profile = JSON.parse(localStorage.getItem('doctorProfile')) || {};
    
    const reportContent = document.getElementById('report-content');
    reportContent.innerHTML = generateReportHTML(patient, currentStudy, profile);
    
    showSection('report');
    showNotification('Informe generado exitosamente', 'success');
}

function generateReportHTML(patient, study, profile) {
    const reportDate = new Date().toLocaleDateString('es-CL', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    return `
        <div class="report-header">
            <h3 class="report-title">INFORME DE MONITORIZACIÓN AMBULATORIA DE PRESIÓN ARTERIAL</h3>
            <p class="report-subtitle">Holter de Presión Arterial 24 horas - MAPA</p>
            <p><strong>Ergo SaniTas SpA</strong></p>
            <p>Fecha del informe: ${reportDate}</p>
        </div>
        
        <div class="report-section">
            <h4>DATOS DEL PACIENTE</h4>
            <div class="report-data">
                <div class="report-item">
                    <span class="report-label">Nombre:</span>
                    <span class="report-value">${patient.fullname}</span>
                </div>
                <div class="report-item">
                    <span class="report-label">RUT:</span>
                    <span class="report-value">${patient.rut}</span>
                </div>
                <div class="report-item">
                    <span class="report-label">Edad:</span>
                    <span class="report-value">${patient.age} años</span>
                </div>
                <div class="report-item">
                    <span class="report-label">Sexo:</span>
                    <span class="report-value">${patient.gender}</span>
                </div>
                <div class="report-item">
                    <span class="report-label">Fecha del estudio:</span>
                    <span class="report-value">${new Date(study.studyDate).toLocaleDateString('es-CL')}</span>
                </div>
            </div>
        </div>
        
        <div class="report-section">
            <h4>DATOS TÉCNICOS DEL ESTUDIO</h4>
            <div class="report-data">
                <div class="report-item">
                    <span class="report-label">Duración del registro:</span>
                    <span class="report-value">${study.duration || 'No especificada'}</span>
                </div>
                <div class="report-item">
                    <span class="report-label">Calidad del registro:</span>
                    <span class="report-value">${study.quality}%</span>
                </div>
                <div class="report-item">
                    <span class="report-label">Dispositivo utilizado:</span>
                    <span class="report-value">${study.device || 'No especificado'}</span>
                </div>
            </div>
        </div>
        
        <div class="report-section">
            <h4>RESULTADOS DE PRESIÓN ARTERIAL</h4>
            <div class="report-data">
                <div class="report-item">
                    <span class="report-label">Promedio 24 horas:</span>
                    <span class="report-value">${study.avg24hSys}/${study.avg24hDia} mmHg</span>
                </div>
                <div class="report-item">
                    <span class="report-label">Promedio diurno:</span>
                    <span class="report-value">${study.avgDaySys}/${study.avgDayDia} mmHg</span>
                </div>
                <div class="report-item">
                    <span class="report-label">Promedio nocturno:</span>
                    <span class="report-value">${study.avgNightSys}/${study.avgNightDia} mmHg</span>
                </div>
                <div class="report-item">
                    <span class="report-label">Presión de pulso:</span>
                    <span class="report-value">${study.pulsePressure} mmHg</span>
                </div>
                <div class="report-item">
                    <span class="report-label">Frecuencia cardíaca promedio:</span>
                    <span class="report-value">${study.avgHeartRate} lpm</span>
                </div>
            </div>
        </div>
        
        <div class="report-section">
            <h4>ANÁLISIS DEL PATRÓN CIRCADIANO</h4>
            <div class="report-data">
                <div class="report-item">
                    <span class="report-label">Dipping sistólico:</span>
                    <span class="report-value">${study.dippingSys}% (${classifyDipping(study.dippingSys)})</span>
                </div>
                <div class="report-item">
                    <span class="report-label">Dipping diastólico:</span>
                    <span class="report-value">${study.dippingDia}% (${classifyDipping(study.dippingDia)})</span>
                </div>
            </div>
        </div>
        
        <div class="report-section">
            <h4>CARGA HIPERTENSIVA</h4>
            <div class="report-data">
                <div class="report-item">
                    <span class="report-label">Carga sistólica:</span>
                    <span class="report-value">${study.loadSys}%</span>
                </div>
                <div class="report-item">
                    <span class="report-label">Carga diastólica:</span>
                    <span class="report-value">${study.loadDia}%</span>
                </div>
            </div>
        </div>
        
        <div class="report-interpretation">
            <h5>INTERPRETACIÓN DIAGNÓSTICA</h5>
            ${generateDiagnosticInterpretation(study)}
        </div>
        
        ${study.clinicalFindings ? `
        <div class="report-section">
            <h4>HALLAZGOS CLÍNICOS</h4>
            <p>${study.clinicalFindings}</p>
        </div>
        ` : ''}
        
        ${study.additionalNotes ? `
        <div class="report-section">
            <h4>COMENTARIOS ADICIONALES</h4>
            <p>${study.additionalNotes}</p>
        </div>
        ` : ''}
        
        <div class="report-section" style="margin-top: 40px; text-align: center;">
            <p><strong>Dr. ${profile.name || '[Nombre del médico]'}</strong></p>
            <p>${profile.specialty || 'Cardiología'}</p>
            <p>RUT: ${profile.rut || '[RUT del médico]'}</p>
            <p>Registro Médico: ${profile.registry || '[Número de registro]'}</p>
            <p><strong>Ergo SaniTas SpA</strong></p>
        </div>
    `;
}

function generateDiagnosticInterpretation(study) {
    let interpretation = '';
    
    // Clasificar presión arterial
    const bp24h = classifyBloodPressure(study.avg24hSys, study.avg24hDia, '24h');
    const bpDay = classifyBloodPressure(study.avgDaySys, study.avgDayDia, 'day');
    const bpNight = classifyBloodPressure(study.avgNightSys, study.avgNightDia, 'night');
    
    if (bp24h.isHypertensive || bpDay.isHypertensive || bpNight.isHypertensive) {
        interpretation += '<p><strong>DIAGNÓSTICO:</strong> Hipertensión arterial confirmada por MAPA.</p>';
        
        if (bp24h.isHypertensive) interpretation += '<p>• Hipertensión en promedio de 24 horas</p>';
        if (bpDay.isHypertensive) interpretation += '<p>• Hipertensión diurna</p>';
        if (bpNight.isHypertensive) interpretation += '<p>• Hipertensión nocturna</p>';
    } else {
        interpretation += '<p><strong>DIAGNÓSTICO:</strong> Presión arterial normal según criterios MAPA.</p>';
    }
    
    // Análisis del dipping
    const dippingClass = classifyDipping(study.dippingSys);
    if (dippingClass === 'Non-dipper') {
        interpretation += '<p><strong>PATRÓN CIRCADIANO:</strong> Patrón non-dipper, asociado a mayor riesgo cardiovascular.</p>';
    } else if (dippingClass === 'Dipper extremo') {
        interpretation += '<p><strong>PATRÓN CIRCADIANO:</strong> Patrón dipper extremo, requiere evaluación adicional.</p>';
    } else {
        interpretation += '<p><strong>PATRÓN CIRCADIANO:</strong> Patrón circadiano normal.</p>';
    }
    
    // Presión de pulso
    if (study.pulsePressure > medicalCriteria.pulsePressure.abnormal) {
        interpretation += '<p><strong>PRESIÓN DE PULSO:</strong> Elevada, sugiere rigidez arterial.</p>';
    }
    
    // Carga hipertensiva
    if (study.loadSys > medicalCriteria.hypertensiveLoad.high || study.loadDia > medicalCriteria.hypertensiveLoad.high) {
        interpretation += '<p><strong>CARGA HIPERTENSIVA:</strong> Elevada, indica control subóptimo de la presión arterial.</p>';
    }
    
    return interpretation;
}

// === EXPORTACIÓN A PDF ===

function exportToPDF() {
    if (!currentStudy) {
        showNotification('No hay informe para exportar', 'error');
        return;
    }
    
    try {
        // Crear una nueva ventana para imprimir
        const printWindow = window.open('', '_blank');
        const reportContent = document.getElementById('report-content').innerHTML;
        
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Informe MAPA - ${patients.find(p => p.id === currentStudy.patientId)?.fullname}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
                    .report-header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
                    .report-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
                    .report-subtitle { font-size: 14px; color: #666; }
                    .report-section { margin-bottom: 25px; }
                    .report-section h4 { color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
                    .report-data { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                    .report-item { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dotted #ccc; }
                    .report-label { font-weight: 500; }
                    .report-value { font-weight: bold; }
                    .report-interpretation { background: #f5f5f5; padding: 15px; border-left: 4px solid #007bff; margin: 20px 0; }
                    @media print { body { margin: 0; } }
                </style>
            </head>
            <body>
                ${reportContent}
            </body>
            </html>
        `);
        
        printWindow.document.close();
        
        // Esperar a que se cargue y luego imprimir
        setTimeout(() => {
            printWindow.print();
        }, 500);
        
        showNotification('Preparando exportación a PDF...', 'info');
        
    } catch (error) {
        showNotification('Error al exportar: ' + error.message, 'error');
    }
}

// === GESTIÓN DE DATOS ===

function saveDraft() {
    try {
        const draftData = collectStudyData();
        localStorage.setItem('currentDraft', JSON.stringify(draftData));
        showNotification('Borrador guardado exitosamente', 'success');
    } catch (error) {
        showNotification('Error al guardar borrador: ' + error.message, 'error');
    }
}

function loadDraft() {
    try {
        const draft = JSON.parse(localStorage.getItem('currentDraft'));
        if (draft) {
            // Cargar datos del borrador en el formulario
            Object.keys(draft).forEach(key => {
                const element = document.getElementById(key.replace(/([A-Z])/g, '-$1').toLowerCase());
                if (element) {
                    element.value = draft[key];
                }
            });
            showNotification('Borrador cargado', 'info');
        }
    } catch (error) {
        console.error('Error al cargar borrador:', error);
    }
}

function clearDataEntry() {
    if (confirm('¿Está seguro de limpiar todos los datos ingresados?')) {
        document.querySelectorAll('#data-entry-section input, #data-entry-section textarea, #data-entry-section select').forEach(element => {
            if (element.type !== 'date') {
                element.value = '';
            }
        });
        currentStudy = null;
        localStorage.removeItem('currentDraft');
        showNotification('Datos limpiados', 'info');
    }
}

// === HISTORIAL ===

function loadHistory() {
    const historyList = document.getElementById('history-list');
    
    if (studies.length === 0) {
        historyList.innerHTML = '<p class="no-history">No hay estudios registrados en el historial</p>';
        return;
    }
    
    historyList.innerHTML = studies.map(study => {
        const patient = patients.find(p => p.id === study.patientId);
        return `
            <div class="history-item" onclick="viewStudy('${study.id}')">
                <div class="history-date">${new Date(study.createdAt).toLocaleDateString('es-CL')}</div>
                <div class="history-patient">${patient ? patient.fullname : 'Paciente no encontrado'}</div>
                <div class="history-summary">
                    PA 24h: ${study.avg24hSys}/${study.avg24hDia} mmHg | 
                    Dipping: ${study.dippingSys}% | 
                    Calidad: ${study.quality}%
                </div>
            </div>
        `;
    }).join('');
}

function viewStudy(studyId) {
    const study = studies.find(s => s.id === studyId);
    if (study) {
        currentStudy = study;
        generateReport();
    }
}

function saveCurrentStudy() {
    if (currentStudy) {
        const existingIndex = studies.findIndex(s => s.id === currentStudy.id);
        if (existingIndex !== -1) {
            studies[existingIndex] = currentStudy;
        } else {
            studies.push(currentStudy);
        }
        localStorage.setItem('studies', JSON.stringify(studies));
        updateStatistics();
    }
}

// === ESTADÍSTICAS ===

function updateStatistics() {
    document.getElementById('reports-count').textContent = studies.length;
    document.getElementById('patients-count').textContent = patients.length;
    
    const lastAccess = localStorage.getItem('lastAccess');
    if (lastAccess) {
        const lastDate = new Date(lastAccess);
        const today = new Date();
        const diffDays = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            document.getElementById('last-access').textContent = 'Hoy';
        } else if (diffDays === 1) {
            document.getElementById('last-access').textContent = 'Ayer';
        } else {
            document.getElementById('last-access').textContent = `Hace ${diffDays} días`;
        }
    }
    
    localStorage.setItem('lastAccess', new Date().toISOString());
}

// === CONFIGURACIÓN DE API ===

function setupAPIKey() {
    const apiKey = prompt('Ingrese su API key de OpenRouter para análisis con IA:');
    if (apiKey) {
        localStorage.setItem('openrouter_api_key', apiKey);
        showNotification('API key configurada exitosamente', 'success');
    }
}

// === UTILIDADES ===

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function setDefaultValues() {
    // Establecer fecha actual por defecto
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('study-date').value = today;
    
    // Cargar borrador si existe
    loadDraft();
}

function showNotification(message, type = 'info') {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Estilos de la notificación
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        max-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        transition: all 0.3s ease;
    `;
    
    // Colores según el tipo
    switch(type) {
        case 'success':
            notification.style.background = '#27ae60';
            break;
        case 'error':
            notification.style.background = '#e74c3c';
            break;
        case 'warning':
            notification.style.background = '#f39c12';
            break;
        default:
            notification.style.background = '#3498db';
    }
    
    // Agregar al DOM
    document.body.appendChild(notification);
    
    // Remover después de 4 segundos
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

// === EVENTOS GLOBALES ===

// Guardar estudio actual antes de cerrar
window.addEventListener('beforeunload', () => {
    if (currentStudy) {
        saveCurrentStudy();
    }
});

// Manejar errores globales
window.addEventListener('error', (event) => {
    console.error('Error global:', event.error);
    showNotification('Ha ocurrido un error inesperado', 'error');
});

// Configurar API key al hacer clic en análisis si no está configurada
document.addEventListener('click', (event) => {
    if (event.target.textContent === 'Generar Análisis con IA') {
        const apiKey = localStorage.getItem('openrouter_api_key');
        if (!apiKey) {
            if (confirm('Para usar el análisis con IA necesita configurar una API key de OpenRouter. ¿Desea configurarla ahora?')) {
                setupAPIKey();
            }
        }
    }
});
