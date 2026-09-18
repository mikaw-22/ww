// ===== SUPABASE INITIALISIEREN =====
const supabaseClient = window.supabase.createClient(
    'https://sjmxcwaxzhoxgiewyzvv.supabase.co',
    'sb_publishable_mrfxaZidteMBHWWsEWrpng_3HQqLG3n'
);

// ===== LOGIN-CHECK =====
(async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'index.html';
    }
})();

// Labels für die Ecken-Radiobuttons
const cornerLabels = {
    "top-left": "Oben-Links",
    "top-middle": "Oben-Mitte",
    "top-right": "Oben-Rechts",
    "left": "Links",
    "middle": "Mitte",
    "right": "Rechts",
    "bottom-left": "Unten-Links",
    "bottom-middle": "Unten-Mitte",
    "bottom-right": "Unten-Rechts"
};

const cornerInputs = document.querySelectorAll('input[name="corner"]');
const cornerDashboard = document.getElementById('corner_dashboard');

cornerInputs.forEach(input => {
    input.addEventListener('change', () => {
        cornerDashboard.textContent = cornerLabels[input.value] || '';
    });
});

const throwDashboard = document.getElementById('throw_dashboard');

document.querySelectorAll('input[name="position"]').forEach(input => {
    input.addEventListener('change', () => {
        throwDashboard.textContent = input.value;
    });
});

// Tor oder kein Tor
const goalInputs = document.querySelectorAll('input[name="score"]');
const goalDashboard = document.getElementById('goal_or_nogoal');

const goalLabels = {
    "goal": "Tor",
    "nogoal": "Kein Tor"
};

goalInputs.forEach(input => {
    input.addEventListener('change', () => {
        goalDashboard.textContent = goalLabels[input.value] || '';
    });
});

// Lock-Icon Toggle + Select durch Span ersetzen
const lockElements = document.querySelectorAll('.lock');

function updateLockState(lock) {
    const container = lock.parentElement;
    const select = container.querySelector('select');
    if (select) {
        lock.classList.toggle('disabled', !select.value);
    }
}

lockElements.forEach(lock => {
    // initial prüfen (z.B. beim Laden der Seite)
    updateLockState(lock);

    const container = lock.parentElement;
    const select = container.querySelector('select');
    if (select) {
        select.addEventListener('change', () => updateLockState(lock));
    }

    lock.addEventListener('click', () => {
        const icon = lock.querySelector('.material-symbols-outlined');
        const span = container.querySelector('.team_fixed');

        if (icon.textContent.trim() === 'lock_open_right') {
            // nicht sperren, wenn noch kein Team ausgewählt ist
            if (!select.value) {
                return;
            }
            // sperren
            icon.textContent = 'lock';
            span.textContent = select.options[select.selectedIndex].text;
            select.style.display = 'none';
            span.style.display = 'inline';
        } else {
            // entsperren
            icon.textContent = 'lock_open_right';
            select.style.display = 'inline-block';
            span.style.display = 'none';
        }
    });
});

// ===== TEAMS & SPIELER AUS SUPABASE LADEN =====
const teamSelect = document.querySelector('.teams_options');
const playerSelect = document.querySelector('.players_options');
const opponentLogo = document.getElementById('opponent_logo');
const playerPhoto = document.getElementById('player_photo');

playerSelect.disabled = true;

let teamsById = {};
let playersById = {};

function getLogoUrl(logoKey) {
    return supabaseClient.storage.from('team-logos').getPublicUrl(`${logoKey}.png`).data.publicUrl;
}

function getPlayerPhotoUrl(photoKey) {
    return supabaseClient.storage.from('player-photos').getPublicUrl(`${photoKey}.png`).data.publicUrl;
}

async function loadTeams() {
    opponentLogo.src = getLogoUrl('blank');
    playerPhoto.src = getPlayerPhotoUrl('blank1');
    const { data, error } = await supabaseClient.from('teams').select('*').order('name');
    if (error) {
        console.error('Fehler beim Laden der Teams:', error);
        return;
    }
    data.forEach(team => {
        teamsById[team.id] = team;
        const option = document.createElement('option');
        option.value = team.id;
        option.textContent = team.name;
        teamSelect.appendChild(option);
    });
}

loadTeams();

teamSelect.addEventListener('change', async () => {
    const teamId = teamSelect.value;

    playerSelect.innerHTML = '<option value="">Select Player</option>';
    playersById = {};

    const team = teamsById[teamId];
    opponentLogo.src = team ? getLogoUrl(team.logo_key) : getLogoUrl('blank');

    if (!teamId) {
        playerSelect.disabled = true;
        playerPhoto.src = getPlayerPhotoUrl('blank1');
        checkFormComplete();
        return;
    }

    const { data, error } = await supabaseClient
        .from('players')
        .select('*')
        .eq('team_id', teamId)
        .order('jersey_number');

    if (error) {
        console.error('Fehler beim Laden der Spieler:', error);
        return;
    }

    data.forEach(player => {
        playersById[player.id] = player;
        const option = document.createElement('option');
        option.value = player.id;
        option.textContent = `#${player.jersey_number} - ${player.name}`;
        playerSelect.appendChild(option);
    });

    playerSelect.disabled = false;
    playerPhoto.src = getPlayerPhotoUrl('blank1');
    checkFormComplete();
});

playerSelect.addEventListener('change', () => {
    const player = playersById[playerSelect.value];
    if (player) {
        playerPhoto.src = getPlayerPhotoUrl(player.photo_key);
        playerPhoto.onerror = () => { playerPhoto.src = getPlayerPhotoUrl('blank1');; };
    } else {
        playerPhoto.src = getPlayerPhotoUrl('blank1');
    }
});

// ===== AKTUELLES SPIEL / VIDEO =====
let currentGame = '';
let pendingVideoFile = null;
let videoSlots = [{file:null,game:'',url:null,time:0}];
let activeVideoSlot = 0;

// ===== SPEICHERN-BUTTON =====
const saveBtn = document.querySelector('.save_btn');

function checkFormComplete() {
    const teamFilled = teamSelect.value !== '';
    const playerFilled = playerSelect.value !== '';
    const cornerFilled = document.querySelector('input[name="corner"]:checked') !== null;
    const scoreFilled = document.querySelector('input[name="score"]:checked') !== null;
    const positionFilled = document.querySelector('input[name="position"]:checked') !== null;

    const allFilled = teamFilled && playerFilled && cornerFilled && scoreFilled && positionFilled;
    saveBtn.disabled = !allFilled;
}

// bei jeder relevanten Änderung neu prüfen
teamSelect.addEventListener('change', checkFormComplete);
playerSelect.addEventListener('change', checkFormComplete);
document.querySelectorAll('input[name="corner"]').forEach(input => {
    input.addEventListener('change', checkFormComplete);
});
document.querySelectorAll('input[name="score"]').forEach(input => {
    input.addEventListener('change', checkFormComplete);
});
document.querySelectorAll('input[name="position"]').forEach(input => {
    input.addEventListener('change', checkFormComplete);
});

// initial prüfen
checkFormComplete();

