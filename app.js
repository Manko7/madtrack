// Utility functions
const generateId = () => Math.random().toString(36).substr(2, 9);
const getTodayDateStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const formatTimeHHMM = (date) => {
    return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
};
const formatDuration = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return { hours, minutes, seconds };
};
const formatDurationShort = (ms) => {
    const { hours, minutes } = formatDuration(ms);
    if(hours === 0 && minutes === 0 && ms > 0) return `< 1m`;
    if(hours === 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
};

let state = {
    activeTrack: {
        isRunning: false,
        label: "",
        todos: [],
        startTime: null,
        accumulated: 0
    },
    tracks: [],
    settings: {
        pomodoroEnabled: false,
        pomodoroWork: 25,
        pomodoroBreak: 5,
        dailyTarget: 5,
        defaultStatsRange: 'current_week'
    }
};

let statsState = {
    range: 'current_week',
    activeLabel: null,
    activeDate: null,
    activeMonth: null
};

// DOM Elements
const els = {
    tabs: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),
    labelInput: document.getElementById('track-label'),
    todoInput: document.getElementById('track-todo-input'),
    activeTodos: document.getElementById('active-todos'),
    timeHours: document.getElementById('time-hours'),
    timeMinutes: document.getElementById('time-minutes'),
    timeSeconds: document.getElementById('time-seconds'),
    btnStart: document.getElementById('btn-start'),
    btnPause: document.getElementById('btn-pause'),
    btnStop: document.getElementById('btn-stop'),
    trackList: document.getElementById('track-list'),
    todayTotal: document.getElementById('today-total'),
    warningBanner: document.getElementById('under-hours-warning'),
    
    // Stats
    statsRangeTitle: document.getElementById('stats-range-title'),
    statsRange: document.getElementById('stats-range'),
    statsTotal: document.getElementById('stats-total'),
    statsAvg: document.getElementById('stats-avg'),
    barChart: document.getElementById('bar-chart'),
    btnExportCsv: document.getElementById('btn-export-csv'),
    btnDummyData: document.getElementById('btn-dummy-data'), 
    btnClearData: document.getElementById('btn-clear-data'),
    
    statsLowerTitle: document.getElementById('stats-lower-title'),
    btnStatsBack: document.getElementById('btn-stats-back'),
    statsLabelList: document.getElementById('stats-label-list'),
    statsDetailsList: document.getElementById('stats-details-list'),
    
    // Search
    searchInput: document.getElementById('search-input'),
    searchCount: document.getElementById('search-count'),
    searchTotal: document.getElementById('search-total'),
    searchResults: document.getElementById('search-results-list'),
    searchDateFrom: document.getElementById('search-date-from'),
    searchDateTo: document.getElementById('search-date-to'),
    searchFilterBtns: document.querySelectorAll('.search-filter-btn'),
    // Settings
    settingPomodoroEnabled: document.getElementById('setting-pomodoro-enabled'),
    settingPomodoroWork: document.getElementById('setting-pomodoro-work'),
    settingPomodoroBreak: document.getElementById('setting-pomodoro-break'),
    settingDailyTarget: document.getElementById('setting-daily-target'),
    settingDefaultStatsRange: document.getElementById('setting-default-stats-range')
};

let timerInterval = null;

// Initialization
function init() {
    loadState();
    
    // Apply settings to UI
    if (els.settingPomodoroEnabled) els.settingPomodoroEnabled.checked = state.settings.pomodoroEnabled;
    if (els.settingPomodoroWork) els.settingPomodoroWork.value = state.settings.pomodoroWork;
    if (els.settingPomodoroBreak) els.settingPomodoroBreak.value = state.settings.pomodoroBreak;
    if (els.settingDailyTarget) els.settingDailyTarget.value = state.settings.dailyTarget || 5;
    if (els.settingDefaultStatsRange) els.settingDefaultStatsRange.value = state.settings.defaultStatsRange || 'current_week';

    populateStatsRange();
    setupEventListeners();
    updateUI();
    if (state.activeTrack.isRunning) {
        startTimerVisuals();
    }
    
    checkForUpdates();
}

// Dummy Data
function generateDummyData() {
    const labels = ["Design Work", "Development", "Bug fixing", "Meetings", "Code Review", "Investigation"];
    const now = Date.now();
    for (let i = 0; i < 40; i++) {
        const daysAgo = Math.floor(Math.random() * 30);
        const randomDate = new Date(now - daysAgo * 86400000);
        
        const duration = Math.floor(Math.random() * (7*3600000 - 15*60000)) + 15*60000; 
        
        const hour = 9 + Math.floor(Math.random() * 5);
        randomDate.setHours(hour, Math.floor(Math.random()*60), 0, 0);
        
        const endMs = randomDate.getTime() + duration;
        
        const t = {
            id: generateId(),
            label: "DEMO: " + labels[Math.floor(Math.random() * labels.length)],
            todos: [
                { id: generateId(), text: "Review specs", startClock: randomDate.getTime(), endClock: randomDate.getTime() + 10*60000, done: true },
                { id: generateId(), text: "Implementation", startClock: randomDate.getTime() + 15*60000, endClock: null, done: false }
            ],
            duration: duration,
            date: `${randomDate.getFullYear()}-${String(randomDate.getMonth()+1).padStart(2,'0')}-${String(randomDate.getDate()).padStart(2,'0')}`,
            startStr: formatTimeHHMM(randomDate),
            endStr: formatTimeHHMM(new Date(endMs)),
            timestamp: randomDate.getTime()
        };
        state.tracks.push(t);
    }
    saveState();
    updateUI();
    alert("40 Dummy Tracks generated!");
}

