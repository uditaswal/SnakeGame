const gameAudio = new Audio("audio/gameAudio.mp3");
const pointAudio = new Audio("audio/ding.mp3");
const crashAudio = new Audio("audio/Lost_a _Life.mp3");
const gameOverAudio = new Audio("audio/GameOver.mp3");
const sounds = [gameAudio, pointAudio, crashAudio, gameOverAudio];

gameAudio.loop = true;

const page = document.body.dataset.page;
const imgContainer = document.getElementById("imgContainer");
const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
const initialSnakeSpeed = isTouchDevice ? 42 : 34;
const minimumSnakeSpeed = isTouchDevice ? 28 : 20;
const speedIncreaseStep = 1;
const step = 5;

let ball = null;
let headList = [];
let score = readNumber("score");
let duration = readNumber("duration");
let headListLength = readNumber("headListLength", 1);
let direction = localStorage.getItem("direction") || "right";
let snakeSpeed = initialSnakeSpeed;
let gameInterval;
let timerInterval;
let redirectTimer;
let isGameRunning = false;
let touchStartX = 0;
let touchStartY = 0;

function readNumber(key, fallback = 0) {
  const value = Number.parseInt(localStorage.getItem(key), 10);
  return Number.isFinite(value) ? value : fallback;
}

function currentMuteState() {
  return localStorage.getItem("isMuted") === "true";
}

function playAudio(audio) {
  if (currentMuteState()) return;
  const playPromise = audio.play();
  if (playPromise) {
    playPromise.catch(() => {
      // Browsers may block playback until the first user interaction.
    });
  }
}

function pauseAudio(audio, rewind = false) {
  audio.pause();
  if (rewind) audio.currentTime = 0;
}

function muteSounds(isMuted) {
  sounds.forEach((sound) => {
    sound.muted = isMuted;
  });
}

function updateMuteButtonImg(isMuted) {
  const soundImg = document.getElementById("soundImg");
  const soundToggle = document.getElementById("soundToggle");

  if (soundImg) {
    soundImg.src = isMuted ? "img/mute-button.png" : "img/soundon-button.png";
  }
  if (soundToggle) {
    soundToggle.setAttribute("aria-pressed", String(isMuted));
    soundToggle.setAttribute("aria-label", isMuted ? "Turn sound on" : "Mute sound");
  }
}

function toggleMute() {
  const newMuteState = !currentMuteState();
  localStorage.setItem("isMuted", String(newMuteState));
  muteSounds(newMuteState);
  updateMuteButtonImg(newMuteState);

  if (!newMuteState && isGameRunning) playAudio(gameAudio);
}

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const shortTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return hours > 0 ? `${String(hours).padStart(2, "0")}:${shortTime}` : shortTime;
}

function renderStats() {
  const scoreElement = document.getElementById("scorebtn");
  const timerElement = document.getElementById("timer");
  const highScoreElement = document.getElementById("highScorebtn");
  const heroHighScore = document.getElementById("heroHighScore");
  const highScore = readNumber("highScore");

  if (scoreElement) scoreElement.textContent = String(score);
  if (timerElement) timerElement.textContent = formatDuration(duration);
  if (highScoreElement) highScoreElement.textContent = String(highScore);
  if (heroHighScore) heroHighScore.textContent = String(highScore).padStart(2, "0");
}

function updateTimer() {
  if (!isGameRunning) return;
  duration += 1;
  localStorage.setItem("duration", String(duration));
  renderStats();
}

function setHighScore() {
  const highScore = readNumber("highScore");
  if (score > highScore) localStorage.setItem("highScore", String(score));
  renderStats();
}

function createSnakeSegment(top, left) {
  const segment = document.createElement("div");
  segment.className = "snake-segment";
  segment.style.top = `${top}px`;
  segment.style.left = `${left}px`;
  segment.style.position = "absolute";
  imgContainer.appendChild(segment);
  return segment;
}

function refreshSnakeClasses() {
  headList.forEach((segment, index) => {
    segment.classList.toggle("snake-head", index === 0);
    segment.classList.toggle("snake-body", index !== 0);
  });
}

function getStoredSnakePositions() {
  try {
    const positions = JSON.parse(localStorage.getItem("snakePositions") || "[]");
    return Array.isArray(positions) ? positions : [];
  } catch {
    return [];
  }
}

function saveSnakePositions() {
  const positions = headList.map((segment) => ({
    top: Number.parseInt(segment.style.top, 10) || 0,
    left: Number.parseInt(segment.style.left, 10) || 0,
  }));
  localStorage.setItem("snakePositions", JSON.stringify(positions));
}

function createHead() {
  headList.forEach((segment) => segment.remove());
  headList = [];

  const storedPositions = getStoredSnakePositions();
  for (let index = 0; index < headListLength; index += 1) {
    const stored = storedPositions[index];
    const top = stored?.top ?? 20;
    const left = stored?.left ?? Math.max(20 - index * step, 0);
    headList.push(createSnakeSegment(top, left));
  }
  refreshSnakeClasses();
}