saveBtn.addEventListener('click', async () => {
    const { error } = await supabaseClient.from('throws').insert({
        team_id: teamSelect.value,
        player_id: playerSelect.value,
        corner: document.querySelector('input[name="corner"]:checked')?.value,
        is_goal: document.querySelector('input[name="score"]:checked')?.value === 'goal',
        position: document.querySelector('input[name="position"]:checked')?.value,
        note: document.querySelector('.note').value,
        video_timestamp: videoPlayer.src ? videoPlayer.currentTime : null,
        game: currentGame || null
    });

    if (error) {
        console.error('Fehler beim Speichern:', error);
    } else {
        await loadThrowsLog();
        clearAllRadios();
        document.querySelector('.note').value = '';
    }
});

// ===== VIDEO-UPLOAD =====
const videoContainer = document.querySelector('.goal_container.video');
const videoInput = document.getElementById('video_input');
const uploadTrigger = document.getElementById('upload_trigger');
const videoPreview = document.getElementById('video_preview');
const videoPlayer = document.getElementById('video_player');
const videoRemove = document.getElementById('video_remove');
const gameNameContainer = document.getElementById('gameNameContainer');
const gameNameInput = document.getElementById('gameNameInput');
const confirmGameBtn = document.getElementById('confirmGameBtn');

// Klick auf Upload-Box öffnet Dateiauswahl
uploadTrigger.addEventListener('click', () => videoInput.click());

// Datei über Dateiauswahl gewählt
videoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleLocalVideo(file);
});

// X-Button entfernt das Video wieder
videoRemove?.addEventListener('click', removeVideo);

// ===== VIDEO-STEUERUNG =====
const FPS = 25; // Annahme: 25 Bilder/Sek. — falls dein Material anderes fps hat, hier anpassen
const frameTime = 1 / FPS;

const seekBar = document.getElementById('seek_bar');
const btnPlay = document.getElementById('btn_play');
const btnBack3 = document.getElementById('btn_back3');
const btnFwd3 = document.getElementById('btn_fwd3');
const btnFrameBack = document.getElementById('btn_frame_back');
const btnFrameFwd = document.getElementById('btn_frame_fwd');

videoPlayer.addEventListener('loadedmetadata', () => {
    seekBar.max = videoPlayer.duration;
});

videoPlayer.addEventListener('timeupdate', () => {
    seekBar.value = videoPlayer.currentTime;
});

function updateSeekBarProgress() {
    const duration = videoPlayer.duration;

    if (!duration || !isFinite(duration)) {
        seekBar.style.setProperty('--video-progress', '0%');
        return;
    }

    const progress = (videoPlayer.currentTime / duration) * 100;

    seekBar.style.setProperty(
        '--video-progress',
        `${progress}%`
    );
}

videoPlayer.addEventListener('timeupdate', updateSeekBarProgress);
videoPlayer.addEventListener('loadedmetadata', updateSeekBarProgress);
videoPlayer.addEventListener('durationchange', updateSeekBarProgress);

seekBar.addEventListener('input', () => {
    videoPlayer.currentTime = Number(seekBar.value);
    updateSeekBarProgress();
});

btnPlay.addEventListener('click', () => {
    if (videoPlayer.paused) {
        videoPlayer.play();
        btnPlay.textContent = '❚❚';
    } else {
        videoPlayer.pause();
        btnPlay.textContent = '▶';
    }
});

videoPlayer.addEventListener('pause', () => btnPlay.textContent = '▶');
videoPlayer.addEventListener('play', () => btnPlay.textContent = '❚❚');

btnBack3.addEventListener('click', () => {
    videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 3);
});

btnFwd3.addEventListener('click', () => {
    videoPlayer.currentTime = Math.min(videoPlayer.duration, videoPlayer.currentTime + 3);
});

btnFrameBack.addEventListener('click', () => {
    videoPlayer.pause();
    videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - frameTime);
});

btnFrameFwd.addEventListener('click', () => {
    videoPlayer.pause();
    videoPlayer.currentTime = Math.min(videoPlayer.duration, videoPlayer.currentTime + frameTime);
});

const btnBack10 = document.getElementById('btn_back10');
const btnBack30 = document.getElementById('btn_back30');
const btnFwd10 = document.getElementById('btn_fwd10');
const btnFwd30 = document.getElementById('btn_fwd30');
const btnMute = document.getElementById('btn_mute');

btnBack10.addEventListener('click', () => {
    videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 10);
});

btnFwd10.addEventListener('click', () => {
    videoPlayer.currentTime = Math.min(videoPlayer.duration, videoPlayer.currentTime + 10);
});

btnBack30.addEventListener('click', () => {
    videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 30);
});

btnFwd30.addEventListener('click', () => {
    videoPlayer.currentTime = Math.min(videoPlayer.duration, videoPlayer.currentTime + 30);
});

btnMute.addEventListener('click', () => {
    videoPlayer.muted = !videoPlayer.muted;
    btnMute.textContent = videoPlayer.muted ? '🔇' : '🔊';
});

const timeDisplay = document.getElementById('video_time_display');

function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) seconds = 0;

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');

    // Stunden nur anzeigen, wenn das Video über 1h lang ist
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

videoPlayer.addEventListener('click', (e) => {
    e.stopPropagation(); // verhindert, dass der Klick an übergeordnete Handler durchgereicht wird

    if (videoPlayer.paused) {
        videoPlayer.play();
    } else {
        videoPlayer.pause();
    }
});

function updateTimeDisplay() {
    const current = formatTime(videoPlayer.currentTime);
    const total = formatTime(videoPlayer.duration);
    timeDisplay.textContent = `${current} / ${total}`;
}

videoPlayer.addEventListener('timeupdate', updateTimeDisplay);
videoPlayer.addEventListener('loadedmetadata', updateTimeDisplay);

const btnFullscreen = document.getElementById('btn_fullscreen');

btnFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        videoPreview.requestFullscreen();
    } else {
        document.exitFullscreen();
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

// Logout
document.getElementById('logout_btn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
});

const videoSwitchBtns = document.querySelectorAll('.video_switch_btn');
const videoViews = document.querySelectorAll('.video_view');
const slider = document.getElementById('switch_slider');

videoSwitchBtns.forEach((btn, index) => {
    btn.addEventListener('click', () => {
        videoSwitchBtns.forEach(b => b.classList.remove('active'));
        videoViews.forEach(v => v.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById('videoview_' + btn.dataset.view).classList.add('active');

        // Slider verschieben
        slider.style.transform = `translateX(${index * 100}%)`;
    });
});

const switchBar = document.querySelector('.video_switch_bar');

function moveSliderTo(btn) {
    const btnRect = btn.getBoundingClientRect();
    const barRect = switchBar.getBoundingClientRect();
    slider.style.width = btnRect.width + 'px';
    slider.style.transform = `translateX(${btnRect.left - barRect.left - 3}px)`;
}

videoSwitchBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
        videoSwitchBtns.forEach(b => b.classList.remove('active'));
        videoViews.forEach(v => v.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById('videoview_' + btn.dataset.view).classList.add('active');

        moveSliderTo(btn);
    });
});

// Slider beim Laden auf den aktiven Button setzen (sonst ist er initial falsch breit)
window.addEventListener('load', () => {
    const activeBtn = document.querySelector('.video_switch_btn.active');
    if (activeBtn) moveSliderTo(activeBtn);
});