// Stats Dropdown Initialization
function populateStatsRange() {
  const d = new Date();
  const year = d.getFullYear();
  const currentMonth = d.getMonth();

  let html = `
    <optgroup label="Weeks">
        <option value="current_week">Current Week</option>
        <option value="week_1">Last Week</option>
        <option value="week_2">2 Weeks Ago</option>
        <option value="week_3">3 Weeks Ago</option>
        <option value="last_4_weeks">Last 4 Weeks (Overall)</option>
    </optgroup>
    <optgroup label="Months (${year})">
        <option value="current_month">Current Month</option>
  `;
  
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  for(let m = currentMonth - 1; m >= 0; m--) {
      html += `<option value="month_${m}">${monthNames[m]} ${year}</option>`;
  }
  html += `</optgroup>
    <optgroup label="Years">
        <option value="current_year">Current Year</option>
    </optgroup>
  `;
  
  els.statsRange.innerHTML = html;
  const defRange = (state.settings && state.settings.defaultStatsRange) ? state.settings.defaultStatsRange : 'current_week';
  els.statsRange.value = defRange;
  statsState.range = defRange;
}

// Storage
function loadState() {
    const stored = localStorage.getItem('madtrack_state') || localStorage.getItem('novatrack_state');
    if (stored) {
        try {
            state = JSON.parse(stored);
            state.activeTrack.todos = state.activeTrack.todos || [];
            if (!state.settings) {
                state.settings = { pomodoroEnabled: false, pomodoroWork: 25, pomodoroBreak: 5, dailyTarget: 5, defaultStatsRange: 'current_week' };
            } else {
                if (state.settings.dailyTarget === undefined) state.settings.dailyTarget = 5;
                if (state.settings.defaultStatsRange === undefined) state.settings.defaultStatsRange = 'current_week';
            }
            
            if (state.activeTrack.notes) {
                 state.activeTrack.todos.unshift({
                     id: generateId(), text: state.activeTrack.notes, startClock: Date.now(), endClock: null, done: false
                 });
                 delete state.activeTrack.notes;
            }
            state.tracks.forEach(t => {
                t.todos = t.todos || [];
                if(t.notes) {
                    t.todos.unshift({ 
                        id: generateId(), text: t.notes, startClock: t.timestamp, endClock: t.timestamp + t.duration, done: true 
                    });
                    delete t.notes;
                }
            });
        } catch (e) {
            console.error("Failed to parse state", e);
        }
    }
}

function saveState() {
    localStorage.setItem('madtrack_state', JSON.stringify(state));
    localStorage.removeItem('novatrack_state'); // Cleanup migration
}

// Actions
function startTimer(resumeId = null) {
    state.activeTrack.label = els.labelInput.value.trim() || 'Unlabeled';
    state.activeTrack.startTime = Date.now();
    state.activeTrack.isRunning = true;
    
    saveState();
    startTimerVisuals();
    updateUI();
}

function pauseTimer() {
    if (!state.activeTrack.isRunning) return;
    
    const now = Date.now();
    state.activeTrack.accumulated += now - state.activeTrack.startTime;
    state.activeTrack.isRunning = false;
    state.activeTrack.startTime = null;
    
    stopTimerVisuals();
    updateTimerDisplay(); 
    saveState();
    updateUI();
}

function stopTimer() {
    let now = Date.now();
    let duration = state.activeTrack.accumulated;
    
    if (state.activeTrack.isRunning) {
        duration += now - state.activeTrack.startTime;
    }
    
    if (duration > 5000) {
        const trackStartTime = now - duration;
        
        const track = {
            id: generateId(),
            label: state.activeTrack.label || 'Unlabeled',
            todos: JSON.parse(JSON.stringify(state.activeTrack.todos)), 
            duration: duration,
            date: getTodayDateStr(), 
            startStr: formatTimeHHMM(new Date(trackStartTime)),
            endStr: formatTimeHHMM(new Date(now)),
            timestamp: now
        };
        state.tracks.push(track);
    }
    
    state.activeTrack.isRunning = false;
    state.activeTrack.startTime = null;
    state.activeTrack.accumulated = 0;
    state.activeTrack.label = "";
    state.activeTrack.todos = [];
    
    if (els.labelInput) els.labelInput.value = "";
    if (els.todoInput) els.todoInput.value = "";
    
    stopTimerVisuals();
    updateTimerDisplay(0);
    saveState();
    updateUI();
}

function resumeTrack(id, autoStart = true) {
    const trackIndex = state.tracks.findIndex(t => t.id === id);
    if (trackIndex === -1) return;
    
    const trackToResume = state.tracks[trackIndex];
    
    if (state.activeTrack.isRunning || state.activeTrack.accumulated > 0) {
        stopTimer();
    }
    
    state.tracks.splice(trackIndex, 1);
    
    state.activeTrack.label = trackToResume.label;
    state.activeTrack.todos = trackToResume.todos || [];
    state.activeTrack.accumulated = trackToResume.duration;
    
    if (autoStart) {
        state.activeTrack.startTime = Date.now();
        state.activeTrack.isRunning = true;
        startTimerVisuals();
    } else {
        state.activeTrack.startTime = null;
        state.activeTrack.isRunning = false;
        stopTimerVisuals();
        updateTimerDisplay(); 
    }
    
    if (els.labelInput) els.labelInput.value = state.activeTrack.label;
    
    saveState();
    updateUI();
}

