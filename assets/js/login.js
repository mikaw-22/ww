const supabaseClient = window.supabase.createClient(
    'https://sjmxcwaxzhoxgiewyzvv.supabase.co',
    'sb_publishable_mrfxaZidteMBHWWsEWrpng_3HQqLG3n'
);

const loginBtn = document.getElementById('login_btn');
const loginEmail = document.getElementById('login_email');
const loginPassword = document.getElementById('login_password');
const loginError = document.getElementById('login_error');

loginBtn.addEventListener('click', async () => {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: loginEmail.value,
        password: loginPassword.value
    });

    if (error) {
        loginError.textContent = 'Login fehlgeschlagen: ' + error.message;
        loginError.style.display = 'block';
    } else {
        window.location.href = 'page.html';
    }
});

// Live-Uhrzeit mit laufender Sekundenzahl
const liveClock = document.getElementById('live_clock');

function updateClock() {
    const now = new Date();
    liveClock.textContent = now.toLocaleTimeString('de-DE');
}
updateClock();
setInterval(updateClock, 1000);