const docEditor = document.getElementById('doc_editable');

function execCmd(cmd, value = null) {
    docEditor.focus();
    document.execCommand(cmd, false, value);
    updateToolbarState();
}

document.getElementById('doc_bold').addEventListener('click', () => execCmd('bold'));
document.getElementById('doc_italic').addEventListener('click', () => execCmd('italic'));
document.getElementById('doc_underline').addEventListener('click', () => execCmd('underline'));
document.getElementById('doc_strike').addEventListener('click', () => execCmd('strikeThrough'));
document.getElementById('doc_ul').addEventListener('click', () => execCmd('insertUnorderedList'));
document.getElementById('doc_ol').addEventListener('click', () => execCmd('insertOrderedList'));

document.getElementById('doc_fontsize_select').addEventListener('change', (e) => {
    execCmd('fontSize', e.target.value);
});

// Checkliste: neuen Punkt einfügen
document.getElementById('doc_checklist').addEventListener('click', () => {
    docEditor.focus();
    const html = '<div class="doc_checklist_item"><span class="doc_checkbox" contenteditable="false"></span><span class="doc_checklist_text">&#8203;</span></div>';
    document.execCommand('insertHTML', false, html);
});

// Checkbox anklicken -> abhaken/durchstreichen
docEditor.addEventListener('click', (e) => {
    if (e.target.classList.contains('doc_checkbox')) {
        e.target.closest('.doc_checklist_item').classList.toggle('checked');
    }
});

// Aktiven Formatierungs-Status der Toolbar-Buttons anzeigen (fett/kursiv aktiv?)
function updateToolbarState() {
    document.getElementById('doc_bold').classList.toggle('active', document.queryCommandState('bold'));
    document.getElementById('doc_italic').classList.toggle('active', document.queryCommandState('italic'));
    document.getElementById('doc_underline').classList.toggle('active', document.queryCommandState('underline'));
    document.getElementById('doc_strike').classList.toggle('active', document.queryCommandState('strikeThrough'));
}

document.addEventListener('selectionchange', () => {
    if (document.activeElement === docEditor) updateToolbarState();
});

document.getElementById('doc_new_player').addEventListener('click', () => {
    docEditor.focus();

    const html = `
        <p><b>#XX - Vorname Nachname</b></p>
        <p>Notiz</p>
        <p><br><br></p>
    `;

    // Ans Ende des Editors springen, damit neue Blöcke immer unten angehängt werden
    const range = document.createRange();
    range.selectNodeContents(docEditor);
    range.collapse(false); // false = Ende

    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    document.execCommand('insertHTML', false, html);
    docEditor.scrollTop = docEditor.scrollHeight; // automatisch runterscrollen
});

document.getElementById('doc_copy').addEventListener('click', async () => {
    const text = docEditor.innerText;

    try {
        await navigator.clipboard.writeText(text);
        showCheckFeedback(document.getElementById('doc_copy'));
    } catch (err) {
        console.error('Kopieren fehlgeschlagen:', err);
    }
});

const saveInput = document.querySelector('.save_input');
const fileSelect = document.getElementById('doc_file_select');

// Wiederverwendbare Check-Feedback-Funktion für beliebige Buttons
function showCheckFeedback(button) {
    const icon = button.querySelector('.material-symbols-outlined');
    const original = icon.textContent;

    icon.textContent = 'check';
    setTimeout(() => {
        icon.textContent = original;
    }, 1200);
}

// --- Speichern ---
document.getElementById('doc_save').addEventListener('click', async () => {
    const filename = saveInput.value.trim();

    if (!filename) {
        alert('Bitte einen Dateinamen eingeben.');
        return;
    }

    const exists = Array.from(fileSelect.options).some(opt => opt.value === filename);

    if (exists) {
        const confirmOverwrite = await showConfirm(`"${filename}" existiert bereits. Überschreiben?`);
        if (!confirmOverwrite) return;
    }

    const content = docEditor.innerHTML;

    const { error } = await supabaseClient
        .from('notes_files')
        .upsert(
            { filename: filename, content: content, updated_at: new Date().toISOString() },
            { onConflict: 'filename' }
        );

    if (error) {
        console.error('Speichern fehlgeschlagen:', error);
        alert('Fehler beim Speichern: ' + error.message);
        return;
    }

    showCheckFeedback(document.getElementById('doc_save'));
    await loadFileList();
    saveInput.value = '';
    docEditor.innerHTML = ''; // Editor leeren nach erfolgreichem Speichern
    setCurrentDocument(null);
});

// --- Dateiliste laden & Dropdown befüllen ---
async function loadFileList() {
    const { data, error } = await supabaseClient
        .from('notes_files')
        .select('filename, created_at')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Dateiliste konnte nicht geladen werden:', error);
        return;
    }

    fileSelect.innerHTML = '<option value="">Dateiauswahl</option>';

    data.forEach(file => {
        const date = new Date(file.created_at);
        const formattedDate = date.toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });

        const opt = document.createElement('option');
        opt.value = file.filename;
        opt.textContent = `${formattedDate} - ${file.filename}`;
        fileSelect.appendChild(opt);
    });
}

// --- Datei öffnen ---
document.getElementById('doc_read').addEventListener('click', async () => {
    const filename = fileSelect.value;

    if (!filename) {
        docEditor.innerHTML = '';
        setCurrentDocument(null);
        return;
    }

    const { data, error } = await supabaseClient
        .from('notes_files')
        .select('content')
        .eq('filename', filename)
        .single();

    if (error) {
        console.error('Datei konnte nicht geladen werden:', error);
        alert('Fehler beim Laden: ' + error.message);
        return;
    }

    docEditor.innerHTML = data.content;
    setCurrentDocument(filename);
    showCheckFeedback(document.getElementById('doc_read'));
});

// Beim Start einmal die Liste laden
loadFileList();

function showConfirm(message) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('confirm_overlay');
        const text = document.getElementById('confirm_text');
        const btnYes = document.getElementById('confirm_yes');
        const btnNo = document.getElementById('confirm_no');

        text.textContent = message;
        overlay.classList.add('active');

        function cleanup(result) {
            overlay.classList.remove('active');
            btnYes.removeEventListener('click', onYes);
            btnNo.removeEventListener('click', onNo);
            resolve(result);
        }

        function onYes() { cleanup(true); }
        function onNo() { cleanup(false); }

        btnYes.addEventListener('click', onYes);
        btnNo.addEventListener('click', onNo);
    });
}

const menuOverlay = document.getElementById('menu_overlay');
const menuTableBody = document.getElementById('menu_table_body');

// Menü öffnen
document.getElementById('doc_menu').addEventListener('click', () => {
    renderMenuTable();
    menuOverlay.classList.add('active');
});

document.getElementById('menu_close').addEventListener('click', () => {
    menuOverlay.classList.remove('active');
});

