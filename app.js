// --- 1. إعدادات قاعدة البيانات والحماية ---
const firebaseConfig = { 
    apiKey: "AIzaSyBZMnIJ_IOqeAfXqFt-m4tM1Lvo0tUDnk8", 
    projectId: "ramadan-87817", 
    appId: "1:343525703258:web:6776b4857425df8bcca263" 
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let currentUser = null;
let currentDayStatus = 0;
let quizData = [];
let currentQuestionIndex = 0;
let timer;
let timeLeft = 15;
let scoreThisRound = 0;

// وسائل المساعدة
let used5050 = false;
let usedFreeze = false;
let isQuizActive = false;

// --- 2. نظام مكافحة الغش (الجن الأزرق) ---
document.addEventListener('contextmenu', e => e.preventDefault()); // منع كليك يمين
document.addEventListener('keydown', e => {
    // منع اختصارات المطورين (F12, Ctrl+Shift+I, Ctrl+U)
    if(e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I') || (e.ctrlKey && e.key === 'u')) {
        e.preventDefault();
    }
});

// منع تبديل التابات أثناء الكويز
document.addEventListener("visibilitychange", () => {
    if (document.hidden && isQuizActive) {
        punishCheater();
    }
});

function punishCheater() {
    clearInterval(timer);
    isQuizActive = false;
    document.getElementById('cheat-modal').style.display = 'flex';
    // خصم نقطتين كعقاب
    if(currentUser) {
        db.collection("users").doc(currentUser.id).update({
            score: firebase.firestore.FieldValue.increment(-2),
            cheatCount: firebase.firestore.FieldValue.increment(1)
        });
    }
}

// --- 3. إدارة الشاشات وتسجيل الدخول ---
function showScreen(id) {
    document.querySelectorAll('.view-screen').forEach(el => el.classList.remove('active', 'hidden'));
    document.querySelectorAll('.view-screen').forEach(el => el.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.getElementById(id).classList.add('active');
}

window.onload = () => {
    const savedId = localStorage.getItem('player_id');
    if(savedId) {
        fetchUserData(savedId);
    } else {
        showScreen('login-view');
    }
};

function loginUser() {
    const code = document.getElementById('user-code').value.trim();
    if(!code) return alert("اكتب الكود الأول!");
    
    db.collection("users").where("password", "==", code).get().then(snap => {
        if(snap.empty) return alert("الكود غير صحيح!");
        const doc = snap.docs[0];
        localStorage.setItem('player_id', doc.id);
        fetchUserData(doc.id);
    });
}

function fetchUserData(id) {
    db.collection("users").doc(id).onSnapshot(doc => {
        if(!doc.exists) return localStorage.clear(), location.reload();
        currentUser = { id: doc.id, ...doc.data() };
        updateHeader();
        fetchMapData();
    });
}

function updateHeader() {
    document.getElementById('player-name').innerText = currentUser.name;
    document.getElementById('player-group').innerText = currentUser.group + ' | ' + currentUser.team;
    document.getElementById('player-score').innerText = currentUser.score || 0;
    document.getElementById('header-avatar').innerText = currentUser.name.charAt(0);
}

// --- 4. بناء الخريطة والجولات ---
function fetchMapData() {
    db.collection("settings").doc("global_status").get().then(doc => {
        currentDayStatus = doc.exists ? doc.data().currentDay : 1;
        
        db.collection("users").doc(currentUser.id).collection("game_logs").get().then(logsSnap => {
            const playedDays = logsSnap.docs.map(d => d.data().day);
            renderMap(playedDays);
            showScreen('map-view');
        });
    });
}

function renderMap(playedDays) {
    const container = document.getElementById('map-rounds');
    container.innerHTML = '';
    
    // بناء 20 جولة 
    for(let i=1; i<=20; i++) {
        let stateClass = 'round-locked';
        let icon = `<i class="fas fa-lock text-sm"></i>`;
        let action = '';

        if(playedDays.includes(i)) {
            stateClass = 'round-played';
            icon = `<i class="fas fa-check"></i>`;
        } else if(i === currentDayStatus) {
            stateClass = 'round-active';
            icon = i;
            action = `onclick="startQuiz(${i})"`;
        } else if (i < currentDayStatus && !playedDays.includes(i)) {
            // جولة فاتت وماتلعبتش
            stateClass = 'round-locked';
            icon = `<i class="fas fa-times text-red-500"></i>`;
        }

        // تبديل الأماكن يمين ويسار لإعطاء شكل متعرج للخريطة
        const align = i % 2 === 0 ? 'translate-x-12' : '-translate-x-12';

        container.innerHTML += `
            <div class="flex w-full justify-center transform ${align}">
                <div class="round-node ${stateClass}" ${action}>${icon}</div>
            </div>
        `;
    }
}

// --- 5. منطق الكويز ووسائل المساعدة ---
function startQuiz(day) {
    db.collection("quizzes_pool").doc(`day_${day}`).get().then(doc => {
        if(!doc.exists || !doc.data().variations || !doc.data().variations["0"]) {
            return alert("الأسئلة لسه منزلتش يا بطل، ارجع تاني بعدين!");
        }
        // اختيار النسخة الأولى حالياً (ممكن يتطور لاختيار عشوائي)
        quizData = doc.data().variations["0"].questions;
        currentQuestionIndex = 0;
        scoreThisRound = 0;
        used5050 = false;
        usedFreeze = false;
        
        // تصفير أزرار المساعدة
        document.getElementById('btn-5050').classList.remove('opacity-50', 'pointer-events-none');
        document.getElementById('btn-freeze').classList.remove('opacity-50', 'pointer-events-none');
        
        isQuizActive = true;
        showScreen('quiz-view');
        loadQuestion();
    });
}

function loadQuestion() {
    if(currentQuestionIndex >= quizData.length) {
        return finishQuiz();
    }
    
    const q = quizData[currentQuestionIndex];
    document.getElementById('q-current').innerText = currentQuestionIndex + 1;
    document.getElementById('q-total').innerText = quizData.length;
    document.getElementById('question-text').innerText = q.q;
    
    const optsContainer = document.getElementById('options-container');
    optsContainer.innerHTML = '';
    
    q.options.forEach((opt, idx) => {
        optsContainer.innerHTML += `<button class="option-btn" data-idx="${idx}" onclick="selectAnswer(${idx})">${opt}</button>`;
    });
    
    timeLeft = 15;
    updateTimerDisplay();
    clearInterval(timer);
    timer = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        if(timeLeft <= 0) {
            clearInterval(timer);
            currentQuestionIndex++;
            loadQuestion();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const tDisplay = document.getElementById('timer-display');
    tDisplay.innerText = timeLeft;
    if(timeLeft <= 5) tDisplay.classList.add('text-red-500', 'animate-ping');
    else tDisplay.classList.remove('text-red-500', 'animate-ping');
}

function selectAnswer(idx) {
    clearInterval(timer);
    const q = quizData[currentQuestionIndex];
    if(idx === q.correctIndex) {
        scoreThisRound += 10; // 10 نقط لكل إجابة صح
    }
    currentQuestionIndex++;
    loadQuestion();
}

// وسائل المساعدة
function use5050() {
    if(used5050) return;
    used5050 = true;
    document.getElementById('btn-5050').classList.add('opacity-50', 'pointer-events-none');
    
    const q = quizData[currentQuestionIndex];
    const btns = document.querySelectorAll('.option-btn');
    let removed = 0;
    
    btns.forEach((btn, idx) => {
        if(idx !== q.correctIndex && removed < 2) {
            btn.classList.add('disabled', 'opacity-20');
            btn.removeAttribute('onclick');
            removed++;
        }
    });
}

function useFreeze() {
    if(usedFreeze) return;
    usedFreeze = true;
    document.getElementById('btn-freeze').classList.add('opacity-50', 'pointer-events-none');
    timeLeft += 10;
    updateTimerDisplay();
}

function finishQuiz() {
    isQuizActive = false;
    
    // تسجيل النتيجة في الفايربيس
    db.collection("users").doc(currentUser.id).update({
        score: firebase.firestore.FieldValue.increment(scoreThisRound)
    });
    
    db.collection("users").doc(currentUser.id).collection("game_logs").doc(`day_${currentDayStatus}`).set({
        day: currentDayStatus,
        score: scoreThisRound,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        alert(`عاش! خلصت الجولة وجمعت ${scoreThisRound} نقطة 🏆`);
        fetchMapData(); // هيرجع يعرض الخريطة ويحدثها
    });
}

function returnToMap() {
    document.getElementById('cheat-modal').style.display = 'none';
    fetchMapData();
}
