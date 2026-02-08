let flashcards = [];
let current = 0;
let currentMode = 'study'; // 'study' | 'quiz'
let selectedVoiceName = localStorage.getItem('preferredVoice');

// Cargar datos
async function init() {
    try {
        const response = await fetch('vocabulario.json');
        flashcards = await response.json();

        // Ordenar alfabéticamente por término francés
        flashcards.sort((a, b) =>
            a["Término en francés"].localeCompare(b["Término en francés"], 'fr', { sensitivity: 'base' })
        );

        showCard(0);
    } catch (error) {
        console.error('Error cargando JSON:', error);
        const cardElement = document.getElementById('flashcard');
        if (cardElement) {
            cardElement.innerHTML = '<p style="color:red">Error al cargar datos. </p>';
        }
    }
}

function loadVoices() {
    const voiceSelect = document.getElementById('voiceSelect');
    if (!voiceSelect) return;

    const voices = window.speechSynthesis.getVoices();
    const frVoices = voices.filter(v => v.lang.startsWith('fr'));
    voiceSelect.innerHTML = '';

    if (frVoices.length === 0) {
        const opt = document.createElement('option');
        opt.textContent = 'No se encontraron voces francesas';
        voiceSelect.appendChild(opt);
        return;
    }

    frVoices.sort((a, b) => {
        const score = (v) => {
            let s = 0;
            const name = v.name.toLowerCase();
            if (name.includes('google')) s += 10;
            if (name.includes('natural')) s += 8;
            if (name.includes('ca')) s += 2;
            return s;
        };
        return score(b) - score(a);
    });

    frVoices.forEach(voice => {
        const option = document.createElement('option');
        option.value = voice.name;
        option.textContent = `${voice.name} (${voice.lang})`;
        if (voice.name === selectedVoiceName) option.selected = true;
        voiceSelect.appendChild(option);
    });

    if (!selectedVoiceName && frVoices.length > 0) selectedVoiceName = frVoices[0].name;
}

function speak(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        const voice = voices.find(v => v.name === selectedVoiceName) || voices.find(v => v.lang.startsWith('fr'));

        if (voice) {
            utter.voice = voice;
            utter.lang = voice.lang;
        } else {
            utter.lang = 'fr-FR';
        }
        utter.rate = 0.9;
        window.speechSynthesis.speak(utter);
    }
}