// Tabelle mit allen Dateien füllen
async function renderMenuTable() {
    const { data, error } = await supabaseClient
        .from('notes_files')
        .select('filename, created_at')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Dateiliste konnte nicht geladen werden:', error);
        return;
    }

    menuTableBody.innerHTML = '';

    data.forEach(file => {
        const date = new Date(file.created_at);
        const formattedDate = date.toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="menu_filename_cell">${formattedDate} - ${file.filename}</td>
            <td class="menu_icon_cell">
                <button type="button" class="menu_icon_btn menu_open_btn" data-filename="${file.filename}">
                    <span class="material-symbols-outlined white_log">display_add</span>
                </button>
            </td>
            <td class="menu_icon_cell">
                <button type="button" class="menu_icon_btn menu_delete_btn" data-filename="${file.filename}">
                    <span class="material-symbols-outlined color_red">delete</span>
                </button>
            </td>
        `;
        menuTableBody.appendChild(tr);
    });

    // Öffnen-Buttons verknüpfen
    menuTableBody.querySelectorAll('.menu_open_btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const filename = btn.dataset.filename;

            const { data, error } = await supabaseClient
                .from('notes_files')
                .select('content')
                .eq('filename', filename)
                .single();

            if (error) {
                console.error('Datei konnte nicht geladen werden:', error);
                alert('Fehler beim Laden: ' + error.message);
                return;
            }

            docEditor.innerHTML = data.content;
            fileSelect.value = filename; // Dropdown ebenfalls synchronisieren
            setCurrentDocument(filename);
            menuOverlay.classList.remove('active');
        });
    });

    // Löschen-Buttons verknüpfen
    menuTableBody.querySelectorAll('.menu_delete_btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const filename = btn.dataset.filename;

            menuOverlay.classList.remove('active'); // Menü sofort schließen

            const confirmDelete = await showConfirm(`"${filename}" wirklich löschen?`);
            if (!confirmDelete) return;

            const { error } = await supabaseClient
                .from('notes_files')
                .delete()
                .eq('filename', filename);

            if (error) {
                console.error('Löschen fehlgeschlagen:', error);
                alert('Fehler beim Löschen: ' + error.message);
                return;
            }

            await loadFileList();
        });
    });
}

const uploadOptionsRow = document.getElementById('upload_options_row');

// Mehrere lokale Videos gleichzeitig offen halten
const videoTabsBar=document.getElementById('video_tabs_bar');
const videoTabAdd=document.getElementById('video_tab_add');
function slot(i=activeVideoSlot){while(videoSlots.length<=i)videoSlots.push({file:null,game:'',url:null,time:0});return videoSlots[i]}
function renderVideoTabs(){
    videoTabsBar.querySelectorAll('.video_tab_btn').forEach(x=>x.remove());
    videoSlots.forEach((v,i)=>{
        const b=document.createElement('button');
        b.type='button';
        b.className='video_tab_btn'+(i===activeVideoSlot?' active':'');
        const label=document.createElement('span');
        label.className='video_tab_label';
        label.textContent=v.game||`Video ${i+1}`;
        const close=document.createElement('span');
        close.className='video_tab_close';
        close.textContent='×';
        close.title='Video entfernen';
        close.setAttribute('role','button');
        close.setAttribute('aria-label','Video entfernen');
        close.addEventListener('click',async e=>{
            e.stopPropagation();
            await removeVideoAt(i);
        });
        b.append(label,close);
        b.title=v.game||`Video ${i+1}`;
        b.onclick=()=>switchVideo(i);
        videoTabsBar.insertBefore(b,videoTabAdd);
    })
}
function rememberVideo(){const v=slot();if(v.file&&videoPlayer.src)v.time=videoPlayer.currentTime||0}
function freeUrl(v){if(v&&v.url){URL.revokeObjectURL(v.url);v.url=null}}
async function switchVideo(i,seek=null){rememberVideo();activeVideoSlot=i;const v=slot(i);currentGame=v.game||'';renderVideoTabs();videoPlayer.pause();videoPlayer.removeAttribute('src');videoPlayer.load();gameNameContainer.style.display='none';if(!v.file){videoPreview.style.display='none';uploadOptionsRow.style.display='flex';return}if(!v.url)v.url=URL.createObjectURL(v.file);videoPlayer.src=v.url;videoPreview.style.display='block';uploadOptionsRow.style.display='none';const t=seek===null?v.time:Number(seek||0);videoPlayer.addEventListener('loadedmetadata',()=>{videoPlayer.currentTime=Math.max(0,Math.min(t,videoPlayer.duration||t));videoPlayer.pause()},{once:true})}
videoTabAdd.addEventListener('click',()=>{rememberVideo();videoSlots.push({file:null,game:'',url:null,time:0});switchVideo(videoSlots.length-1);videoInput.click()});
function handleLocalVideo(file){if(file.type!=='video/mp4'){alert('Bitte nur MP4-Dateien.');return}pendingVideoFile=file;gameNameInput.value=slot().game||'';videoPreview.style.display='none';uploadOptionsRow.style.display='none';gameNameContainer.style.display='block';gameNameInput.focus()}
async function confirmPendingLocalVideo(){if(!pendingVideoFile)return;const game=gameNameInput.value.trim();if(!game){gameNameInput.focus();return}const v=slot();freeUrl(v);v.file=pendingVideoFile;v.game=game;v.time=0;currentGame=game;pendingVideoFile=null;gameNameContainer.style.display='none';await saveVideoToDB(v.file,game);await switchVideo(activeVideoSlot)}
confirmGameBtn?.addEventListener('click',confirmPendingLocalVideo);gameNameInput?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();confirmPendingLocalVideo()}});
async function showVideo(file,{persist=true}={}){const v=slot();freeUrl(v);v.file=file;v.game=currentGame||v.game;if(persist&&v.game)await saveVideoToDB(file,v.game);await switchVideo(activeVideoSlot)}
async function removeVideoAt(index){
    const removingActive=index===activeVideoSlot;
    const v=videoSlots[index];
    if(!v)return;
    const game=v.game;
    freeUrl(v);
    if(videoSlots.length>1){
        videoSlots.splice(index,1);
        if(index<activeVideoSlot) activeVideoSlot--;
        else if(removingActive) activeVideoSlot=Math.min(index,videoSlots.length-1);
    }else{
        videoSlots[0]={file:null,game:'',url:null,time:0};
        activeVideoSlot=0;
    }
    if(game)await clearVideoFromDB(game);
    if(removingActive) await switchVideo(activeVideoSlot);
    else renderVideoTabs();
}
async function removeVideo(){await removeVideoAt(activeVideoSlot)}
renderVideoTabs();

document.getElementById('switch_pos_radios').addEventListener('click', () => {
    document.querySelectorAll('.position-radio').forEach(radio => {
        radio.classList.toggle('pos_visible');
    });
});

const gehaltTableBody = document.getElementById('gehalt_table_body');

async function loadGehaltTable() {
    const { data, error } = await supabaseClient
        .from('paycheck')
        .select('*')
        .order('id', { ascending: true });

    if (error) {
        console.error('Gehaltstabelle konnte nicht geladen werden:', error);
        return;
    }

    gehaltTableBody.innerHTML = '';

    data.forEach(row => {
        const receivedDate = row.received_at
            ? new Date(row.received_at).toLocaleDateString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              })
            : '-';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.received_at || '-'}</td>
            <td>${row.month || ''}</td>
            <td>${row.paycheck ?? ''}€</td>
            <td>${row.account ?? ''}€</td>
            <td><button class="${row.receive ? 'erhalten_yes' : 'erhalten_no'}" data-id="${row.id}" data-field="receive">${row.receive ? 'JA' : 'NEIN'}</button></td>
            <td>${row.voucher ?? ''}€</td>
            <td><button class="${row.voucher_receive ? 'erhalten_yes' : 'erhalten_no'}" data-id="${row.id}" data-field="voucher_receive">${row.voucher_receive ? 'JA' : 'NEIN'}</button></td>
            <td><input type="text" class="td_notiz" value="${row.note || ''}" data-id="${row.id}"></td>
        `;
        gehaltTableBody.appendChild(tr);
    });

    // JA/NEIN Toggle-Buttons
    gehaltTableBody.querySelectorAll('button[data-field]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const field = btn.dataset.field;
            const newValue = btn.textContent.trim() !== 'JA';

            const updatePayload = { [field]: newValue };

            // Nur beim "receive"-Button (Gehalt erhalten) das Datum mitpflegen
            if (field === 'receive') {
                updatePayload.received_at = newValue ? new Date().toISOString() : null;
            }

            const { error } = await supabaseClient
                .from('paycheck')
                .update(updatePayload)
                .eq('id', id);

            if (error) {
                console.error('Update fehlgeschlagen:', error);
                return;
            }

            btn.textContent = newValue ? 'JA' : 'NEIN';
            btn.className = newValue ? 'erhalten_yes' : 'erhalten_no';

            // Datumsspalte in derselben Zeile sofort aktualisieren, ohne die ganze Tabelle neu zu laden
            if (field === 'receive') {
                const row = btn.closest('tr');
                const dateCell = row.querySelector('td:first-child');
                dateCell.textContent = newValue
                    ? new Date(updatePayload.received_at).toLocaleDateString('de-DE', {
                        day: '2-digit', month: '2-digit', year: 'numeric'
                      })
                    : '-';
            }
        });
    });

    // Notiz automatisch speichern (beim Verlassen des Feldes)
    gehaltTableBody.querySelectorAll('.td_notiz').forEach(input => {
        input.addEventListener('blur', async () => {
            const id = input.dataset.id;

            const { error } = await supabaseClient
                .from('paycheck')
                .update({ note: input.value })
                .eq('id', id);

            if (error) {
                console.error('Notiz speichern fehlgeschlagen:', error);
            }
        });
    });
}

