import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.querySelector('.login-form');

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btn = document.getElementById('btn-register');
            btn.textContent = 'Registering...';
            btn.disabled = true;

            const fullName = document.getElementById('fullName').value;
            const email = document.getElementById('email').value;
            const telefono = document.getElementById('telefono').value;
            const password = document.getElementById('password').value;
            const cvUrl = document.getElementById('cvUrl').value;
            const vacante = document.getElementById('vacante').value;

            try {
                // 1. Autenticación
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // 2. Crear documento en la colección 'usuarios'
                await setDoc(doc(db, "usuarios", user.uid), {
                    nombre_completo: fullName,
                    email: email,
                    telefono: telefono,
                    rol: "postulante",
                    cvUrl: cvUrl,
                    vacante: vacante,
                    timestamp: new Date().toISOString()
                });

                alert("Registro exitoso. Serás redirigido a las instrucciones.");
                window.location.href = "./dashboard.html";

            } catch (error) {
                console.error(error);
                
                alert(`Error: ${error.code || 'Desconocido'} \nMensaje: ${error.message}`);
                
                btn.textContent = 'Register';
                btn.disabled = false;
            }
        });
    }
});