function editTrack(id) {
    const t = state.tracks.find(t => t.id === id);
    if(t) {
        const newLabel = prompt("Edit Track Name:", t.label);
        if(newLabel !== null && newLabel.trim() !== '') {
            t.label = newLabel.trim();
            saveState();
            updateUI();
        }
    }
}

function deleteTrack(id) {
    if(confirm("Delete this track?")) {
        state.tracks = state.tracks.filter(t => t.id !== id);
        saveState();
        updateUI();
    }
}

function editSubtask(id) {
    const td = state.activeTrack.todos.find(td => td.id === id);
    if(td) {
        const newText = prompt("Edit Sub-Task:", td.text);
        if(newText !== null && newText.trim() !== '') {
            td.text = newText.trim();
            saveState();
            renderActiveTodos();
        }
    }
}

function deleteSubtask(id) {
    if(confirm("Delete this sub-task?")) {
        state.activeTrack.todos = state.activeTrack.todos.filter(td => td.id !== id);
        saveState();
        renderActiveTodos();
    }
}

// Timer Loop
function startTimerVisuals() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        updateTimerDisplay();
        checkWarning();
    }, 1000);
    updateTimerDisplay();
}

function stopTimerVisuals() {
    if (timerInterval) clearInterval(timerInterval);
}

function updateTimerDisplay(forceDuration = null) {
    let duration = forceDuration;
    if (duration === null) {
        if (state.activeTrack.isRunning) {
            duration = Date.now() - state.activeTrack.startTime + state.activeTrack.accumulated;
        } else {
            duration = state.activeTrack.accumulated;
        }
    }
    
    if (state.settings && state.settings.pomodoroEnabled) {
        const workMs = (state.settings.pomodoroWork || 25) * 60 * 1000;
        let remaining = workMs - duration;
        if (remaining <= 0) {
            remaining = 0;
            if (state.activeTrack.isRunning) {
                pauseTimer();
                setTimeout(() => alert(`Pomodoro Session Complete! Take a ${state.settings.pomodoroBreak} minute break.`), 100);
            }
        }
        const { hours, minutes, seconds } = formatDuration(remaining);
        els.timeHours.innerText = String(hours).padStart(2, '0');
        els.timeMinutes.innerText = String(minutes).padStart(2, '0');
        els.timeSeconds.innerText = String(seconds).padStart(2, '0');
    } else {
        const { hours, minutes, seconds } = formatDuration(duration);
        els.timeHours.innerText = String(hours).padStart(2, '0');
        els.timeMinutes.innerText = String(minutes).padStart(2, '0');
        els.timeSeconds.innerText = String(seconds).padStart(2, '0');
    }
}