loadGehaltTable();

document.getElementById('gehalt_gear_btn').addEventListener('click', async () => {
    await populateDeleteMonthSelect();
    document.getElementById('gehalt_menu_overlay').classList.add('active');
});

document.getElementById('gehalt_menu_close').addEventListener('click', () => {
    document.getElementById('gehalt_menu_overlay').classList.remove('active');
});

async function populateDeleteMonthSelect() {
    const { data, error } = await supabaseClient
        .from('paycheck')
        .select('id, month, received_at')
        .order('id', { ascending: true });

    if (error) return;

    const select = document.getElementById('delete_month_select');
    select.innerHTML = '<option value="">Monat auswählen</option>';

    data.forEach(row => {
        const receivedDate = row.received_at
            ? new Date(row.received_at).toLocaleDateString('de-DE', {
                day: '2-digit', month: '2-digit', year: 'numeric'
              })
            : '-';

        const opt = document.createElement('option');
        opt.value = row.id;
        opt.textContent = `${row.month} (${receivedDate})`;
        select.appendChild(opt);
    });
}

document.getElementById('add_month_btn').addEventListener('click', async () => {
    const month = document.getElementById('new_month_input').value.trim();
    const paycheck = document.getElementById('new_paycheck_input').value;
    const account = document.getElementById('new_account_input').value;
    const voucher = document.getElementById('new_voucher_input').value;

    if (!month) {
        alert('Bitte einen Monat eingeben.');
        return;
    }

    const { error } = await supabaseClient.from('paycheck').insert({
        month: month,
        paycheck: paycheck || null,
        account: account || null,
        voucher: voucher || null,
        receive: false,
        voucher_receive: false
    });

    if (error) {
        console.error('Hinzufügen fehlgeschlagen:', error);
        alert('Fehler: ' + error.message);
        return;
    }

    document.getElementById('new_month_input').value = '';
    document.getElementById('new_paycheck_input').value = '';
    document.getElementById('new_account_input').value = '';
    document.getElementById('new_voucher_input').value = '';

    await loadGehaltTable();
    await populateDeleteMonthSelect();
});

document.getElementById('delete_month_btn').addEventListener('click', async () => {
    const id = document.getElementById('delete_month_select').value;
    if (!id) {
        alert('Bitte einen Monat auswählen.');
        return;
    }

    document.getElementById('gehalt_menu_overlay').classList.remove('active');

    const confirmDelete = await showConfirm('Diesen Monat wirklich löschen?');
    if (!confirmDelete) return;

    const { error } = await supabaseClient.from('paycheck').delete().eq('id', id);

    if (error) {
        console.error('Löschen fehlgeschlagen:', error);
        alert('Fehler: ' + error.message);
        return;
    }

    await loadGehaltTable();
});


// ===== LOG VERGROSSERN / VERKLEINERN =====
const logContainer = document.getElementById('log_container');
const logExpandBtn = document.getElementById('log_expand_btn');
const logExpandIcon = logExpandBtn?.querySelector('.material-symbols-outlined');

function updateExpandedLogTop() {
    const pageHeading = document.querySelector('body > h1');
    const top = pageHeading ? Math.ceil(pageHeading.getBoundingClientRect().bottom) : 0;
    document.documentElement.style.setProperty('--log-expanded-top', `${top}px`);
}

function setLogExpanded(expanded) {
    if (!logContainer || !logExpandBtn) return;

    document.body.classList.toggle('log_expanded', expanded);
    logExpandBtn.setAttribute('aria-label', expanded ? 'Log verkleinern' : 'Log vergrößern');
    logExpandBtn.title = expanded ? 'Log verkleinern' : 'Log vergrößern';
    if (logExpandIcon) logExpandIcon.textContent = expanded ? 'collapse_content' : 'expand_content';

    if (expanded) updateExpandedLogTop();
}

logExpandBtn?.addEventListener('click', () => {
    setLogExpanded(!document.body.classList.contains('log_expanded'));
});

window.addEventListener('resize', () => {
    if (document.body.classList.contains('log_expanded')) updateExpandedLogTop();
});

const expandedResizeHandle = document.getElementById('expanded_resize_handle');

let expandedResizeActive = false;
let resizeStartMouseY = 0;
let resizeStartSplitPx = 0;

expandedResizeHandle?.addEventListener('pointerdown', (event) => {
    if (!document.body.classList.contains('log_expanded')) return;

    expandedResizeActive = true;

    // Mausposition beim Start merken
    resizeStartMouseY = event.clientY;

    // Aktuelle echte Position des Handles merken
    const handleRect = expandedResizeHandle.getBoundingClientRect();

    const heading = document.querySelector('body > h1');
    const workspaceTop = heading
        ? heading.getBoundingClientRect().bottom
        : 0;

    resizeStartSplitPx =
        handleRect.top +
        (handleRect.height / 2) -
        workspaceTop;

    expandedResizeHandle.setPointerCapture?.(event.pointerId);

    document.body.style.cursor = 'row-resize';

    event.preventDefault();
});


