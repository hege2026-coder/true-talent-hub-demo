import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btn = loginForm.querySelector('button[type="submit"]');
            const originalText = btn.textContent;
            btn.textContent = 'Iniciando sesión...';
            btn.disabled = true;

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                
                // Buscar el perfil en Firestore
                const userDoc = await getDoc(doc(db, "usuarios", user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    if (userData.rol === "admin" || userData.rol === "evaluador") {
                        window.location.href = "./admin/dashboard.html";
                    } else {
                        window.location.href = "./postulante/dashboard.html";
                    }
                } else {
                    // Fallback
                    window.location.href = "./postulante/dashboard.html";
                }
            } catch (error) {
                console.error("Error signing in:", error);
                alert(`Error: ${error.code || 'Desconocido'}\nMensaje: ${error.message}`);
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
    }
});