function createNewHead(top, left) {
  headList.push(createSnakeSegment(top, left));
  headListLength = headList.length;
  localStorage.setItem("headListLength", String(headListLength));
  refreshSnakeClasses();
}

function foodOverlapsSnake(top, left, size) {
  return headList.some((segment) => {
    const segmentTop = Number.parseInt(segment.style.top, 10) || 0;
    const segmentLeft = Number.parseInt(segment.style.left, 10) || 0;
    return Math.abs(segmentTop - top) < size && Math.abs(segmentLeft - left) < size;
  });
}

function generateRedBall(useStoredPosition = false) {
  if (!imgContainer) return;
  if (ball) ball.remove();

  ball = document.createElement("img");
  ball.src = "img/red.png";
  ball.alt = "Food";
  ball.className = "food-orb";
  ball.style.position = "absolute";
  imgContainer.appendChild(ball);

  const foodSize = ball.offsetWidth || 26;
  const maxTop = Math.max(imgContainer.clientHeight - foodSize - 8, 8);
  const maxLeft = Math.max(imgContainer.clientWidth - foodSize - 8, 8);
  const storedTop = localStorage.getItem("ballLocationX");
  const storedLeft = localStorage.getItem("ballLocationY");
  let top;
  let left;

  if (useStoredPosition && storedTop !== null && storedLeft !== null) {
    top = Math.min(Number.parseInt(storedTop, 10) || 8, maxTop);
    left = Math.min(Number.parseInt(storedLeft, 10) || 8, maxLeft);
  } else {
    let attempts = 0;
    do {
      top = 8 + Math.floor(Math.random() * Math.max(maxTop - 8, 1));
      left = 8 + Math.floor(Math.random() * Math.max(maxLeft - 8, 1));
      attempts += 1;
    } while (foodOverlapsSnake(top, left, foodSize) && attempts < 25);
  }

  ball.style.top = `${top}px`;
  ball.style.left = `${left}px`;
  localStorage.setItem("ballLocationX", String(top));
  localStorage.setItem("ballLocationY", String(left));
}

function checkFoodCollision() {
  if (!ball || !headList[0]) return false;
  const foodRect = ball.getBoundingClientRect();
  const headRect = headList[0].getBoundingClientRect();
  return !(
    headRect.bottom < foodRect.top ||
    headRect.top > foodRect.bottom ||
    headRect.right < foodRect.left ||
    headRect.left > foodRect.right
  );
}

function checkSelfCollision() {
  if (headList.length < 5) return false;
  const headTop = Number.parseInt(headList[0].style.top, 10);
  const headLeft = Number.parseInt(headList[0].style.left, 10);
  const hitSize = Math.max(headList[0].offsetWidth * 0.45, step);

  return headList.slice(4).some((segment) => {
    const top = Number.parseInt(segment.style.top, 10);
    const left = Number.parseInt(segment.style.left, 10);
    return Math.abs(headTop - top) < hitSize && Math.abs(headLeft - left) < hitSize;
  });
}

function setDirection(nextDirection) {
  const opposites = { up: "down", down: "up", left: "right", right: "left" };
  if (opposites[direction] === nextDirection) return;
  direction = nextDirection;
  localStorage.setItem("direction", direction);
}

function move() {
  if (!isGameRunning || !headList[0]) return;

  const head = headList[0];
  const previousPositions = headList.map((segment) => ({
    top: Number.parseInt(segment.style.top, 10) || 0,
    left: Number.parseInt(segment.style.left, 10) || 0,
  }));
  let nextTop = previousPositions[0].top;
  let nextLeft = previousPositions[0].left;

  if (direction === "up") nextTop -= step;
  if (direction === "down") nextTop += step;
  if (direction === "left") nextLeft -= step;
  if (direction === "right") nextLeft += step;

  const maxTop = imgContainer.clientHeight - head.offsetHeight;
  const maxLeft = imgContainer.clientWidth - head.offsetWidth;
  if (nextTop < 0 || nextLeft < 0 || nextTop > maxTop || nextLeft > maxLeft) {
    endGame();
    return;
  }

  head.style.top = `${nextTop}px`;
  head.style.left = `${nextLeft}px`;
  for (let index = 1; index < headList.length; index += 1) {
    headList[index].style.top = `${previousPositions[index - 1].top}px`;
    headList[index].style.left = `${previousPositions[index - 1].left}px`;
  }

  if (checkSelfCollision()) {
    endGame();
    return;
  }

  if (checkFoodCollision()) {
    playAudio(pointAudio);
    score += 1;
    localStorage.setItem("score", String(score));
    const tail = previousPositions[previousPositions.length - 1];
    createNewHead(tail.top, tail.left);
    snakeSpeed = Math.max(minimumSnakeSpeed, snakeSpeed - speedIncreaseStep);
    clearInterval(gameInterval);
    gameInterval = setInterval(move, snakeSpeed);
    generateRedBall(false);
    renderStats();
  }

  saveSnakePositions();
}