window.addEventListener('pointermove', (event) => {
    if (!expandedResizeActive) return;

    const heading = document.querySelector('body > h1');

    const workspaceTop = heading
        ? heading.getBoundingClientRect().bottom
        : 0;

    const bottomPadding = 15;

    const availableHeight =
        window.innerHeight -
        workspaceTop -
        bottomPadding;

    if (availableHeight <= 0) return;

    // Wie weit wurde die Maus tatsächlich bewegt?
    const deltaY =
        event.clientY - resizeStartMouseY;

    // Aktuelle Splitposition + nur die Mausbewegung
    let newSplit =
        resizeStartSplitPx + deltaY;

    // Mindesthöhe oben/unten
    const minPanelHeight = Math.min(
        180,
        availableHeight * 0.3
    );

    newSplit = Math.max(
        minPanelHeight,
        Math.min(
            availableHeight - minPanelHeight,
            newSplit
        )
    );

    // WICHTIG:
    // jetzt direkt px statt Prozent
    document.body.style.setProperty(
        '--expanded-split',
        `${newSplit}px`
    );
});


function stopExpandedResize() {
    if (!expandedResizeActive) return;

    expandedResizeActive = false;
    document.body.style.cursor = '';
}


window.addEventListener(
    'pointerup',
    stopExpandedResize
);

window.addEventListener(
    'pointercancel',
    stopExpandedResize
);

const throwsLogBody = document.getElementById('throws_log_body');
const logEmptyState = document.getElementById('log_empty_state');
const logPlayerHeader = document.getElementById('log_player_header');

let currentDocumentTeamId = null;
let currentDocumentFilename = null;
let logPlayerSortDirection = null; // null = Standard, asc/desc = Spieler sortiert

function normalizeDocumentName(name) {
    return String(name || '')
        .toLowerCase()
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-z0-9äöüß]+/g, '');
}

function findTeamForDocument(filename) {
    const normalizedFilename = normalizeDocumentName(filename);
    if (!normalizedFilename) return null;

    const teams = Object.values(teamsById);

    // Erst exakte Übereinstimmung versuchen, danach Teilübereinstimmung.
    let team = teams.find(t => normalizeDocumentName(t.name) === normalizedFilename);
    if (!team) {
        team = teams.find(t => {
            const teamName = normalizeDocumentName(t.name);
            return teamName && (normalizedFilename.includes(teamName) || teamName.includes(normalizedFilename));
        });
    }

    return team || null;
}

function updateLogEmptyState() {
    const hasDocument = !!currentDocumentFilename;
    logEmptyState.style.display = hasDocument ? 'none' : 'flex';
    document.querySelector('.goal_container.log .log_header_wrapper').style.display = hasDocument ? 'block' : 'none';
    document.querySelector('.goal_container.log .log_table_wrapper').style.display = hasDocument ? 'block' : 'none';
}

function renderThrowsLog(data) {
    throwsLogBody.innerHTML = '';

    let rows = [...data];

    if (logPlayerSortDirection) {
        rows.sort((a, b) => {
            const nameA = a.players?.name || '';
            const nameB = b.players?.name || '';
            const numberA = Number(a.players?.jersey_number ?? 9999);
            const numberB = Number(b.players?.jersey_number ?? 9999);

            const nameCompare = nameA.localeCompare(nameB, 'de', {
                sensitivity: 'base'
            });

            if (nameCompare !== 0) {
                return logPlayerSortDirection === 'asc'
                    ? nameCompare
                    : -nameCompare;
            }

            const numberCompare = numberA - numberB;

            return logPlayerSortDirection === 'asc'
                ? numberCompare
                : -numberCompare;
        });
    }

    if (logVideoSortDirection) {
        rows.sort((a, b) => {

            // Erst nach Game sortieren
            const gameA = a.game || '';
            const gameB = b.game || '';

            const gameCompare = gameA.localeCompare(
                gameB,
                'de',
                { numeric: true, sensitivity: 'base' }
            );

            if (gameCompare !== 0) {
                return logVideoSortDirection === 'asc'
                    ? gameCompare
                    : -gameCompare;
            }

            // Bei gleichem Game nach Video-Zeit sortieren
            const videoA =
                a.video_timestamp !== null &&
                a.video_timestamp !== undefined
                    ? Number(a.video_timestamp)
                    : Infinity;

            const videoB =
                b.video_timestamp !== null &&
                b.video_timestamp !== undefined
                    ? Number(b.video_timestamp)
                    : Infinity;

            return logVideoSortDirection === 'asc'
                ? videoA - videoB
                : videoB - videoA;
        });
    }

    rows.forEach(row => {
        const time = new Date(row.created_at).toLocaleTimeString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const teamName = row.teams?.name || '–';
        const playerName = row.players
            ? `#${row.players.jersey_number} ${row.players.name}`
            : '–';

        const cornerText = cornerLabels[row.corner] || row.corner || '–';
        const goalText = row.is_goal ? 'Tor' : 'Kein Tor';
        const positionText = row.position || '–';
        const noteText = row.note || '';
        const gameText = row.game || '-';

        const videoTimeText =
            row.video_timestamp !== null &&
            row.video_timestamp !== undefined
                ? formatTime(row.video_timestamp)
                : '-';

        const tr = document.createElement('tr');
        tr.dataset.throwId = row.id;

        tr.innerHTML = `
            <td>${time}</td>
            <td>${teamName}</td>
            <td>${playerName}</td>
            <td>${cornerText}</td>
            <td>${goalText}</td>
            <td>${positionText}</td>
            <td>${noteText || '-'}</td>
            <td>${videoTimeText} (${gameText})</td>
            <td style="display:flex;gap:5px;">
                <button type="button" class="log_delete_btn log_view_btn" data-id="${row.id}">
                    <span class="material-symbols-outlined white_log">display_add</span>
                </button>
                <button type="button" class="log_delete_btn log_del_btn" data-id="${row.id}">
                    <span class="material-symbols-outlined color_red">delete</span>
                </button>
            </td>
        `;

        throwsLogBody.appendChild(tr);
    });

    wireLogButtons();
}

let logVideoSortDirection = null;

document.getElementById('logVideoSort')?.addEventListener('click', () => {
    logVideoSortDirection =
        logVideoSortDirection === 'asc' ? 'desc' : 'asc';

    // Andere Sortierung ausschalten
    logPlayerSortDirection = null;

    renderThrowsLog(throwsData);
});

async function loadThrowsLog() {
    updateLogEmptyState();

    if (!currentDocumentFilename || !currentDocumentTeamId) {
        throwsData = [];
        throwsLogBody.innerHTML = '';
        return;
    }

    const { data, error } = await supabaseClient
        .from('throws')
        .select('id, corner, is_goal, position, note, game, created_at, video_timestamp, team_id, teams(name, logo_key), players(jersey_number, name, photo_key)')
        .eq('team_id', currentDocumentTeamId)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        console.error('Log konnte nicht geladen werden:', error);
        return;
    }

    throwsData = data || [];
    renderThrowsLog(throwsData);
}

