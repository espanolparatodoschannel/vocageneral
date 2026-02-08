let allFlashcards = []; // Copia original para filtrar
let flashcards = [];    // Lista actual (puede estar filtrada)
let current = 0;
let selectedVoiceName = localStorage.getItem('preferredVoice');
const searchInput = document.getElementById('searchInput');
const categorySelect = document.getElementById('categorySelect');

// Cargar datos
async function init() {
    try {
        const response = await fetch('vocabulario.json');
        allFlashcards = await response.json();

        // Ordenar alfabéticamente una sola vez al inicio
        allFlashcards.sort((a, b) =>
            a["Término en francés"].localeCompare(b["Término en francés"], 'fr', { sensitivity: 'base' })
        );

        flashcards = [...allFlashcards];
        populateCategories();
        showCard(0);
    } catch (error) {
        console.error('Error cargando JSON:', error);
        const cardElement = document.getElementById('flashcard');
        if (cardElement) {
            cardElement.innerHTML = '<p style="color:red">Error al cargar datos. Asegúrate de que vocabulario.json exista y esté en la misma carpeta.</p>';
        }
    }
}

function populateCategories() {
    const categorySelect = document.getElementById('categorySelect');
    if (!categorySelect) return;

    const categories = [...new Set(allFlashcards.map(card => card.categoría).filter(Boolean))];
    categories.sort();

    categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        categorySelect.appendChild(opt);
    });
}

function applyFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const selectedCategory = document.getElementById('categorySelect').value;

    flashcards = allFlashcards.filter(card => {
        const matchesSearch = card["Término en francés"].toLowerCase().includes(searchTerm) ||
            card.definiciones.some(d => d["Término en español"].toLowerCase().includes(searchTerm));
        const matchesCategory = selectedCategory === 'all' || card.categoría === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    current = 0;
    showCard(0);
}

function loadVoices() {
    const voiceSelect = document.getElementById('voiceSelect');
    if (!voiceSelect) return;

    const voices = window.speechSynthesis.getVoices();
    // Filtramos solo voces de francés (de cualquier región)
    const frVoices = voices.filter(v => v.lang.startsWith('fr'));

    // Limpiar selector
    voiceSelect.innerHTML = '';

    if (frVoices.length === 0) {
        const opt = document.createElement('option');
        opt.textContent = 'No se encontraron voces francesas';
        voiceSelect.appendChild(opt);
        return;
    }

    // Ordenar voces: primero las que parecen más naturales o premium (Google, Natural, Online)
    frVoices.sort((a, b) => {
        const score = (v) => {
            let s = 0;
            const name = v.name.toLowerCase();
            if (name.includes('google')) s += 10;
            if (name.includes('natural')) s += 8;
            if (name.includes('online')) s += 5;
            if (name.includes('ca')) s += 2; // Prioridad leve al francés canadiense
            return s;
        };
        return score(b) - score(a);
    });

    frVoices.forEach(voice => {
        const option = document.createElement('option');
        option.value = voice.name;
        // Almacenamos el idioma en un atributo de datos para usarlo al hablar
        option.setAttribute('data-lang', voice.lang);
        option.textContent = `${voice.name} (${voice.lang})`;
        if (voice.name === selectedVoiceName) {
            option.selected = true;
        }
        voiceSelect.appendChild(option);
    });

    // Si no hay voz guardada, elegir la primera (la mejor según nuestro sort)
    if (!selectedVoiceName && frVoices.length > 0) {
        selectedVoiceName = frVoices[0].name;
    }
}

function speak(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);

        const voices = window.speechSynthesis.getVoices();
        const voice = voices.find(v => v.name === selectedVoiceName) ||
            voices.find(v => v.lang.startsWith('fr'));

        if (voice) {
            utter.voice = voice;
            utter.lang = voice.lang; // Forzar fonética del idioma de la voz
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
    if (!container) return;

    const randomRot = (Math.random() - 0.5) * 10;
    container.style.transform = `rotateY(${randomRot}deg) translateY(10px) scale(0.95)`;
    container.classList.add('fade-out');

    setTimeout(() => {
        if (!flashcards.length) {
            container.innerHTML = '<div class="no-results">❌ No se encontraron términos con esos filtros.</div>';
            document.getElementById('counter').textContent = `0 / 0`;
            container.style.transform = '';
            container.classList.remove('fade-out');
            return;
        }

        const card = flashcards[idx];
        const terminoFr = card["Término en francés"];
        const palabraEscaped = terminoFr.replace(/'/g, "\\'");

        let html = `
            <button class="sound-btn-main" onclick="speak('${palabraEscaped}')" title="Escuchar término">🔊</button>
            <div class="word-fr">${terminoFr}</div>
        `;

        if (card.categoría) {
            html += `<div style="font-size: 0.75rem; opacity: 0.5; margin-bottom: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">${card.categoría}</div>`;
        }

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
        container.style.transform = '';
        container.classList.remove('fade-out');
        document.getElementById('counter').textContent = `${idx + 1} / ${flashcards.length}`;
    }, 400);
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

    // Cerrar popup al hacer clic fuera
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
            // Probar la voz
            speak("Bonjour");
        });
    }

    // Inicializar voces
    if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
        loadVoices();
    }

    // Eventos de Filtro
    const searchInput = document.getElementById('searchInput');
    const categorySelect = document.getElementById('categorySelect');

    if (searchInput) {
        searchInput.addEventListener('input', applyFilters);
    }
    if (categorySelect) {
        categorySelect.addEventListener('change', applyFilters);
    }

    init();
});