function beginIntervals() {
  clearInterval(gameInterval);
  clearInterval(timerInterval);
  gameInterval = setInterval(move, snakeSpeed);
  timerInterval = setInterval(updateTimer, 1000);
}

function startGame() {
  if (!imgContainer) return;
  isGameRunning = true;
  renderStats();
  beginIntervals();
  playAudio(gameAudio);
}

function showPauseOverlay(show) {
  const overlay = document.getElementById("pauseOverlay");
  const gameStatus = document.getElementById("gameStatus");
  if (!overlay) return;

  overlay.hidden = !show;
  if (gameStatus) gameStatus.textContent = show ? "Game paused" : "Game in progress";
  if (show) {
    document.getElementById("pauseScore").textContent = String(score);
    document.getElementById("pauseBest").textContent = String(readNumber("highScore"));
  }
}

function pause() {
  if (!isGameRunning) return;
  isGameRunning = false;
  clearInterval(gameInterval);
  clearInterval(timerInterval);
  pauseAudio(gameAudio);
  setHighScore();
  showPauseOverlay(true);
}

function toggleGame() {
  if (!imgContainer) return;
  if (isGameRunning) {
    pause();
  } else {
    showPauseOverlay(false);
    isGameRunning = true;
    beginIntervals();
    playAudio(gameAudio);
  }
}

function clearRunStorage() {
  [
    "score",
    "duration",
    "currentTop",
    "currentLeft",
    "direction",
    "ballLocationX",
    "ballLocationY",
    "headListLength",
    "snakePositions",
  ].forEach((key) => localStorage.removeItem(key));
}

function resetGame() {
  clearInterval(gameInterval);
  clearInterval(timerInterval);
  clearTimeout(redirectTimer);
  clearRunStorage();
  score = 0;
  duration = 0;
  headListLength = 1;
  direction = "right";
  snakeSpeed = initialSnakeSpeed;
  isGameRunning = false;
  pauseAudio(gameAudio, true);

  if (!imgContainer) {
    renderStats();
    return;
  }

  showPauseOverlay(false);
  createHead();
  generateRedBall(false);
  startGame();
}

function endGame() {
  if (!isGameRunning) return;
  isGameRunning = false;
  clearInterval(gameInterval);
  clearInterval(timerInterval);
  pauseAudio(gameAudio, true);
  setHighScore();
  playAudio(crashAudio);

  redirectTimer = setTimeout(() => {
    window.location.href = "gameOver.html";
  }, currentMuteState() ? 350 : 1100);
}

function handleKeyboard(event) {
  const keyDirections = {
    ArrowDown: "down",
    s: "down",
    S: "down",
    ArrowUp: "up",
    w: "up",
    W: "up",
    ArrowLeft: "left",
    a: "left",
    A: "left",
    ArrowRight: "right",
    d: "right",
    D: "right",
  };

  if (keyDirections[event.key]) {
    if (page === "game") event.preventDefault();
    setDirection(keyDirections[event.key]);
    return;
  }

  if (event.key === "m" || event.key === "M") toggleMute();

  if (event.code === "Space" || event.key === "Enter") {
    if (page === "game") {
      event.preventDefault();
      toggleGame();
    } else if (page === "home") {
      resetGame();
      window.location.href = "gamePage.html";
    } else if (page === "gameover") {
      resetGame();
      window.location.href = "gamePage.html";
    }
  }
}

function handleTouchStart(event) {
  if (!isGameRunning || event.touches.length !== 1) return;
  touchStartX = event.touches[0].clientX;
  touchStartY = event.touches[0].clientY;
}

function handleTouchEnd(event) {
  if (!isGameRunning || event.changedTouches.length !== 1) return;
  const deltaX = event.changedTouches[0].clientX - touchStartX;
  const deltaY = event.changedTouches[0].clientY - touchStartY;
  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 24) return;

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    setDirection(deltaX > 0 ? "right" : "left");
  } else {
    setDirection(deltaY > 0 ? "down" : "up");
  }
}

function initializePage() {
  const isMuted = currentMuteState();
  muteSounds(isMuted);
  updateMuteButtonImg(isMuted);
  renderStats();

  document.getElementById("soundToggle")?.addEventListener("click", toggleMute);
  document.querySelectorAll("[data-direction]").forEach((button) => {
    button.addEventListener("pointerdown", () => setDirection(button.dataset.direction));
  });
  document.addEventListener("keydown", handleKeyboard);

  if (imgContainer) {
    imgContainer.addEventListener("touchstart", handleTouchStart, { passive: true });
    imgContainer.addEventListener("touchend", handleTouchEnd, { passive: true });
  }

  if (page === "game") {
    createHead();
    generateRedBall(true);
    startGame();
  }

  if (page === "gameover") {
    setHighScore();
    playAudio(gameOverAudio);
  }

  if (page === "pause") setHighScore();
}

initializePage();