function setCurrentDocument(filename) {
    currentDocumentFilename = filename || null;
    const team = findTeamForDocument(filename);
    currentDocumentTeamId = team?.id || null;
    logPlayerSortDirection = null;
    logPlayerHeader?.classList.remove('active');
    updateLogEmptyState();
    loadThrowsLog();
}

logPlayerHeader?.addEventListener('click', () => {
    if (!currentDocumentFilename || !currentDocumentTeamId) return;

    logPlayerSortDirection = logPlayerSortDirection === 'asc' ? 'desc' : 'asc';
    logPlayerHeader.classList.add('active');
    renderThrowsLog(throwsData);
});

// Initialzustand: Kein Dokument geöffnet
setCurrentDocument(null);

let currentlyViewedThrowId = null;

function clearAllRadios() {
    document.querySelectorAll('input[name="score"]:checked').forEach(r => r.checked = false);
    document.querySelectorAll('input[name="corner"]:checked').forEach(r => r.checked = false);
    document.querySelectorAll('input[name="position"]:checked').forEach(r => r.checked = false);
    goalDashboard.textContent = '';
    cornerDashboard.textContent = '';
    throwDashboard.textContent = '';
    checkFormComplete();
}

document.getElementById('cancel_all_btn').addEventListener('click', () => {
    exitLogViewMode();
});

function wireLogButtons() {
    throwsLogBody.querySelectorAll('.log_view_btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const tr = btn.closest('tr');

            if (currentlyViewedThrowId === id) {
                exitLogViewMode();
                return;
            }

            currentlyViewedThrowId = id;
            document.querySelectorAll('#throws_log_body tr').forEach(r => r.classList.remove('highlighted_row'));
            tr.classList.add('highlighted_row');

            const rowData = throwsData.find(r => String(r.id) === String(id));
            if (rowData) applyThrowView(rowData);
        });
    });

    throwsLogBody.querySelectorAll('.log_del_btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;

            const confirmDelete = await showConfirmCustom(
                'log_confirm_overlay', 'log_confirm_text', 'log_confirm_yes', 'log_confirm_no',
                'Eintrag wirklich löschen?'
            );
            if (!confirmDelete) return;

            const { error } = await supabaseClient.from('throws').delete().eq('id', id);

            if (error) {
                console.error('Löschen fehlgeschlagen:', error);
                alert('Fehler beim Löschen: ' + error.message);
                return;
            }

            if (currentlyViewedThrowId === id) exitLogViewMode();
            await loadThrowsLog();
        });
    });
}

function showConfirmCustom(overlayId, textId, yesId, noId, message) {
    return new Promise((resolve) => {
        const overlay = document.getElementById(overlayId);
        const text = document.getElementById(textId);
        const btnYes = document.getElementById(yesId);
        const btnNo = document.getElementById(noId);

        text.textContent = message;
        overlay.classList.add('active');

        function cleanup(result) {
            overlay.classList.remove('active');
            btnYes.removeEventListener('click', onYes);
            btnNo.removeEventListener('click', onNo);
            resolve(result);
        }
        function onYes() { cleanup(true); }
        function onNo() { cleanup(false); }

        btnYes.addEventListener('click', onYes);
        btnNo.addEventListener('click', onNo);
    });
}

function applyThrowView(row) {
    clearAllRadios();

    const scoreRadio = document.querySelector(`input[name="score"][value="${row.is_goal ? 'goal' : 'nogoal'}"]`);
    if (scoreRadio) scoreRadio.checked = true;
    goalDashboard.textContent = row.is_goal ? 'Tor' : 'Kein Tor';

    const cornerRadio = document.querySelector(`input[name="corner"][value="${row.corner}"]`);
    if (cornerRadio) cornerRadio.checked = true;
    cornerDashboard.textContent = cornerLabels[row.corner] || '';

    document.querySelectorAll('.position-radio').forEach(r => r.classList.remove('pos_visible'));

    const posRadio = document.querySelector(`input[name="position"][value="${row.position}"]`);
    if (posRadio) {
        posRadio.checked = true;
        posRadio.classList.add('pos_visible');
    }
    throwDashboard.textContent = row.position || '';

    playerPhoto.src = row.players?.photo_key ? getPlayerPhotoUrl(row.players.photo_key) : getPlayerPhotoUrl('blank1');
    opponentLogo.src = row.teams?.logo_key ? getLogoUrl(row.teams.logo_key) : getLogoUrl('blank');

    document.querySelector('.goal_container.dashboard').classList.add('locked_view');

    if (row.video_timestamp !== null && row.video_timestamp !== undefined) {
        openVideoForThrow(row).catch(error => console.error('Video konnte nicht geoeffnet werden:', error));
    }}

function exitLogViewMode() {
    currentlyViewedThrowId = null;

    document.querySelectorAll('#throws_log_body tr')
        .forEach(tr => tr.classList.remove('highlighted_row'));

    document.querySelector('.goal_container.dashboard')
        .classList.remove('locked_view');

    document.querySelectorAll('.position-radio')
        .forEach(r => r.classList.remove('pos_visible'));

    playerPhoto.src = getPlayerPhotoUrl('blank1');

    // Teamlogo nur zurücksetzen, wenn wirklich kein Team ausgewählt ist
    const selectedTeamId = teamSelect.value;
    const selectedTeam = teamsById[selectedTeamId];

    if (selectedTeam) {
        opponentLogo.src = getLogoUrl(selectedTeam.logo_key);
    } else {
        opponentLogo.src = getLogoUrl('blank');
    }

    clearAllRadios();
}

