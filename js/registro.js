import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Detener recarga nativa inmediatamente
            console.log("Formulario de registro enviado, preventDefault() ejecutado.");
            
            const btn = document.getElementById('btn-register');
            btn.textContent = 'Procesando...';
            btn.disabled = true;

            const fullName = document.getElementById('nombreCompleto').value.trim();
            const email = document.getElementById('email').value.trim();
            const telefono = document.getElementById('telefono').value.trim();
            const password = document.getElementById('password').value;
            const linkedinUrl = document.getElementById('linkedinUrl').value.trim();
            const vacante = document.getElementById('vacante').value.trim();
            const cvFileInput = document.getElementById('cv_upload');

            // Prevención de Errores: Verificar campos obligatorios
            if (!fullName || !email || !telefono || !password || !linkedinUrl || !vacante) {
                alert("Por favor, completa todos los campos obligatorios.");
                console.warn("Faltan campos obligatorios en el formulario de registro.");
                btn.textContent = 'Enviar postulación';
                btn.disabled = false;
                return;
            }

            try {
                // 1. Autenticación
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // 2. Manejo Temporal del CV
                let cvFilename = null;
                if (cvFileInput.files.length > 0) {
                    cvFilename = cvFileInput.files[0].name;
                } else {
                    console.warn("No se adjuntó ningún archivo CV.");
                }

                // 3. Crear documento en la colección 'usuarios'
                await setDoc(doc(db, "usuarios", user.uid), {
                    nombre_completo: fullName,
                    email: email,
                    telefono: telefono,
                    rol: "postulante",
                    linkedinUrl: linkedinUrl,
                    cv_filename: cvFilename,
                    vacante: vacante,
                    timestamp: new Date().toISOString()
                });

                alert("Registro exitoso. Serás redirigido a tu dashboard.");
                window.location.href = "./dashboard.html";

            } catch (error) {
                console.error(error);
                
                alert(`Error: ${error.code || 'Desconocido'} \nMensaje: ${error.message}`);
                
                btn.textContent = 'Enviar postulación';
                btn.disabled = false;
            }
        });
    }
});