function renderActiveTodos() {
    els.activeTodos.innerHTML = '';
    const todos = state.activeTrack.todos || [];
    todos.forEach(td => {
        const li = document.createElement('li');
        li.className = 'todo-item' + (td.done ? ' done' : '');
        li.setAttribute('data-id', td.id);
        
        const startStr = formatTimeHHMM(new Date(td.startClock));
        let timeStr = startStr;
        if (td.done && td.endClock) {
            const endStr = formatTimeHHMM(new Date(td.endClock));
            const mins = Math.max(1, Math.round((td.endClock - td.startClock) / 60000));
            timeStr = `${startStr}-${endStr} (${mins}m)`;
        } else {
            timeStr = `${startStr}-...`;
        }
        
        li.innerHTML = `
            <div class="todo-text"><i class="fa-solid fa-check"></i> <span class="todo-title">${td.text.replace(/</g, "&lt;")}</span></div>
            <div class="todo-actions" style="display:flex; align-items:center; gap:4px;">
                <div class="todo-time" style="margin-right: 8px;">${timeStr}</div>
                <button class="icon-btn edit-todo" title="Edit"><i class="fa-solid fa-pen"></i></button>
                <button class="icon-btn delete-btn delete-todo" title="Delete"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        els.activeTodos.appendChild(li);
    });
}

// HTML Generation for old items
function renderTrackHtml(t) {
    let todosHtml = '';
    if (t.todos && t.todos.length > 0) {
        todosHtml = '<ul class="track-todos-inline">';
        t.todos.forEach(td => {
            const startStr = formatTimeHHMM(new Date(td.startClock));
            const endStr = td.endClock ? formatTimeHHMM(new Date(td.endClock)) : '...';
            let timeStr = `${startStr}-${endStr}`;
            if (td.done && td.endClock) {
                const mins = Math.max(1, Math.round((td.endClock - td.startClock) / 60000));
                timeStr += ` (${mins}m)`;
            }
            todosHtml += `<li class="${td.done ? 'done' : ''}"><i class="fa-solid fa-check"></i> <span class="todo-title">${td.text.replace(/</g, "&lt;")}</span> <span class="todo-time-inline">[${timeStr}]</span></li>`;
        });
        todosHtml += '</ul>';
    }
    
    const isToday = t.date === getTodayDateStr();
    const labelFmt = !isToday ? `${t.date.split('-')[2]}.${t.date.split('-')[1]} • ${t.label}` : t.label;
    
    // Resume only for today
    const resumeBtnHtml = isToday ? `
        <button class="resume-btn" title="Resume Track" data-id="${t.id}">
            <i class="fa-solid fa-play"></i>
        </button>
    ` : '';
    
    return `
        <div class="track-info" style="flex: 1; min-width: 0;">
            <span class="track-label">${labelFmt}</span>
            <span class="track-meta"><i class="fa-regular fa-clock"></i> ${t.startStr} - ${t.endStr}</span>
            ${todosHtml}
        </div>
        <div class="track-actions">
            <span class="track-duration">${formatDurationShort(t.duration)}</span>
            <div class="btn-group">
                <button class="icon-btn edit-track" data-id="${t.id}" title="Edit Name"><i class="fa-solid fa-pen"></i></button>
                <button class="icon-btn delete-btn delete-track" data-id="${t.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                ${resumeBtnHtml}
            </div>
        </div>
    `;
}

// Search Feature
function getSearchDateBounds() {
    let fromMs = null;
    let toMs = null;
    if (els.searchDateFrom && els.searchDateFrom.value) {
        fromMs = new Date(els.searchDateFrom.value + "T00:00:00").getTime();
    }
    if (els.searchDateTo && els.searchDateTo.value) {
        toMs = new Date(els.searchDateTo.value + "T23:59:59").getTime();
    }
    return { fromMs, toMs };
}

function applySearchQuickFilter(filterType) {
    const d = new Date();
    const todayStr = getTodayDateStr();
    
    if (filterType === 'all') {
        els.searchDateFrom.value = '';
        els.searchDateTo.value = '';
    } else if (filterType === 'current_month') {
        els.searchDateFrom.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
        els.searchDateTo.value = todayStr;
    } else if (filterType === 'last_3_months') {
        const past = new Date(d.getFullYear(), d.getMonth() - 2, 1);
        els.searchDateFrom.value = `${past.getFullYear()}-${String(past.getMonth()+1).padStart(2,'0')}-01`;
        els.searchDateTo.value = todayStr;
    } else if (filterType === 'last_6_months') {
        const past = new Date(d.getFullYear(), d.getMonth() - 5, 1);
        els.searchDateFrom.value = `${past.getFullYear()}-${String(past.getMonth()+1).padStart(2,'0')}-01`;
        els.searchDateTo.value = todayStr;
    } else if (filterType === 'current_year') {
        els.searchDateFrom.value = `${d.getFullYear()}-01-01`;
        els.searchDateTo.value = todayStr;
    }
    
    performSearch(els.searchInput.value.trim().toLowerCase());
}

function performSearch(query) {
    const { fromMs, toMs } = getSearchDateBounds();
    
    if (!query && !fromMs && !toMs) {
         els.searchResults.innerHTML = `<li class="track-item" style="justify-content: center; color: var(--text-muted); font-size: 0.9rem;">Start typing to search or use dates...</li>`;
         els.searchCount.innerText = '0';
         els.searchTotal.innerText = '0h 0m';
         return;
    }
    
    const matches = state.tracks.filter(t => {
         // date filter
         if (fromMs !== null && t.timestamp < fromMs) return false;
         if (toMs !== null && t.timestamp > toMs) return false;
         
         // text filter
         if (query) {
             const hasLabel = t.label.toLowerCase().includes(query);
             const hasTodo = t.todos && t.todos.some(td => td.text.toLowerCase().includes(query));
             if (!hasLabel && !hasTodo) return false;
         }
         return true;
    }).sort((a, b) => b.timestamp - a.timestamp);
    
    els.searchResults.innerHTML = '';
    let totalMs = 0;
    
    if (matches.length === 0) {
         els.searchResults.innerHTML = `<li class="track-item" style="justify-content: center; color: var(--text-muted); font-size: 0.9rem;">No matches found.</li>`;
    } else {
         matches.forEach(t => {
              totalMs += t.duration;
              const li = document.createElement('li');
              li.className = 'track-item';
              li.setAttribute('data-id', t.id);
              li.innerHTML = renderTrackHtml(t);
              els.searchResults.appendChild(li);
         });
    }
    
    els.searchCount.innerText = matches.length;
    els.searchTotal.innerText = formatDurationShort(totalMs);
}

// UI Updating
function updateUI() {
    // 1. Controls & Input
    if (state.activeTrack.isRunning) {
        els.btnStart.disabled = true;
        els.btnStart.innerHTML = `<i class="fa-solid fa-play"></i> Running`;
        els.btnPause.disabled = false;
        els.btnStop.disabled = false;
        
        if(document.activeElement !== els.labelInput) {
             els.labelInput.value = state.activeTrack.label;
        }
    } else {
        if (state.activeTrack.accumulated > 0) {
            els.btnStart.disabled = false;
            els.btnStart.innerHTML = `<i class="fa-solid fa-play"></i> Resume`;
            els.btnPause.disabled = true;
            els.btnStop.disabled = false;
        } else {
            els.btnStart.disabled = false;
            els.btnStart.innerHTML = `<i class="fa-solid fa-play"></i> Start`;
            els.btnPause.disabled = true;
            els.btnStop.disabled = true;
        }
        if(document.activeElement !== els.labelInput) {
             els.labelInput.value = state.activeTrack.label;
        }
    }
    
    renderActiveTodos();
    
    // 2. Today's List
    const todayStr = getTodayDateStr();
    const todayTracks = state.tracks.filter(t => t.date === todayStr);
    
    todayTracks.sort((a,b) => b.timestamp - a.timestamp);
    
    els.trackList.innerHTML = '';
    let todayMs = 0;
    
    if (todayTracks.length === 0) {
        els.trackList.innerHTML = `<li class="track-item" style="justify-content: center; color: var(--text-muted); font-size: 0.9rem;">No tracks today. Start tracking!</li>`;
    } else {
        todayTracks.forEach(t => {
            todayMs += t.duration;
            const li = document.createElement('li');
            li.className = 'track-item';
            li.setAttribute('data-id', t.id);
            li.innerHTML = renderTrackHtml(t);
            els.trackList.appendChild(li);
        });
    }
    
    let activeTimeMs = state.activeTrack.accumulated;
    if(state.activeTrack.isRunning) {
         activeTimeMs += Date.now() - state.activeTrack.startTime;
    }
    todayMs += activeTimeMs;
    
    // Dynamic Clear Button Text
    if (els.btnClearData) {
        const hasDemo = state.tracks.some(t => t.label.startsWith('DEMO:'));
        els.btnClearData.innerHTML = hasDemo 
            ? `<i class="fa-solid fa-trash-can"></i> <span>Clear Demo</span>`
            : `<i class="fa-solid fa-trash-can"></i> <span>Clear All</span>`;
    }
    
    els.todayTotal.innerText = formatDurationShort(todayMs);
    checkWarning(todayMs);
    updateStatsView();
    
    // Update Search if active
    if (document.getElementById('tab-search') && document.getElementById('tab-search').classList.contains('active')) {
        performSearch(els.searchInput.value.trim().toLowerCase());
    }
}

function checkWarning(todayMsFallback = null) {
    let todayMs = todayMsFallback;
    if (todayMs === null) {
        const todayStr = getTodayDateStr();
        todayMs = state.tracks.filter(t => t.date === todayStr).reduce((acc, t) => acc + t.duration, 0);
        todayMs += state.activeTrack.accumulated;
        if (state.activeTrack.isRunning) {
            todayMs += Date.now() - state.activeTrack.startTime;
        }
    }
    
    const targetHours = (state.settings && state.settings.dailyTarget !== undefined) ? state.settings.dailyTarget : 5;
    if (todayMs < targetHours * 3600 * 1000) {
        els.warningBanner.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Less than ${targetHours}h tracked today!`;
        els.warningBanner.style.display = 'flex';
    } else {
        els.warningBanner.style.display = 'none';
    }
}

// Stats Helpers
function createDayObj(d, isToday, isShortRange, enforceLabel=false, customLabel=null) {
    let label = '';
    if (customLabel) label = customLabel;
    else if (isToday) label = 'Today';
    else if (isShortRange || enforceLabel) {
        label = String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0');
    }
    return {
        date: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
        label: label,
        timestamp: d.getTime(), 
        ms: 0,
        isMonth: false
    };
}

function getDaysForRange(range) {
    const days = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const wLabels = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

    if (range === 'last_4_weeks') {
        for(let i=27; i>=0; i--) {
            const d = new Date(today.getTime() - i * 86400000);
            days.push(createDayObj(d, i===0, false, i%5===0)); 
        }
    } else if (range === 'current_week') { 
        const diff = (today.getDay() + 6) % 7; 
        const monday = new Date(today.getTime() - diff * 86400000);
        for(let i=0; i<7; i++) {
            const d = new Date(monday.getTime() + i * 86400000);
            days.push(createDayObj(d, false, true, false, wLabels[i]));
        }
    } else if (range.startsWith('week_')) { 
        const weeksAgo = parseInt(range.split('_')[1]);
        const diff = (today.getDay() + 6) % 7; 
        const monday = new Date(today.getTime() - diff * 86400000 - (weeksAgo * 7 * 86400000));
        for(let i=0; i<7; i++) {
            const d = new Date(monday.getTime() + i * 86400000);
            days.push(createDayObj(d, false, true, false, wLabels[i]));
        }
    } else if (range === 'current_month') {
        const daysInMonth = new Date(today.getFullYear(), today.getMonth()+1, 0).getDate();
        for(let i=0; i<daysInMonth; i++) {
            const d = new Date(today.getFullYear(), today.getMonth(), i+1);
            days.push(createDayObj(d, d.getTime()===today.getTime(), false, (i%5===0 || i===daysInMonth-1)));
        }
    } else if (range.startsWith('month_')) {
        const m = parseInt(range.split('_')[1]);
        const daysInMonth = new Date(today.getFullYear(), m+1, 0).getDate();
        for(let i=0; i<daysInMonth; i++) {
            const d = new Date(today.getFullYear(), m, i+1);
            days.push(createDayObj(d, false, false, (i%5===0 || i===daysInMonth-1)));
        }
    } else if (range === 'current_year') {
        const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        for(let i=0; i<12; i++) {
            const firstDay = new Date(today.getFullYear(), i, 1);
            const lastDay = new Date(today.getFullYear(), i+1, 0); 
            days.push({
                isMonth: true,
                monthIndex: i, 
                label: shortMonths[i],
                timestamp: firstDay.getTime(),
                endMs: lastDay.getTime() + 86400000 - 1,
                ms: 0
            });
        }
    }
    return days;
}

// Stats Logic
function updateStatsView() {
    const days = getDaysForRange(statsState.range);
    const isWeekly = statsState.range.includes('week') && !statsState.range.startsWith('last');
    
    // Dynamic Title
    const selectedOption = els.statsRange.options[els.statsRange.selectedIndex];
    let titleText = selectedOption ? selectedOption.text : "";
    
    if (isWeekly && days.length > 0) {
        const formatDt = (d) => `${String(new Date(d.timestamp).getDate()).padStart(2,'0')}.${String(new Date(d.timestamp).getMonth()+1).padStart(2,'0')}`;
        titleText += ` (${formatDt(days[0])} - ${formatDt(days[days.length-1])})`;
    }
    els.statsRangeTitle.innerText = titleText;
    
    if(days.length === 0) return;
    
    const startMs = days[0].timestamp;
    const endMs = days[0].isMonth ? days[days.length-1].endMs : (days[days.length-1].timestamp + 86400000 - 1); 

    let totalMs = 0;
    let labelMap = {};
    
    const validTracks = state.tracks.filter(t => t.timestamp >= startMs && t.timestamp <= endMs);
    
    validTracks.forEach(t => {
        let bucket;
        if (days[0].isMonth) {
            const m = parseInt(t.date.split('-')[1]) - 1;
            bucket = days.find(d => d.monthIndex === m);
        } else {
            bucket = days.find(d => d.date === t.date);
        }
        
        if (bucket) bucket.ms += t.duration;
        totalMs += t.duration;
        
        if(!labelMap[t.label]) labelMap[t.label] = 0;
        labelMap[t.label] += t.duration;
    });
    
    let activeTimeMs = state.activeTrack.accumulated;
    if (state.activeTrack.isRunning) {
        activeTimeMs += Date.now() - state.activeTrack.startTime;
    }
    
    if (activeTimeMs > 0 && Date.now() >= startMs && Date.now() <= endMs) {
        let bucket;
        if(days[0].isMonth) {
            bucket = days.find(d => d.monthIndex === new Date().getMonth());
        } else {
            const todayStr = getTodayDateStr();
            bucket = days.find(d => d.date === todayStr);
        }
        
        if(bucket) {
             bucket.ms += activeTimeMs;
             totalMs += activeTimeMs;
        }
        const activeLabel = state.activeTrack.label || 'Unlabeled';
        if(!labelMap[activeLabel]) labelMap[activeLabel] = 0;
        labelMap[activeLabel] += activeTimeMs;
    }
    
    const filteredDays = days.filter(d => {
        if(d.isMonth) return true;
        const dt = new Date(d.timestamp);
        const dayOfWeek = dt.getDay(); 
        if((dayOfWeek === 0 || dayOfWeek === 6) && d.ms === 0) return false;
        return true;
    });
    
    // Update Summaries
    els.statsTotal.innerText = formatDurationShort(totalMs);
    els.statsTotal.style.color = (isWeekly && totalMs < 30 * 3600 * 1000) ? "var(--accent-color)" : "var(--text-main)";
    
    const actualLength = days[0].isMonth ? 12 : filteredDays.length;
    els.statsAvg.innerText = formatDurationShort(totalMs / Math.max(actualLength, 1)); 
    
    // Render Chart
    const maxMs = Math.max(...filteredDays.map(d => d.ms), 1); 
    els.barChart.innerHTML = '';
    
    const baseColors = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#06b6d4", "#6366f1", "#14b8a6"];
    
    filteredDays.forEach((d, i) => {
        const pct = (d.ms / maxMs) * 100;
        const h = Math.max(pct, filteredDays.length > 7 ? 1 : 2); 
        
        let colorIdx = i;
        if (!d.isMonth) {
            colorIdx = (new Date(d.timestamp).getDay() + 6) % 7;
        }
        
        let color = "var(--primary-color)";
        if (isWeekly) {
            color = d.ms > 0 && d.ms < 5 * 3600 * 1000 ? "var(--accent-color)" : baseColors[colorIdx % baseColors.length];
        } else if (d.isMonth) {
            color = baseColors[colorIdx % baseColors.length]; 
        } else {
            color = d.ms > 0 && d.ms < 5 * 3600 * 1000 ? "var(--accent-color)" : baseColors[colorIdx % baseColors.length];
        }
        
        const barGroup = document.createElement('div');
        barGroup.className = 'bar-group';
        barGroup.style.cursor = 'pointer';
        
        if (d.isMonth) barGroup.setAttribute('data-month', d.monthIndex);
        else barGroup.setAttribute('data-date', d.date);
        
        barGroup.innerHTML = `
            <div class="bar" style="height: ${h}%; width: 100%; margin: 0 1px; background-color: ${color}; transition: all 0.3s;" data-val="${d.ms > 0 ? formatDurationShort(d.ms) : '0m'}"></div>
            <div class="bar-label" style="font-size: 0.6rem;">${d.label}</div>
        `;
        els.barChart.appendChild(barGroup);
    });
    
    // Render Lower pane
    const renderLowerList = (tracksSource, emptyMsg) => {
        els.statsDetailsList.innerHTML = '';
        if(tracksSource.length === 0) {
             els.statsDetailsList.innerHTML = `<li class="track-item" style="justify-content: center; color: var(--text-muted); font-size: 0.9rem;">${emptyMsg}</li>`;
        } else {
             tracksSource.forEach(t => {
                 const li = document.createElement('li');
                 li.className = 'track-item';
                 li.setAttribute('data-id', t.id);
                 li.innerHTML = renderTrackHtml(t); 
                 els.statsDetailsList.appendChild(li);
             });
        }
    };

    if (statsState.activeLabel) {
        els.statsLabelList.style.display = 'none';
        els.statsDetailsList.style.display = 'flex';
        els.btnStatsBack.style.display = 'flex';
        els.statsLowerTitle.innerText = `Details: ${statsState.activeLabel}`;
        
        const periodTracks = validTracks.filter(t => t.label === statsState.activeLabel).sort((a,b) => b.timestamp - a.timestamp); 
        renderLowerList(periodTracks, 'No tracks for this label.');
        
    } else if (statsState.activeDate) {
        els.statsLabelList.style.display = 'none';
        els.statsDetailsList.style.display = 'flex';
        els.btnStatsBack.style.display = 'flex';
        
        const parts = statsState.activeDate.split('-');
        els.statsLowerTitle.innerText = `Details: ${parts[2]}.${parts[1]}.${parts[0]}`;
        
        const periodTracks = validTracks.filter(t => t.date === statsState.activeDate).sort((a,b) => b.timestamp - a.timestamp); 
        renderLowerList(periodTracks, 'No tracks for this day.');
        
    } else if (statsState.activeMonth !== null && statsState.activeMonth !== undefined) {
        els.statsLabelList.style.display = 'none';
        els.statsDetailsList.style.display = 'flex';
        els.btnStatsBack.style.display = 'flex';
        
        const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        els.statsLowerTitle.innerText = `Details: ${shortMonths[statsState.activeMonth]}`;
        
        const periodTracks = validTracks.filter(t => {
            const m = parseInt(t.date.split('-')[1]) - 1;
            return m === statsState.activeMonth;
        }).sort((a,b) => b.timestamp - a.timestamp); 
        renderLowerList(periodTracks, 'No tracks for this month.');
        
    } else {
        els.statsDetailsList.style.display = 'none';
        els.statsLabelList.style.display = 'flex';
        els.btnStatsBack.style.display = 'none';
        els.statsLowerTitle.innerText = `All Tracked Labels`;
        
        els.statsLabelList.innerHTML = '';
        const sortedLabels = Object.entries(labelMap).sort((a,b) => b[1] - a[1]);
        
        if(sortedLabels.length === 0) {
            els.statsLabelList.innerHTML = `<li class="track-item" style="justify-content: center; color: var(--text-muted); font-size: 0.9rem;">No data in this period.</li>`;
        } else {
            sortedLabels.forEach(([lbl, ms]) => {
                const li = document.createElement('li');
                li.className = 'track-item stat-label-item';
                li.setAttribute('data-label', lbl);
                li.innerHTML = `
                    <div class="track-info">
                        <span class="track-label">${lbl}</span>
                    </div>
                    <div class="track-actions">
                        <span class="track-duration">${formatDurationShort(ms)}</span>
                    </div>
                `;
                els.statsLabelList.appendChild(li);
            });
        }
    }
}

// Export Function
function exportCSV() {
    let csv = "Date,Label,Start,End,Duration(ms),Duration(Text),Todos\n";
    state.tracks.forEach(t => {
        const d = `"${t.date}"`;
        const lbl = `"${t.label.replace(/"/g, '""')}"`;
        const st = `"${t.startStr}"`;
        const ed = `"${t.endStr}"`;
        const dur = t.duration;
        const durText = `"${formatDurationShort(t.duration)}"`;
        
        let subtasks = "";
        if(t.todos && t.todos.length > 0) {
            subtasks = t.todos.map(td => {
                const checked = td.done ? "[x]" : "[ ]";
                const times = td.done && td.endClock ? `${formatTimeHHMM(new Date(td.startClock))}-${formatTimeHHMM(new Date(td.endClock))}` : `${formatTimeHHMM(new Date(td.startClock))}-...`;
                return `${checked} ${td.text} (${times})`;
            }).join(" | ");
        }
        const sub = `"${subtasks.replace(/"/g, '""')}"`;
        
        csv += `${d},${lbl},${st},${ed},${dur},${durText},${sub}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'madtrack_export.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Event Listeners
function setupEventListeners() {
    // Tabs
    els.tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            els.tabs.forEach(t => t.classList.remove('active'));
            els.tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const target = btn.getAttribute('data-tab');
            document.getElementById(`tab-${target}`).classList.add('active');
            if(target === 'stats') {
                 updateStatsView();
            } else if (target === 'search') {
                 els.searchInput.focus();
                 performSearch(els.searchInput.value.trim().toLowerCase());
            }
        });
    });
    
    // Main Timer Buttons
    els.btnStart.addEventListener('click', () => startTimer());
    els.btnPause.addEventListener('click', () => pauseTimer());
    els.btnStop.addEventListener('click', () => stopTimer());
    
    // Track List Event Delegation
    const handleTrackListClick = (e) => {
        const resumeBtn = e.target.closest('.resume-btn');
        const editBtn = e.target.closest('.edit-track');
        const delBtn = e.target.closest('.delete-track');
        const trackItem = e.target.closest('.track-item');
        
        if (resumeBtn) {
            e.stopPropagation();
            resumeTrack(resumeBtn.getAttribute('data-id'), true);
        } else if (editBtn) {
            e.stopPropagation();
            editTrack(editBtn.getAttribute('data-id'));
        } else if (delBtn) {
            e.stopPropagation();
            deleteTrack(delBtn.getAttribute('data-id'));
        } else if (trackItem) {
            const id = trackItem.getAttribute('data-id');
            if (id) resumeTrack(id, false);
        }
    };
    
    els.trackList.addEventListener('click', handleTrackListClick);
    els.statsDetailsList.addEventListener('click', handleTrackListClick);
    els.searchResults.addEventListener('click', handleTrackListClick);

    els.labelInput.addEventListener('change', () => {
        if(state.activeTrack.isRunning || state.activeTrack.accumulated > 0) {
            state.activeTrack.label = els.labelInput.value.trim() || 'Unlabeled';
            saveState();
        }
    });

    els.labelInput.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' && !state.activeTrack.isRunning) {
            startTimer();
        }
    });
    
    // Todos Feature 
    els.todoInput.addEventListener('keydown', (e) => {
        if(e.key === 'Enter') {
            const val = els.todoInput.value.trim();
            if(!val) return;
            state.activeTrack.todos = state.activeTrack.todos || [];
            state.activeTrack.todos.unshift({
                id: generateId(),
                text: val,
                startClock: Date.now(),
                endClock: null,
                done: false
            });
            els.todoInput.value = "";
            saveState();
            renderActiveTodos();
            updateUI(); 
        }
    });

    els.activeTodos.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-todo');
        const delBtn = e.target.closest('.delete-todo');
        const item = e.target.closest('.todo-item');
        
        if (editBtn) {
            e.stopPropagation();
            editSubtask(editBtn.closest('.todo-item').getAttribute('data-id'));
        } else if (delBtn) {
            e.stopPropagation();
            deleteSubtask(delBtn.closest('.todo-item').getAttribute('data-id'));
        } else if (item) {
            const id = item.getAttribute('data-id');
            const todo = state.activeTrack.todos.find(td => td.id === id);
            if (todo && !todo.done) {
                todo.endClock = Date.now();
                todo.done = true;
                saveState();
                renderActiveTodos();
            } else if (todo && todo.done) {
                todo.endClock = null;
                todo.done = false;
                saveState();
                renderActiveTodos();
            }
        }
    });
    
    // Stats view
    els.statsRange.addEventListener('change', (e) => {
        statsState.range = e.target.value;
        statsState.activeLabel = null; 
        statsState.activeDate = null;
        statsState.activeMonth = null;
        updateStatsView();
    });
    
    els.statsLabelList.addEventListener('click', (e) => {
        const item = e.target.closest('.stat-label-item');
        if(item) {
            statsState.activeLabel = item.getAttribute('data-label');
            updateStatsView();
        }
    });
    
    els.barChart.addEventListener('click', (e) => {
        const bar = e.target.closest('.bar-group');
        if (bar) {
            const dateStr = bar.getAttribute('data-date');
            const monthIdx = bar.getAttribute('data-month');
            
            statsState.activeLabel = null;
            statsState.activeDate = dateStr || null;
            statsState.activeMonth = monthIdx !== null ? parseInt(monthIdx) : null;
            
            updateStatsView();
        }
    });
    
    els.btnStatsBack.addEventListener('click', () => {
        statsState.activeLabel = null;
        statsState.activeDate = null;
        statsState.activeMonth = null;
        updateStatsView();
    });
    
    els.btnExportCsv.addEventListener('click', exportCSV);
    if(els.btnDummyData) els.btnDummyData.addEventListener('click', generateDummyData);
    if(els.btnClearData) els.btnClearData.addEventListener('click', () => {
        const hasDemo = state.tracks.some(t => t.label.startsWith('DEMO:'));
        if (hasDemo) {
            if (confirm("Lösche nur die generierten DEMO-Daten?")) {
                state.tracks = state.tracks.filter(t => !t.label.startsWith('DEMO:'));
                saveState();
                updateUI();
            }
        } else {
            if (confirm("Lösche ALLE Track-Daten unwiderruflich?")) {
                state.tracks = [];
                saveState();
                updateUI();
            }
        }
    });
    
    // Search Listener
    els.searchInput.addEventListener('input', (e) => {
        performSearch(e.target.value.trim().toLowerCase());
    });
    
    if(els.searchDateFrom) {
        els.searchDateFrom.addEventListener('change', () => performSearch(els.searchInput.value.trim().toLowerCase()));
        els.searchDateTo.addEventListener('change', () => performSearch(els.searchInput.value.trim().toLowerCase()));
        
        els.searchFilterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                applySearchQuickFilter(e.target.getAttribute('data-filter'));
            });
        });
    }

    // Settings Listeners
    if (els.settingPomodoroEnabled) {
        els.settingPomodoroEnabled.addEventListener('change', (e) => {
            state.settings.pomodoroEnabled = e.target.checked;
            saveState();
            updateTimerDisplay();
        });
        els.settingPomodoroWork.addEventListener('change', (e) => {
            state.settings.pomodoroWork = parseInt(e.target.value) || 25;
            saveState();
            updateTimerDisplay();
        });
        els.settingPomodoroBreak.addEventListener('change', (e) => {
            state.settings.pomodoroBreak = parseInt(e.target.value) || 5;
            saveState();
        });
        if (els.settingDailyTarget) {
            els.settingDailyTarget.addEventListener('change', (e) => {
                state.settings.dailyTarget = parseFloat(e.target.value) || 5;
                saveState();
                checkWarning();
            });
        }
        if (els.settingDefaultStatsRange) {
            els.settingDefaultStatsRange.addEventListener('change', (e) => {
                state.settings.defaultStatsRange = e.target.value;
                saveState();
                populateStatsRange();
                updateStatsView();
            });
        }
    }
}

// Version Check
async function checkForUpdates() {
    try {
        const currentVersion = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) 
            ? chrome.runtime.getManifest().version 
            : '1.0';
            
        const response = await fetch('https://raw.githubusercontent.com/Manko7/madtrack/main/manifest.json', { cache: "no-store" });
        if (!response.ok) return;
        
        const remoteManifest = await response.json();
        const remoteVersion = remoteManifest.version;
        
        if (remoteVersion && remoteVersion !== currentVersion && isNewerVersion(currentVersion, remoteVersion)) {
            const banner = document.getElementById('update-banner');
            const txt = document.getElementById('update-version');
            if (banner && txt) {
                txt.innerText = remoteVersion;
                banner.style.display = 'flex';
            }
        }
    } catch (e) {
        console.warn("Update check failed", e);
    }
}

function isNewerVersion(current, remote) {
    const v1 = current.split('.').map(Number);
    const v2 = remote.split('.').map(Number);
    for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
        let n1 = v1[i] || 0;
        let n2 = v2[i] || 0;
        if (n1 < n2) return true;
        if (n1 > n2) return false;
    }
    return false;
}

// Start app
init();
