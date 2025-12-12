import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

/*********************
 * Firebase config (사용자 제공)
 *********************/
const firebaseConfig = {
  apiKey: "AIzaSyBpeQgsKUE6PJ_d5E5kmzMYMyNR4fFdsjs",
  authDomain: "game-df2be.firebaseapp.com",
  projectId: "game-df2be",
  storageBucket: "game-df2be.firebasestorage.app",
  messagingSenderId: "624217836274",
  appId: "1:624217836274:web:cdf945d27dff44821f1e6b",
  measurementId: "G-86L2CM11S1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/*********************
 * DOM
 *********************/
const gridEl = document.getElementById("grid");
const timeNowEl = document.getElementById("timeNow");
const timeBestEl = document.getElementById("timeBest");
const nextNumEl = document.getElementById("nextNum");
const toastEl = document.getElementById("toast");

const btnRestart = document.getElementById("btnRestart");
const btnHow = document.getElementById("btnHow");

/*********************
 * Storage keys
 *********************/
const LS_BEST_SEC = "numberGame_bestSec_v1";
const LS_DEVICE = "numberGame_deviceId_v1";

/*********************
 * State
 *********************/
const state = {
  next: 1,
  started: false,
  startAt: 0,
  raf: 0,
  bestSec: null,
  numbers: [],
  doneSet: new Set(),
  completed: false,
};

function getDeviceId() {
  let id = localStorage.getItem(LS_DEVICE);
  if (!id) {
    id = "dev_" + Math.random().toString(36).slice(2) + "_" + Date.now().toString(36);
    localStorage.setItem(LS_DEVICE, id);
  }
  return id;
}

function formatSec(sec) {
  return sec.toFixed(2) + "s";
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.remove("show"), 1200);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function loadBest() {
  const v = localStorage.getItem(LS_BEST_SEC);
  state.bestSec = v ? Number(v) : null;
  timeBestEl.textContent = state.bestSec != null ? formatSec(state.bestSec) : "--";
}

function saveBestLocal(sec) {
  localStorage.setItem(LS_BEST_SEC, String(sec));
  state.bestSec = sec;
  timeBestEl.textContent = formatSec(sec);
}

function stopTimer() {
  cancelAnimationFrame(state.raf);
  state.raf = 0;
}

function tick() {
  if (!state.started) return;
  const now = performance.now();
  const sec = (now - state.startAt) / 1000;
  timeNowEl.textContent = formatSec(sec);
  state.raf = requestAnimationFrame(tick);
}

function startTimerIfNeeded() {
  if (state.started) return;
  state.started = true;
  state.startAt = performance.now();
  tick();
}

function renderGrid() {
  gridEl.innerHTML = "";
  for (const n of state.numbers) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.textContent = String(n);
    cell.dataset.num = String(n);

    if (n === state.next) cell.classList.add("next");

    cell.addEventListener("click", () => onPressNumber(n));
    gridEl.appendChild(cell);
  }
}

function updateCellStyles() {
  const cells = gridEl.querySelectorAll(".cell");
  cells.forEach((c) => {
    const n = Number(c.dataset.num);
    c.classList.toggle("done", state.doneSet.has(n));
    c.classList.toggle("next", n === state.next && !state.doneSet.has(n));
  });
}

function resetGame({ reshuffle = true } = {}) {
  stopTimer();
  state.started = false;
  state.startAt = 0;
  timeNowEl.textContent = "0.00s";

  state.next = 1;
  state.completed = false;
  state.doneSet = new Set();

  nextNumEl.textContent = String(state.next);

  const nums = Array.from({ length: 25 }, (_, i) => i + 1);
  state.numbers = reshuffle ? shuffle(nums) : nums;
  renderGrid();
}

async function saveBestToFirestore(bestSec) {
  const deviceId = getDeviceId();
  const ref = doc(db, "number_score", deviceId);

  await setDoc(
    ref,
    {
      deviceId,
      bestSec: Number(bestSec.toFixed(2)), // ✅ 초만 저장
      updatedAt: serverTimestamp(),
      game: "number_1to25",
    },
    { merge: true }
  );
}

async function onFinish(finalSec) {
  stopTimer();
  state.completed = true;

  const isNewBest = state.bestSec == null || finalSec < state.bestSec;

  if (isNewBest) {
    saveBestLocal(finalSec);
    showToast("🎉 신기록! " + formatSec(finalSec));
    try {
      await saveBestToFirestore(finalSec);
      // showToast("클라우드 저장됨");
    } catch (err) {
      console.error(err);
      showToast("Firestore 저장 실패");
    }
  } else {
    showToast("완료! " + formatSec(finalSec));
  }
}

function onPressNumber(n) {
  if (state.completed) return;

  // 정답
  if (n === state.next) {
    if (n === 1) startTimerIfNeeded();

    state.doneSet.add(n);
    state.next += 1;

    nextNumEl.textContent = state.next <= 25 ? String(state.next) : "완료!";
    updateCellStyles();

    if (n === 25) {
      const finalSec = (performance.now() - state.startAt) / 1000;
      timeNowEl.textContent = formatSec(finalSec);
      onFinish(finalSec);
    }
    return;
  }

  // 오답: 진행만 1부터 다시 (추가 벌점 없음)
  state.doneSet.clear();
  state.next = 1;
  nextNumEl.textContent = "1";
  updateCellStyles();
  showToast("오답! 1부터 다시");
}

/*********************
 * Events
 *********************/
btnRestart.addEventListener("click", () => {
  resetGame({ reshuffle: true });
  showToast("리셋 & 섞기");
});

btnHow.addEventListener("click", () => {
  showToast("1→25 순서 클릭! 오답이면 1부터 다시");
});

/*********************
 * Init
 *********************/
loadBest();
resetGame({ reshuffle: true });
getDeviceId();