// ===== VIDEO-PERSISTENZ (IndexedDB), je Spiel ein Video =====
const VIDEO_DB_NAME='videoStorage',VIDEO_STORE_NAME='localVideo';
function openVideoDB(){return new Promise((ok,no)=>{const r=indexedDB.open(VIDEO_DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(VIDEO_STORE_NAME))r.result.createObjectStore(VIDEO_STORE_NAME)};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
function gameKey(g){return 'game:'+String(g||'').trim().toLocaleLowerCase('de-DE')}
async function saveVideoToDB(file,game){if(!game)return;const db=await openVideoDB();return new Promise((ok,no)=>{const tx=db.transaction(VIDEO_STORE_NAME,'readwrite');tx.objectStore(VIDEO_STORE_NAME).put({file,game},gameKey(game));tx.oncomplete=ok;tx.onerror=()=>no(tx.error)})}
async function loadVideoByGame(game){const db=await openVideoDB();return new Promise((ok,no)=>{const r=db.transaction(VIDEO_STORE_NAME,'readonly').objectStore(VIDEO_STORE_NAME).get(gameKey(game));r.onsuccess=()=>ok(r.result||null);r.onerror=()=>no(r.error)})}
async function loadAllVideosFromDB(){const db=await openVideoDB();return new Promise((ok,no)=>{const r=db.transaction(VIDEO_STORE_NAME,'readonly').objectStore(VIDEO_STORE_NAME).getAll();r.onsuccess=()=>ok((r.result||[]).filter(x=>x?.file&&x?.game));r.onerror=()=>no(r.error)})}
async function clearVideoFromDB(game){const db=await openVideoDB();return new Promise((ok,no)=>{const tx=db.transaction(VIDEO_STORE_NAME,'readwrite');tx.objectStore(VIDEO_STORE_NAME).delete(gameKey(game));tx.oncomplete=ok;tx.onerror=()=>no(tx.error)})}
async function openVideoForThrow(row){if(!row?.game)return false;const n=String(row.game).trim().toLocaleLowerCase('de-DE');let i=videoSlots.findIndex(v=>String(v.game||'').trim().toLocaleLowerCase('de-DE')===n);if(i<0){const saved=await loadVideoByGame(row.game);if(!saved?.file){alert(`Kein gespeichertes Video fuer "${row.game}" gefunden.`);return false}videoSlots.push({file:saved.file,game:saved.game||row.game,url:null,time:0});i=videoSlots.length-1}const videoBtn=document.querySelector('.video_switch_btn[data-view="video"]');if(videoBtn&&!videoBtn.classList.contains('active'))videoBtn.click();await switchVideo(i,row.video_timestamp??0);return true}

// ===== STATISTIK =====
const statTeamSelect = document.getElementById('stat_team_select');
const statPlayerSelect = document.getElementById('stat_player_select');
const statPositionSelect = document.getElementById('stat_position_select');
const statGoalSelect = document.getElementById('stat_goal_select');

async function loadStatFilters() {
    const { data: teams } = await supabaseClient.from('teams').select('*').order('name');
    (teams || []).forEach(team => {
        const opt = document.createElement('option');
        opt.value = team.id;
        opt.textContent = team.name;
        statTeamSelect.appendChild(opt);
    });
}

async function loadStatPlayersForTeam(teamId) {
    statPlayerSelect.innerHTML = '<option value="">Alle Spieler</option>';
    if (!teamId) return;

    const { data: players } = await supabaseClient
        .from('players')
        .select('*')
        .eq('team_id', teamId)
        .order('jersey_number');

    (players || []).forEach(player => {
        const opt = document.createElement('option');
        opt.value = player.id;
        opt.textContent = `#${player.jersey_number} ${player.name}`;
        statPlayerSelect.appendChild(opt);
    });
}

statTeamSelect.addEventListener('change', async () => {
    await loadStatPlayersForTeam(statTeamSelect.value);
    loadStats();
});
statPlayerSelect.addEventListener('change', loadStats);
statPositionSelect.addEventListener('change', loadStats);
statGoalSelect.addEventListener('change', loadStats);

document.getElementById('stat_reset_btn').addEventListener('click', async () => {
    statTeamSelect.value = '';
    await loadStatPlayersForTeam('');
    statPositionSelect.value = '';
    statGoalSelect.value = '';
    loadStats();
});

async function loadStats() {
    let query = supabaseClient.from('throws').select('corner, is_goal, position, team_id, player_id');

    if (statTeamSelect.value) query = query.eq('team_id', statTeamSelect.value);
    if (statPlayerSelect.value) query = query.eq('player_id', statPlayerSelect.value);
    if (statPositionSelect.value) query = query.eq('position', statPositionSelect.value);
    if (statGoalSelect.value === 'goal') query = query.eq('is_goal', true);
    if (statGoalSelect.value === 'nogoal') query = query.eq('is_goal', false);

    const { data, error } = await query;

    if (error) {
        console.error('Statistik konnte nicht geladen werden:', error);
        return;
    }

    renderStatsSummary(data);
    renderHeatmap(data);
    renderPositionList(data);
    populateStatPositionOptions(data);
}

function renderStatsSummary(data) {
    const total = data.length;
    const goals = data.filter(r => r.is_goal).length;
    const percent = total > 0 ? Math.round((goals / total) * 100) : 0;

    document.getElementById('stat_total').textContent = total;
    document.getElementById('stat_goals').textContent = goals;
    document.getElementById('stat_percent').textContent = percent + '%';
}

function renderHeatmap(data) {
    const counts = {};
    data.forEach(row => {
        if (!row.corner) return;
        counts[row.corner] = (counts[row.corner] || 0) + 1;
    });

    const max = Math.max(1, ...Object.values(counts));

    document.querySelectorAll('.heatmap_cell').forEach(cell => {
        const corner = cell.dataset.corner;
        const count = counts[corner] || 0;
        const intensity = count / max;

        cell.textContent = count > 0 ? count : '';
        cell.style.background = count > 0
            ? `rgba(250, 112, 0, ${0.15 + intensity * 0.7})`
            : '#ffffff10';
    });
}

function renderPositionList(data) {
    const counts = {};
    data.forEach(row => {
        if (!row.position) return;
        counts[row.position] = (counts[row.position] || 0) + 1;
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const max = Math.max(1, ...sorted.map(([, c]) => c));

    const container = document.getElementById('stats_position_list');
    container.innerHTML = '';

    if (sorted.length === 0) {
        container.innerHTML = '<p style="font-size:12px; color:#ffffff66;">Keine Daten</p>';
        return;
    }

    sorted.forEach(([position, count]) => {
        const row = document.createElement('div');
        row.className = 'stats_position_row';
        row.innerHTML = `
            <span class="stats_position_name">${position}</span>
            <div class="stats_position_bar_track">
                <div class="stats_position_bar_fill" style="width: ${(count / max) * 100}%;"></div>
            </div>
            <span class="stats_position_count">${count}</span>
        `;
        container.appendChild(row);
    });
}

function populateStatPositionOptions(data) {
    if (statPositionSelect.options.length > 1) return; // nur einmal befüllen

    const positions = [...new Set(data.map(r => r.position).filter(Boolean))].sort();
    positions.forEach(pos => {
        const opt = document.createElement('option');
        opt.value = pos;
        opt.textContent = pos;
        statPositionSelect.appendChild(opt);
    });
}

loadStatFilters();
loadStats();

// ==========================================
// APPLE NOTIZEN / TEILEN
// ==========================================

async function shareNote() {
    const editor = document.getElementById("doc_editable");

    if (!editor) {
        console.error("Element #doc_editable wurde nicht gefunden.");
        return;
    }

    // HTML und reinen Text aus dem Editor holen
    const html = editor.innerHTML.trim();
    const text = editor.innerText.trim();

    if (!text) {
        alert("Die Notiz ist leer.");
        return;
    }

    // Web Share API prüfen
    if (!navigator.share) {
        // Fallback: Text in die Zwischenablage kopieren
        try {
            await navigator.clipboard.writeText(text);
            alert("Der Text wurde in die Zwischenablage kopiert.");
        } catch (error) {
            console.error("Kopieren fehlgeschlagen:", error);
            alert("Teilen wird auf diesem Gerät nicht unterstützt.");
        }

        return;
    }

    try {
        await navigator.share({
            title: "Meine Notiz",
            text: text
        });
    } catch (error) {
        // Abbruch durch den Benutzer ist kein Fehler
        if (error.name !== "AbortError") {
            console.error("Teilen fehlgeschlagen:", error);
        }
    }
}

(async () => {
    try {
        const saved=await loadAllVideosFromDB();
        if(saved.length){videoSlots=saved.map(v=>({file:v.file,game:v.game,url:null,time:0}));activeVideoSlot=0;await switchVideo(0)}
    } catch(error){console.error('Videos konnten nicht geladen werden:',error)}
})();