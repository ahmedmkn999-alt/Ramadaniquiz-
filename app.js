// إعدادات Firebase
const firebaseConfig = { 
    apiKey: "AIzaSyBZMnIJ_IOqeAfXqFt-m4tM1Lvo0tUDnk8", 
    projectId: "ramadan-87817", 
    appId: "1:343525703258:web:6776b4857425df8bcca263" 
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// 1. نظام كشف التثبيت (الـ Guard)
function checkInstallation() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    const guard = document.getElementById('install-guard');
    const app = document.getElementById('app-content');

    if (!isStandalone) {
        guard.style.display = 'flex';
        // كشف نوع الجهاز
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIOS) document.getElementById('ios-inst').classList.remove('hidden');
        else document.getElementById('android-btn').classList.remove('hidden');
    } else {
        guard.style.display = 'none';
        app.classList.remove('opacity-0');
        loadAppData(); // ابدأ تحميل البيانات لو مثبت
    }
}

// 2. تحميل البيانات
let currentUser = null;
function loadAppData() {
    // افترضنا إن الكود متخزن في المتصفح بعد أول تسجيل دخول
    const userPass = localStorage.getItem('user_pass');
    if(!userPass) {
        const pass = prompt("دخل كود الدخول الخاص بك:");
        if(pass) localStorage.setItem('user_pass', pass);
        window.location.reload();
        return;
    }

    // مراقبة بيانات المستخدم
    db.collection("users").where("password", "==", userPass).onSnapshot(snap => {
        if(!snap.empty) {
            currentUser = { id: snap.docs[0].id, ...snap.docs[0].data() };
            document.getElementById('u-name').innerText = currentUser.name;
            document.getElementById('u-team').innerText = currentUser.team;
            document.getElementById('u-score').innerText = currentUser.score;
            loadRanking(currentUser.group);
        }
    });

    // مراقبة حالة الجولات (اللي إنت بتفتحها من اللوحة)
    db.collection("settings").doc("map_config").onSnapshot(doc => {
        if(doc.exists) renderRounds(doc.data());
    });
}

function renderRounds(config) {
    const container = document.getElementById('rounds-container');
    container.innerHTML = "";
    
    // هنعرض 30 جولة
    for(let i=1; i<=30; i++) {
        const status = config[`round_${i}`] || 'locked'; // locked, active, done
        let cardHTML = '';

        if(status === 'active') {
            cardHTML = `
            <div class="premium-card active-round p-5 flex justify-between items-center" onclick="startQuiz(${i})">
                <div>
                    <h3 class="font-black text-lg">الجولة ${i}</h3>
                    <p class="text-yellow-500 text-xs font-bold">العب الآن! ▶️</p>
                </div>
                <div class="play-btn shadow-[0_0_15px_#d4af37]"><i class="fas fa-play"></i></div>
            </div>`;
        } else if(status === 'done') {
            cardHTML = `
            <div class="premium-card p-5 flex justify-between items-center opacity-80">
                <h3 class="font-bold text-gray-300">الجولة ${i}</h3>
                <i class="fas fa-check-circle text-green-500 text-xl"></i>
            </div>`;
        } else {
            cardHTML = `
            <div class="premium-card p-5 flex justify-between items-center opacity-40">
                <h3 class="font-bold text-gray-500">الجولة ${i}</h3>
                <i class="fas fa-lock text-gray-600"></i>
            </div>`;
        }
        container.innerHTML += cardHTML;
    }
}

function loadRanking(groupName) {
    db.collection("users").where("group", "==", groupName).orderBy("score", "desc").onSnapshot(snap => {
        const list = document.getElementById('rank-list');
        list.innerHTML = "";
        snap.forEach((doc, i) => {
            const u = doc.data();
            list.innerHTML += `
            <div class="bg-[#111827] p-4 rounded-2xl flex items-center border border-white/5">
                <span class="w-8 font-black text-yellow-500">${i+1}</span>
                <span class="flex-1 font-bold text-sm">${u.name}</span>
                <span class="font-black text-yellow-500">${u.score}</span>
            </div>`;
        });
    });
}

function showTab(tab, btn) {
    document.getElementById('tab-map').classList.toggle('hidden', tab !== 'map');
    document.getElementById('tab-rank').classList.toggle('hidden', tab !== 'rank');
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    btn.classList.add('active');
}

function startQuiz(roundNum) {
    // هنا تحط كود تحويل المتسابق لصفحة الأسئلة
    alert("جارٍ تجهيز أسئلة الجولة " + roundNum);
}

// تشغيل الفحص عند التحميل
window.onload = checkInstallation;

// دعم أندرويد (تنبيه التثبيت)
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('android-btn').addEventListener('click', () => {
        deferredPrompt.prompt();
    });
});