function showCard(idx) {
    if (!flashcards.length) return;
    const card = flashcards[idx];
    const container = document.getElementById('flashcard');
    const quizContainer = document.getElementById('quizOptions');
    if (!container || !quizContainer) return;

    container.classList.add('fade-out');
    quizContainer.classList.add('hidden');
    quizContainer.innerHTML = '';

    setTimeout(() => {
        const terminoFr = card["Término en francés"];
        const palabraEscaped = terminoFr.replace(/'/g, "\\'");

        if (currentMode === 'study') {
            let html = `
                <button class="sound-btn-main" onclick="speak('${palabraEscaped}')" title="Escuchar término">🔊</button>
                <div class="word-fr">${terminoFr}</div>
            `;
            if (card.definiciones) {
                card.definiciones.forEach((def, i) => {
                    if (i > 0) html += '<hr>';
                    const oracionEscaped = def["Ejemplo en francés"].replace(/'/g, "\\'");
                    html += `
                        <div class="def-container">
                            <div class="word-es">${def["Término en español"]}</div>
                            <div class="sentence-group">
                                <div class="sentence-fr-row">
                                    <span>${def["Ejemplo en francés"]}</span>
                                    <button class="mini-sound-btn" onclick="speak('${oracionEscaped}')" title="Escuchar ejemplo">🗣️</button>
                                </div>
                                <div class="sentence-es">${def["Ejemplo en español"]}</div>
                            </div>
                        </div>
                    `;
                });
            }
            container.innerHTML = html;
        } else {
            // QUIZ MODE
            container.innerHTML = `
                <button class="sound-btn-main" onclick="speak('${palabraEscaped}')" title="Escuchar término">🔊</button>
                <div class="word-fr">${terminoFr}</div>
                <div style="margin-top:20px; font-size: 0.9rem; opacity: 0.7;">¿Cuál es la traducción correcta?</div>
            `;
            generateQuizOptions(card);
            quizContainer.classList.remove('hidden');
        }

        container.style.transform = '';
        container.classList.remove('fade-out');
        document.getElementById('counter').textContent = `${idx + 1} / ${flashcards.length}`;
    }, 400);
}

function generateQuizOptions(correctCard) {
    const quizContainer = document.getElementById('quizOptions');
    const correctTranslation = correctCard.definiciones[0]["Término en español"];

    // Obtener distractores aleatorios
    let distractors = flashcards
        .filter(c => c["Término en francés"] !== correctCard["Término en francés"])
        .map(c => c.definiciones[0]["Término en español"]);

    // Mezclar y tomar 3
    distractors = distractors.sort(() => 0.5 - Math.random()).slice(0, 3);

    // Lista final de opciones
    const options = [correctTranslation, ...distractors].sort(() => 0.5 - Math.random());

    options.forEach(opt => {
        const btn = document.createElement('div');
        btn.className = 'quiz-option';
        btn.textContent = opt;
        btn.onclick = () => checkAnswer(opt, btn, correctTranslation);
        quizContainer.appendChild(btn);
    });
}

function checkAnswer(selected, element, correct) {
    const options = document.querySelectorAll('.quiz-option');
    if (element.classList.contains('checked')) return;

    options.forEach(opt => opt.classList.add('checked'));

    if (selected === correct) {
        element.classList.add('correct');
        // Sonido sutil de éxito (opcional, por ahora solo visual)
    } else {
        element.classList.add('incorrect');
        // Mostrar la correcta también
        options.forEach(opt => {
            if (opt.textContent === correct) opt.classList.add('correct');
        });
    }

    // Pasar a la siguiente después de un breve delay si acertó
    if (selected === correct) {
        setTimeout(nextCard, 1500);
    }
}

function nextCard() {
    if (!flashcards.length) return;
    current = (current + 1) % flashcards.length;
    showCard(current);
}

function prevCard() {
    if (!flashcards.length) return;
    current = (current - 1 + flashcards.length) % flashcards.length;
    showCard(current);
}

function randomCard() {
    if (flashcards.length < 2) return;
    let rand;
    do {
        rand = Math.floor(Math.random() * flashcards.length);
    } while (rand === current);
    current = rand;
    showCard(current);
}

document.addEventListener('DOMContentLoaded', () => {
    // Tema
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌓';
            localStorage.setItem('theme', newTheme);
        });
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
            themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌓';
        }
    }

    // Selector de Modo
    const modeToggle = document.getElementById('modeToggle');
    if (modeToggle) {
        modeToggle.addEventListener('click', () => {
            currentMode = currentMode === 'study' ? 'quiz' : 'study';
            modeToggle.classList.toggle('quiz-active');
            showCard(current);
        });
    }

    // Configuración de Voz
    const voiceSettingsBtn = document.getElementById('voiceSettingsBtn');
    const voiceSelectorPopup = document.getElementById('voiceSelectorPopup');
    const voiceSelect = document.getElementById('voiceSelect');

    if (voiceSettingsBtn) {
        voiceSettingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            voiceSelectorPopup.classList.toggle('active');
        });
    }

    document.addEventListener('click', () => {
        if (voiceSelectorPopup) voiceSelectorPopup.classList.remove('active');
    });

    if (voiceSelectorPopup) {
        voiceSelectorPopup.addEventListener('click', (e) => e.stopPropagation());
    }

    if (voiceSelect) {
        voiceSelect.addEventListener('change', () => {
            selectedVoiceName = voiceSelect.value;
            localStorage.setItem('preferredVoice', selectedVoiceName);
            speak("Bonjour");
        });
    }

    if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
        loadVoices();
    }

    init();
});
