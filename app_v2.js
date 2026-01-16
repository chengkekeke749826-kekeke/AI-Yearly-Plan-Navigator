const API_KEY = "key"; // ⚠️ 请填入你的 Key


let goalsData = [], countdownsData = [], journalData = [], ideasData = [];
let currentEditingId = null, currentSelectedColor = 'purple', currentCdColor = 'purple', currentBgIndex = 0;
let currentJournalMood = null;
const JOURNAL_DRAFT_KEY = 'myJournalDraft2026';
const bgColors = ['#F9F3E6', '#2D2D2D', '#E8ECEF', '#EBF2EA', '#FFF0E6'];
let pendingAIPlan = null;
let taskSidebarColor = 'purple';
let currentTaskImage = null;
let currentIdeaFilterTag = 'all';
let currentEditingIdeaId = null;

// 🔴 找到 initData，完全替换为下面这段
function initData() {
    // 1. 目标数据
    const savedGoals = localStorage.getItem('myGoals2026');
    if (savedGoals) {
        goalsData = JSON.parse(savedGoals);
        // 数据结构修复
        goalsData.forEach(g => {
            if(!g.tasks) g.tasks = [];
            if(g.tasks.length > 0 && typeof g.tasks[0] === 'string') {
                g.tasks = g.tasks.map(t => ({text: t, done: false, subTasks: []}));
            }
        });
    } else {
        goalsData = [{ 
            id: 1, title: "示例：阅读书籍", deadline: "2026-12-31", status: "progress", colorTheme: "blue",
            tasks: [{ text: "买书", done: true, subTasks: [] }, { text: "看书", done: false, subTasks: [] }], progress: 50
        }];
        saveToLocal();
    }

    // 2. 倒计时数据 (如果没有，加一个春节)
    const savedCD = localStorage.getItem('myCountdowns2026');
    if (savedCD) {
        countdownsData = JSON.parse(savedCD);
    } else {
        countdownsData = [
            { id: Date.now(), title: "2026 结束", date: "2026-12-31" }
        ];
        localStorage.setItem('myCountdowns2026', JSON.stringify(countdownsData));
    }

    // 3. 日记数据 (如果没有，加一条欢迎)
    const savedJ = localStorage.getItem('myJournal2026');
    if (savedJ) {
        journalData = JSON.parse(savedJ);
        journalData.forEach((j, idx) => {
            if (!j.id) j.id = Date.now() + idx;
            if (!j.createdAt) {
                if (j.date) {
                    const d = new Date(j.date);
                    if (!isNaN(d.getTime())) j.createdAt = d.toISOString();
                }
            }
        });
        localStorage.setItem('myJournal2026', JSON.stringify(journalData));
    } else {
        const now = new Date();
        journalData = [{
            id: now.getTime(),
            mood: "😊",
            text: "欢迎来到 Vision OS！开始记录你的 2026 吧。",
            createdAt: now.toISOString(),
            ai: "今天也要好好生活～"
        }];
        localStorage.setItem('myJournal2026', JSON.stringify(journalData));
    }

    const savedI = localStorage.getItem('myIdeas2026');
    ideasData = savedI ? JSON.parse(savedI) : [];
    if (!Array.isArray(ideasData)) ideasData = [];
    ideasData = ideasData.map((i, idx) => {
        if (typeof i === 'string') {
            return { id: Date.now() + idx, text: i, createdAt: new Date().toISOString(), tags: [], source: '历史导入', linked: null };
        }
        if (!i.id) i.id = Date.now() + idx;
        if (!i.text) i.text = '';
        if (!i.createdAt) i.createdAt = new Date().toISOString();
        if (!Array.isArray(i.tags)) i.tags = [];
        if (!i.source) i.source = '灵感速记';
        if (typeof i.linked === 'undefined') i.linked = null;
        return i;
    });
    
    // 渲染所有视图
    renderGoals();       // 渲染看板
    renderCountdowns();  // 渲染倒计时 (确保你有这个函数)
    renderIdeasList();       // 渲染灵感胶囊
    renderJournalCalendar();     // 渲染日志
}

function saveToLocal() {
    localStorage.setItem('myGoals2026', JSON.stringify(goalsData));
    localStorage.setItem('myCountdowns2026', JSON.stringify(countdownsData));
    localStorage.setItem('myJournal2026', JSON.stringify(journalData));
    localStorage.setItem('myIdeas2026', JSON.stringify(ideasData));
}

// 进度计算核心逻辑
function recalculateProgress(goal) {
    if (!goal.tasks || goal.tasks.length === 0) { goal.progress = 0; return; }
    
    let total = 0, done = 0;
    goal.tasks.forEach(t => {
        if(t.subTasks && t.subTasks.length > 0) {
            // 有子任务：算子任务分
            t.subTasks.forEach(s => { total++; if(s.done) done++; });
            // 父任务状态跟随子任务
            t.done = t.subTasks.every(s => s.done);
        } else {
            // 无子任务：算父任务分
            total++; if(t.done) done++;
        }
    });
    
    goal.progress = total === 0 ? 0 : Math.round((done / total) * 100);
    if(goal.progress === 100) goal.status = 'done';
    else if(goal.progress > 0) goal.status = 'progress';
    else goal.status = 'todo';
}

// ==========================================
// 3. 视图控制 (View Controller)
// ==========================================

// 页面切换
window.switchPage = function(pageId) {
    console.log("Switching to:", pageId);
    // 1. 隐藏所有页面
    document.querySelectorAll('.page-section').forEach(e => e.classList.add('hidden'));
    document.querySelectorAll('.page-section').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(e => e.classList.remove('active'));
    // 2. 显示目标页面
    const target = document.getElementById(`page-${pageId}`);
    if(target) {target.classList.remove('hidden');
        target.classList.add('active');
    console.log("if2 Page switched to:", pageId);}    
    
    // 3. 激活 Tab 样式
    const btn = document.querySelector(`.nav-tab[onclick="switchPage('${pageId}')"]`);
    if(btn) {btn.classList.add('active');
    console.log("if Page switched to:", pageId);}

    // 额外保障：切换页面时确保倒计时侧边栏处于关闭状态
    const cdSidebar = document.getElementById('countdown-sidebar');
    if (cdSidebar) cdSidebar.classList.add('hidden');

    // 4. ⚡️ 强制刷新对应的数据 (关键修复)
    if(pageId === 'dashboard') renderGoals();
    if(pageId === 'tasks') { renderAllTasks(); updateStats(); }
    if(pageId === 'countdowns') renderCountdowns();
    if(pageId === 'journal') renderJournalCalendar();
    if(pageId === 'ideas') renderIdeasList();
}
// 切换背景
window.cycleBackground = function() {
    currentBgIndex = (currentBgIndex + 1) % bgColors.length;
    document.body.style.backgroundColor = bgColors[currentBgIndex];
}

// 渲染看板 (Dashboard)
window.renderGoals = function() {
    const container = document.getElementById('goals-container');
    container.innerHTML = ''; 
    goalsData.forEach(g => {
        recalculateProgress(g);
        const card = document.createElement('div');
        card.className = `goal-card card-${g.colorTheme || 'purple'}`;
        card.dataset.goalId = g.id;

        if (g.fontColor) {
            card.style.setProperty('--goal-text-color', g.fontColor);
        }
        if (g.bgImage) {
            card.classList.add('has-bg');
            card.style.backgroundImage = `url(${g.bgImage})`;
        }
        
        // 3D 特效
        if(typeof VanillaTilt !== 'undefined') {
            VanillaTilt.init(card, {max:10, speed:400, glare:true, "max-glare":0.2});
        }

        const statusText = g.status==='done'?'已完成':(g.status==='progress'?'进行中':'未开始');
        card.innerHTML = `
            <button class="goal-check-btn" onclick="event.stopPropagation(); openGoalSidebar(${g.id})">
                <i class="fa-solid fa-list-check"></i>
            </button>
            <button class="goal-edit-btn" onclick="event.stopPropagation(); openTaskSidebar(${g.id})">
                <i class="fa-solid fa-pen"></i>
            </button>
            <div class="card-status">${statusText}</div>
            <h3>${g.title}</h3>
            <p><i class="fa-regular fa-clock"></i> ${g.deadline || '未定'}</p>
            <div class="goal-progress">
                <div class="goal-progress-track">
                    <div class="goal-progress-fill" style="width:${g.progress || 0}%"></div>
                </div>
                <span class="goal-progress-text">${g.progress || 0}%</span>
            </div>
        `;
        container.appendChild(card);
    });
    updateStats(); // 同时更新统计数据
}

// 看板：新建/编辑任务侧边栏逻辑
window.openTaskSidebar = function(id = null) {
    currentEditingId = id || null;
    const title = document.getElementById('task-title');
    const startDate = document.getElementById('task-start-date');
    const deadline = document.getElementById('task-deadline');
    const metrics = document.getElementById('task-metrics');
    const titleNode = document.getElementById('task-sidebar-title');
    const fontColorInput = document.getElementById('task-font-color');
    const imgInput = document.getElementById('task-bg-image');
    const imgPreview = document.getElementById('task-img-preview');
    const imgClear = document.getElementById('task-clear-img');

    taskSidebarColor = 'purple';
    currentTaskImage = null;

    if (imgInput) imgInput.value = '';
    if (imgPreview) {
        imgPreview.style.backgroundImage = '';
        imgPreview.style.display = 'none';
    }
    if (imgClear) imgClear.style.display = 'none';

    document.querySelectorAll('#task-sidebar .color-option').forEach(e => e.classList.remove('selected'));
    const defaultDot = document.getElementById('task-opt-purple');

    if (currentEditingId) {
        const g = goalsData.find(x => x.id === currentEditingId);
        if (g) {
            if (title) title.value = g.title || '';
            if (startDate) startDate.value = g.startDate || '';
            if (deadline) deadline.value = g.deadline || '';

            if (metrics) {
                const lines = [];
                if (g.tasks && g.tasks.length) {
                    g.tasks.forEach(t => {
                        lines.push(t.text || '');
                        if (t.subTasks && t.subTasks.length) {
                            t.subTasks.forEach(s => {
                                lines.push('- ' + (s.text || ''));
                            });
                        }
                    });
                }
                metrics.value = lines.join('\n');
            }

            taskSidebarColor = g.colorTheme || 'purple';
            const colorDot = document.getElementById(`task-opt-${taskSidebarColor}`);
            if (colorDot) colorDot.classList.add('selected');
            else if (defaultDot) defaultDot.classList.add('selected');

            if (fontColorInput) fontColorInput.value = g.fontColor || '#4D4157';

            currentTaskImage = g.bgImage || null;
            if (currentTaskImage && imgPreview && imgClear) {
                imgPreview.style.backgroundImage = `url(${currentTaskImage})`;
                imgPreview.style.display = 'block';
                imgClear.style.display = 'block';
            }
        }
    } else {
        if (title) title.value = '';
        if (startDate) startDate.value = '';
        if (deadline) deadline.value = '';
        if (metrics) metrics.value = '';
        if (defaultDot) defaultDot.classList.add('selected');
        if (fontColorInput) fontColorInput.value = '#4D4157';
    }

    if (titleNode) titleNode.textContent = currentEditingId ? '编辑任务' : '新建任务';

    const sidebar = document.getElementById('task-sidebar');
    if (sidebar) sidebar.classList.remove('hidden');
};

window.closeTaskSidebar = function() {
    const sidebar = document.getElementById('task-sidebar');
    if (sidebar) sidebar.classList.add('hidden');
    currentEditingId = null;
};

window.selectTaskColor = function(c) {
    taskSidebarColor = c;
    document.querySelectorAll('#task-sidebar .color-option').forEach(e => e.classList.remove('selected'));
    const dot = document.getElementById(`task-opt-${c}`);
    if (dot) dot.classList.add('selected');
};

window.previewTaskImage = function(input) {
    if (input && input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            currentTaskImage = e.target.result;
            const preview = document.getElementById('task-img-preview');
            const clearBtn = document.getElementById('task-clear-img');
            if (preview) {
                preview.style.backgroundImage = `url(${currentTaskImage})`;
                preview.style.display = 'block';
            }
            if (clearBtn) clearBtn.style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.clearTaskImage = function() {
    currentTaskImage = null;
    const input = document.getElementById('task-bg-image');
    const preview = document.getElementById('task-img-preview');
    const clearBtn = document.getElementById('task-clear-img');
    if (input) input.value = '';
    if (preview) {
        preview.style.backgroundImage = '';
        preview.style.display = 'none';
    }
    if (clearBtn) clearBtn.style.display = 'none';
};

window.saveNewTask = function() {
    const titleEl = document.getElementById('task-title');
    const startDateEl = document.getElementById('task-start-date');
    const deadlineEl = document.getElementById('task-deadline');
    const metricsEl = document.getElementById('task-metrics');
    const fontColorEl = document.getElementById('task-font-color');
    if (!titleEl || !metricsEl) return;
    const title = titleEl.value.trim();
    if (!title) {
        alert('请输入标题');
        return;
    }
    const rawLines = metricsEl.value.split('\n');
    const tasks = [];
    rawLines.forEach(line => {
        const l = line.trim();
        if (!l) return;
        if (l.startsWith('-')) {
            if (tasks.length === 0) return;
            tasks[tasks.length - 1].subTasks.push({ text: l.replace(/^-\s*/, ''), done: false });
        } else {
            tasks.push({ text: l, done: false, subTasks: [] });
        }
    });
    const newGoal = {
        id: currentEditingId || Date.now(),
        title,
        startDate: startDateEl ? startDateEl.value : '',
        deadline: deadlineEl ? deadlineEl.value : '',
        status: 'todo',
        colorTheme: taskSidebarColor || 'purple',
        fontColor: fontColorEl ? fontColorEl.value : null,
        bgImage: currentTaskImage,
        tasks,
        progress: 0
    };
    recalculateProgress(newGoal);
    if (currentEditingId) {
        const index = goalsData.findIndex(x => x.id === currentEditingId);
        if (index > -1) {
            goalsData[index] = newGoal;
        } else {
            goalsData.push(newGoal);
        }
    } else {
        goalsData.push(newGoal);
    }
    saveToLocal();
    renderGoals();
    renderAllTasks();
    updateStats();
    closeTaskSidebar();
};

// function switchPage(pageId) {
//     // 1. 切换 Tab 激活状态
//     document.querySelectorAll('.nav-tab').forEach(btn => btn.classList.remove('active'));
//     // 2. 切换页面显示
//     document.querySelectorAll('.page-content').forEach(pg => pg.classList.remove('active'));
    
//     document.getElementById(pageId).classList.add('active');
    
//     // 🔴 关键点：切换时如果数据没出来，手动补一次渲染
//     if(pageId === 'countdowns') renderCountdowns();
//     if(pageId === 'ideas') renderIdeasList();
// }

// 渲染任务清单 (Sidebar内)
function renderChecklist(goal) {
    const c = document.getElementById('checklist-container'); 
    c.innerHTML = '';
    
    if(!goal.tasks || goal.tasks.length === 0) {
        c.innerHTML = '<p style="color:#999; font-style:italic;">暂无待办</p>'; 
        return;
    }

    goal.tasks.forEach((t, i) => {
        let html = `
            <div class="task-group">
                <div class="task-item">
                    <input type="checkbox" ${t.done?'checked':''} onchange="toggleTask(${goal.id},${i},null)">
                    <span>${t.text}</span>
                </div>`;
        
        if(t.subTasks && t.subTasks.length > 0) {
            html += `<div class="sub-task-list">`;
            t.subTasks.forEach((s, j) => {
                html += `
                    <div class="sub-task-item">
                        <input type="checkbox" ${s.done?'checked':''} onchange="toggleTask(${goal.id},${i},${j})">
                        <span>${s.text}</span>
                    </div>`;
            });
            html += `</div>`;
        }
        html += `</div>`;
        c.innerHTML += html;
    });
}

window.openGoalSidebar = function(id) {
    const goal = goalsData.find(x => x.id === id);
    if (!goal) return;
    const titleEl = document.getElementById('goal-sidebar-title');
    if (titleEl) titleEl.textContent = goal.title || '任务清单';
    const sidebar = document.getElementById('goal-sidebar');
    if (sidebar) sidebar.classList.remove('hidden');
    renderChecklist(goal);
};

window.closeGoalSidebar = function() {
    const sidebar = document.getElementById('goal-sidebar');
    if (sidebar) sidebar.classList.add('hidden');
};

// 任务打钩逻辑
window.toggleTask = function(gid, tid, sid, fromHall=false) {
    const g = goalsData.find(x => x.id === gid);
    let done = false, name = "";

    if(sid === null) {
        // 父任务
        g.tasks[tid].done = !g.tasks[tid].done; 
        done = g.tasks[tid].done; 
        name = g.tasks[tid].text;
        // 联动子任务
        if(g.tasks[tid].subTasks) g.tasks[tid].subTasks.forEach(s => s.done = done);
    } else {
        // 子任务
        g.tasks[tid].subTasks[sid].done = !g.tasks[tid].subTasks[sid].done;
        done = g.tasks[tid].subTasks[sid].done; 
        name = g.tasks[tid].subTasks[sid].text;
    }

    recalculateProgress(g); 
    saveToLocal();
    
    // 更新界面
    if(fromHall) renderAllTasks(); 
    else { 
        renderChecklist(g); 
    }

    const cardEl = document.querySelector(`.goal-card[data-goal-id="${gid}"]`);
    if (cardEl) {
        const fillEl = cardEl.querySelector('.goal-progress-fill');
        const textEl = cardEl.querySelector('.goal-progress-text');
        if (fillEl) fillEl.style.width = g.progress + '%';
        if (textEl) textEl.textContent = g.progress + '%';
        const statusEl = cardEl.querySelector('.card-status');
        if (statusEl) {
            statusEl.textContent = g.status==='done'?'已完成':(g.status==='progress'?'进行中':'未开始');
        }
    }

    renderGoals(); 
    updateStats();

    // 触发特效
    if(done) triggerAI(name, g.title);
}

// 保存目标
window.saveGoal = function() {
    const title = document.getElementById('edit-title').value;
    if(!title) return alert("标题为空");
    
    const raw = document.getElementById('edit-metrics').value.split('\n');
    const tasks = [];
    
    // 文本解析
    raw.forEach(l => {
        if(!l.trim()) return;
        if(l.startsWith(' ') || l.startsWith('-') || l.startsWith('\t')) { 
            // 子任务
            if(tasks.length) tasks[tasks.length-1].subTasks.push({text: l.replace(/^-/,'').trim(), done: false}); 
        } else {
            // 父任务
            tasks.push({text: l.trim(), done: false, subTasks: []});
        }
    });

    const newG = { 
        id: currentEditingId || Date.now(), 
        title: title, 
        deadline: document.getElementById('edit-deadline').value, 
        status: document.getElementById('edit-status').value, 
        colorTheme: currentSelectedColor, 
        tasks: tasks, 
        progress: 0 
    };
    
    recalculateProgress(newG);

    if(currentEditingId) { 
        const i = goalsData.findIndex(x => x.id === currentEditingId); 
        goalsData[i] = newG; 
    } else { 
        goalsData.push(newG); 
        triggerAI("新建", title); 
    }

    saveToLocal(); 
    renderGoals();
    
    if(currentEditingId) openSidebar(currentEditingId); 
    else closeSidebar();
}

window.deleteCurrentGoal = function() { 
    if(confirm("确定要删除吗？")) { 
        goalsData = goalsData.filter(x => x.id !== currentEditingId); 
        saveToLocal(); 
        renderGoals(); 
        closeSidebar(); 
    } 
}

// 生成海报
window.generatePoster = function() {
    const element = document.getElementById('capture-area');
    const btns = document.querySelector('.header-actions'); // 截图时隐藏按钮
    if(typeof html2canvas === 'undefined') { alert("海报插件加载中..."); return; }
    
    if(btns) btns.style.display = 'none';
    
    html2canvas(element, { backgroundColor: null }).then(canvas => {
        const link = document.createElement('a');
        link.download = '2026_Vision_Board.png';
        link.href = canvas.toDataURL();
        link.click();
        if(btns) btns.style.display = 'flex';
        showCelebration("📸 海报已保存");
    }).catch(e => { 
        console.error(e); 
        if(btns) btns.style.display = 'flex'; 
    });
}

// ==========================================
// 4. 其他页面逻辑
// ==========================================

// 统计逻辑
function updateStats() {
    let sum = 0; 
    goalsData.forEach(g => sum += g.progress);
    const avg = goalsData.length ? Math.round(sum / goalsData.length) : 0;
    
    let totalDone = 0, totalTasks = 0;
    goalsData.forEach(g => g.tasks.forEach(t => {
        if(t.subTasks && t.subTasks.length) {
            t.subTasks.forEach(s => { totalTasks++; if(s.done) totalDone++; });
        } else {
            totalTasks++; if(t.done) totalDone++;
        }
    }));

    document.getElementById('stat-progress').innerText = avg + "%";
    document.getElementById('stat-completed').innerText = totalDone;
    document.getElementById('stat-todo').innerText = totalTasks - totalDone;
}

// 任务大厅渲染
window.renderAllTasks = function() {
    const todo = document.getElementById('list-todo');
    const done = document.getElementById('list-done');
    todo.innerHTML = ''; done.innerHTML = '';
    
    goalsData.forEach(g => {
        const process = (t, ti, si=null) => {
            const d = document.createElement('div'); 
            d.className = `task-row from-${g.colorTheme}`;
            const isSub = si !== null && si !== undefined;
            const deadlineText = g.deadline ? g.deadline : '';
            d.innerHTML = `
                <input type="checkbox" ${t.done?'checked':''} onchange="toggleTask(${g.id},${ti},${si},true)">
                <div class="task-main">
                    <div class="task-title">${t.text}</div>
                    <div class="task-meta">
                        <span class="task-meta-goal">${g.title}</span>
                        ${deadlineText ? `<span class="task-meta-deadline"><i class="fa-regular fa-clock"></i> ${deadlineText}</span>` : ''}
                        ${isSub ? `<span class="task-meta-type">子任务</span>` : `<span class="task-meta-type">主任务</span>`}
                    </div>
                </div>
                <div class="task-row-actions">
                    <button class="task-row-btn" onclick="openGoalSidebar(${g.id})"><i class="fa-solid fa-list-check"></i></button>
                    <button class="task-row-btn" onclick="openTaskSidebar(${g.id})"><i class="fa-solid fa-pen"></i></button>
                </div>
            `;
            if(t.done) done.appendChild(d); else todo.appendChild(d);
        }
        g.tasks.forEach((t, ti) => {
            if(t.subTasks && t.subTasks.length) t.subTasks.forEach((s, si) => process(s, ti, si));
            else process(t, ti, null);
        });
    });
}

// ==========================================
// 倒计时高级逻辑 (Sidebar & Image Support)
// ==========================================

window.openCountdownSidebar = function(id = null) {
    currentCdId = id;
    const sidebar = document.getElementById('countdown-sidebar');
    
    if(id) {
        // 编辑模式 (预留，虽然目前入口只有新增)
        const cd = countdownsData.find(x => x.id === id);
        if(cd) {
            document.getElementById('cd-title').value = cd.title;
            document.getElementById('cd-date').value = cd.date;
            document.getElementById('cd-time').value = cd.time || '';
            document.getElementById('cd-category').value = cd.category || 'other';
            selectCdColor(cd.color || 'purple');
            document.getElementById('cd-font-color').value = cd.fontColor || '#ffffff';
            
            // 图片回显
            currentCdImage = cd.bgImage || null;
            const preview = document.getElementById('cd-img-preview');
            const clearBtn = document.getElementById('cd-clear-img');
            if(currentCdImage) {
                preview.style.backgroundImage = `url(${currentCdImage})`;
                preview.style.display = 'block';
                clearBtn.style.display = 'block';
            } else {
                preview.style.display = 'none';
                clearBtn.style.display = 'none';
            }
        }
    } else {
        // 新增模式：清空表单
        document.getElementById('cd-title').value = '';
        document.getElementById('cd-date').value = '';
        document.getElementById('cd-time').value = '';
        document.getElementById('cd-category').value = 'life';
        selectCdColor('purple');
        document.getElementById('cd-font-color').value = '#ffffff';
        clearCdImage();
    }
    
    sidebar.classList.remove('hidden');
}

window.closeCountdownSidebar = function() {
    document.getElementById('countdown-sidebar').classList.add('hidden');
}

window.selectCdColor = function(c) {
    currentCdColor = c;
    document.querySelectorAll('#countdown-sidebar .color-option').forEach(e => e.classList.remove('selected'));
    const btn = document.getElementById(`cd-opt-${c}`);
    if(btn) btn.classList.add('selected');
}

window.previewCdImage = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            currentCdImage = e.target.result; // Base64
            const preview = document.getElementById('cd-img-preview');
            preview.style.backgroundImage = `url(${currentCdImage})`;
            preview.style.display = 'block';
            document.getElementById('cd-clear-img').style.display = 'block';
        }
        reader.readAsDataURL(input.files[0]);
    }
}

window.clearCdImage = function() {
    currentCdImage = null;
    document.getElementById('cd-bg-image').value = ''; // Reset input
    document.getElementById('cd-img-preview').style.display = 'none';
    document.getElementById('cd-clear-img').style.display = 'none';
}

window.saveCountdown = function() {
    const title = document.getElementById('cd-title').value;
    const date = document.getElementById('cd-date').value;
    
    if(!title || !date) { alert("请填写事项和日期"); return; }
    
    const newCD = {
        id: currentCdId || Date.now(),
        title: title,
        date: date,
        time: document.getElementById('cd-time').value,
        category: document.getElementById('cd-category').value,
        color: currentCdColor,
        fontColor: document.getElementById('cd-font-color').value,
        bgImage: currentCdImage
    };
    
    if(currentCdId) {
        const index = countdownsData.findIndex(x => x.id === currentCdId);
        if(index > -1) countdownsData[index] = newCD;
    } else {
        countdownsData.push(newCD);
    }
    
    saveToLocal();
    renderCountdowns();
    closeCountdownSidebar();
}

window.deleteCurrentCountdown = function() {
    if(!currentCdId) return;
    if(confirm("确定删除此倒计时吗？")) {
        countdownsData = countdownsData.filter(x => x.id !== currentCdId);
        saveToLocal();
        renderCountdowns();
        closeCountdownSidebar();
    }
}

window.renderCountdowns = function() {
    const c = document.getElementById('countdown-grid'); 
    if(!c) return;
    c.innerHTML = '';

    // 空状态处理
    if (countdownsData.length === 0) {
        c.innerHTML = `<div class="empty-state"><i class="fa-regular fa-clock"></i>暂无倒计时</div>`;
        return;
    }

    if (window.cdTimerInterval) clearInterval(window.cdTimerInterval);

    countdownsData.forEach(cd => {
        const div = document.createElement('div');
        // 确保颜色类名存在
        const colorClass = cd.colorTheme ? 'card-'+cd.colorTheme : 'card-purple';
        div.className = `countdown-card ${colorClass} ${cd.bgImage ? 'has-bg' : ''}`;
        
        // 字体颜色自定义
        if (cd.fontColor) {
            div.style.setProperty('--cd-text-override', cd.fontColor);
        }

        // 背景图处理
        if (cd.bgImage) {
            div.style.backgroundImage = `url(${cd.bgImage})`;
        }

        // 计算时间
        const target = new Date(cd.date + ' ' + (cd.time || '00:00'));
        const now = new Date();
        const diff = target - now;
        
        // 计算天数 (向上取整)
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        const displayNum = days > 0 ? days : 0;
        
        // 进度计算
        const startTime = (typeof cd.id === 'number' && cd.id > 1700000000000) ? cd.id : (target.getTime() - 30 * 24 * 3600 * 1000);
        const totalDuration = target.getTime() - startTime;
        const elapsed = Date.now() - startTime;
        let percent = 0;
        if (totalDuration > 0) {
            percent = Math.round((elapsed / totalDuration) * 100);
            if (percent > 100) percent = 100;
            if (percent < 0) percent = 0;
        }

        const catMap = {life:'生活', study:'学习', work:'工作', love:'纪念日', other:'其他'};
        const catText = catMap[cd.category] || (cd.category === 'life' ? '生活' : '倒计时');

        div.innerHTML = `
            <div class="cd-header-row">
                <span class="cd-pill-tag">${catText}</span>
                <div class="cd-actions">
                    <button class="cd-icon-btn" onclick="event.stopPropagation();"><i class="fa-solid fa-thumbtack"></i></button>
                    <button class="cd-icon-btn" onclick="event.stopPropagation(); openCountdownSidebar(${cd.id})"><i class="fa-solid fa-pen"></i></button>
                    <button class="cd-icon-btn" onclick="event.stopPropagation(); delCD(${cd.id})"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>

            <div class="cd-title-block">
                <h3 class="cd-title-text">${cd.title}</h3>
                <div class="cd-date-text">${cd.date} ${cd.time || ''}</div>
            </div>

            <div class="cd-hero-section">
                <div class="cd-days-row">
                    <span class="cd-big-days">${displayNum}</span>
                    <span class="cd-days-label">天</span>
                </div>
                <div class="cd-timer-grid">
                    <div class="cd-timer-item">
                        <div class="cd-timer-val" id="cd-h-${cd.id}">--</div>
                        <div class="cd-timer-label">时</div>
                    </div>
                    <div class="cd-timer-item">
                        <div class="cd-timer-val">:</div>
                    </div>
                    <div class="cd-timer-item">
                        <div class="cd-timer-val" id="cd-m-${cd.id}">--</div>
                        <div class="cd-timer-label">分</div>
                    </div>
                    <div class="cd-timer-item">
                        <div class="cd-timer-val">:</div>
                    </div>
                    <div class="cd-timer-item">
                        <div class="cd-timer-val" id="cd-s-${cd.id}">--</div>
                        <div class="cd-timer-label">秒</div>
                    </div>
                </div>
            </div>

            <div class="cd-footer-progress">
                <div class="cd-progress-track">
                    <div class="cd-progress-bar-fill" style="width:${percent}%"></div>
                </div>
                <div class="cd-quote">Time flies, cherish every moment.</div>
            </div>
        `;
        c.appendChild(div);

        // 3D Tilt
        if(typeof VanillaTilt !== 'undefined') {
            VanillaTilt.init(div, {max:5, speed:400, glare:true, "max-glare":0.2});
        }
    });

    // 启动实时计时器
    startCountdownTimer();
}

function startCountdownTimer() {
    function update() {
        const now = new Date().getTime();
        countdownsData.forEach(cd => {
            const target = new Date(cd.date + ' ' + (cd.time || '00:00')).getTime();
            let diff = target - now;
            
            if (diff < 0) diff = 0;

            const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);

            const hEl = document.getElementById(`cd-h-${cd.id}`);
            const mEl = document.getElementById(`cd-m-${cd.id}`);
            const sEl = document.getElementById(`cd-s-${cd.id}`);

            if (hEl) hEl.textContent = String(h).padStart(2, '0');
            if (mEl) mEl.textContent = String(m).padStart(2, '0');
            if (sEl) sEl.textContent = String(s).padStart(2, '0');
        });
    }
    update(); // 立即执行一次
    window.cdTimerInterval = setInterval(update, 1000);
}

// 保持旧的直接删除接口，防止报错，但逻辑已合并到 render 中
window.delCD = (id) => { 
    if(confirm("删除?")) { 
        countdownsData = countdownsData.filter(x => x.id !== id); 
        saveToLocal(); 
        renderCountdowns(); 
    } 
};


// ==========================================
// 日记重构：日历视图逻辑
// ==========================================

let journalMonthColors = {};
let currentActiveDate = null;

// 初始化月份颜色配置
function initJournalColors() {
    const saved = localStorage.getItem('journalMonthColors2026');
    if (saved) {
        journalMonthColors = JSON.parse(saved);
    } else {
        // 默认随机分配一些颜色
        const themes = ['purple', 'blue', 'green', 'pink', 'yellow', 'orange', 'teal', 'red'];
        for (let i = 0; i < 12; i++) {
            journalMonthColors[i] = themes[i % themes.length];
        }
        localStorage.setItem('journalMonthColors2026', JSON.stringify(journalMonthColors));
    }
}

// 渲染日记日历视图
window.renderJournalCalendar = function() {
    const container = document.getElementById('calendar-scroll-view');
    if (!container) return;
    
    // 初始化颜色配置
    initJournalColors();

    container.innerHTML = '';
    
    const year = 2026;
    const months = [
        "一月", "二月", "三月", "四月", "五月", "六月",
        "七月", "八月", "九月", "十月", "十一月", "十二月"
    ];

    // 按月生成板块
    for (let month = 0; month < 12; month++) {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const theme = journalMonthColors[month] || 'purple';
        
        const section = document.createElement('div');
        section.className = `month-section month-theme-${theme}`;
        section.id = `month-section-${month}`;
        
        // 头部：标题 + 颜色配置
        const header = document.createElement('div');
        header.className = 'month-header';
        header.onclick = (e) => openMonthColorPicker(e, month);
        header.innerHTML = `
            <div class="month-title">${months[month]}</div>
            <div class="month-color-dot" title="点击切换颜色"></div>
        `;
        
        // 日期网格
        const grid = document.createElement('div');
        grid.className = 'days-grid';
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}/${month + 1}/${day}`;
            // 检查这天有没有日记
            const hasJournal = journalData.some(j => {
                const jd = new Date(j.createdAt || j.date);
                return jd.getFullYear() === year && jd.getMonth() === month && jd.getDate() === day;
            });
            
            const square = document.createElement('div');
            square.className = `day-square ${hasJournal ? 'has-journal' : ''}`;
            if (currentActiveDate === dateStr) square.classList.add('active');
            
            square.innerText = day;
            square.onclick = (e) => {
                e.stopPropagation();
                openJournalDayDetail(year, month, day, square);
            };
            
            grid.appendChild(square);
        }
        
        section.appendChild(header);
        section.appendChild(grid);
        container.appendChild(section);
    }
}

// 打开单日详情
window.openJournalDayDetail = function(year, month, day, squareEl) {
    const dateStr = `${year}/${month + 1}/${day}`;
    currentActiveDate = dateStr;
    
    // 1. 高亮选中格子
    document.querySelectorAll('.day-square').forEach(e => e.classList.remove('active'));
    if(squareEl) squareEl.classList.add('active');
    
    // 2. 切换布局：显示左侧栏
    const detailPanel = document.getElementById('journal-detail-panel');
    if(detailPanel) detailPanel.classList.remove('hidden');
    
    // 3. 渲染详情列表
    document.getElementById('detail-date-title').innerText = `${month + 1}月${day}日`;
    
    // 重置写日记表单状态
    hideDiaryForm();

    const listContainer = document.getElementById('detail-list-container');
    const emptyHint = document.getElementById('detail-empty-hint');
    listContainer.innerHTML = '';
    
    // 筛选当日日记
    const dailyJournals = journalData.filter(j => {
        const jd = new Date(j.createdAt || j.date);
        return jd.getFullYear() === year && jd.getMonth() === month && jd.getDate() === day;
    }).sort((a, b) => getJournalTimestamp(b) - getJournalTimestamp(a)); // 倒序
    
    if (dailyJournals.length > 0) {
        emptyHint.style.display = 'none';
        dailyJournals.forEach(j => {
            const card = document.createElement('div');
            card.className = 'journal-entry';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                    <div style="font-size:1.8rem;">${j.mood || '😐'}</div>
                    <div style="text-align:right;">
                        <div style="font-size:0.8rem; color:#999;">${formatJournalTimeOnly(j)}</div>
                        <button class="icon-btn-small" onclick="deleteJournalAndRefresh('${j.id}')" style="color:#FF8A80; margin-top:5px;"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                <div style="line-height:1.6; color:#444; white-space:pre-wrap;">${escapeHTML(j.text)}</div>
                ${j.ai ? `<div class="entry-ai">🤖 ${j.ai}</div>` : ''}
            `;
            listContainer.appendChild(card);
        });
    } else {
        emptyHint.style.display = 'flex';
    }
}

// 辅助：只显示时间
function formatJournalTimeOnly(j) {
    if (j.createdAt) {
        return new Date(j.createdAt).toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' });
    }
    return '全天';
}

// 关闭详情栏
window.closeJournalDetail = function() {
    document.getElementById('journal-detail-panel').classList.add('hidden');
    document.querySelectorAll('.day-square').forEach(e => e.classList.remove('active'));
    currentActiveDate = null;
}

// 删除并刷新 (针对日历视图优化)
window.deleteJournalAndRefresh = function(id) {
    if(!confirm("确定删除这条日记吗？")) return;
    journalData = journalData.filter(j => String(j.id) !== String(id));
    saveToLocal();
    
    // 重新渲染当前详情页
    if (currentActiveDate) {
        const [y, m, d] = currentActiveDate.split('/').map(Number);
        // 找到对应的 DOM 元素保持高亮状态
        // 这里偷懒重新渲染整个日历可能会丢失滚动位置，所以我们只刷新详情和日历标记
        // 但为了简单，先重新渲染日历
        renderJournalCalendar(); 
        // 恢复选中状态
        // 由于 DOM 重建了，需要重新触发一次 openJournalDayDetail 或者手动查找元素
        // 简单处理：重新触发一次逻辑，模拟点击
        // 为了体验更好，我们手动更新日历上的标记，而不重绘整个日历
        const hasRemaining = journalData.some(j => {
            const jd = new Date(j.createdAt || j.date);
            return jd.getFullYear() === y && jd.getMonth() === m - 1 && jd.getDate() === d;
        });
        
        // 重新渲染详情
        // 这里需要重新获取 square 元素，有点麻烦，直接调 openJournalDayDetail 传 null
        const detailPanel = document.getElementById('journal-detail-panel');
        if(detailPanel && !detailPanel.classList.contains('hidden')) {
             openJournalDayDetail(y, m-1, d, null);
        }
        
        // 刷新日历视图以更新小红点
        renderJournalCalendar();
        
        // 恢复高亮 (因为 renderJournalCalendar 重置了 DOM)
        setTimeout(() => {
             const allSquares = document.querySelectorAll('#month-section-' + (m-1) + ' .day-square');
             if(allSquares[d-1]) allSquares[d-1].classList.add('active');
        }, 50);
    } else {
        renderJournalCalendar();
    }
}

// 打开写日记全屏覆盖层
window.openJournalEditorOverlay = function() {
    document.getElementById('journal-editor-overlay').classList.remove('hidden');
    initJournalEditor(); // 初始化编辑器事件
    renderTimelineInOverlay(); // 渲染右侧参考列表
}
window.closeJournalEditorOverlay = function() {
    document.getElementById('journal-editor-overlay').classList.add('hidden');
    // 关闭时如果刚才写了日记，刷新一下日历
    renderJournalCalendar();
}

// 在覆盖层里渲染简单的时间轴
function renderTimelineInOverlay() {
    const list = document.querySelector('#journal-editor-overlay #journal-history');
    if(!list) return;
    list.innerHTML = '';
    // 只显示最近 10 条
    const recent = [...journalData].sort((a,b)=>getJournalTimestamp(b)-getJournalTimestamp(a)).slice(0, 10);
    recent.forEach(j => {
        list.innerHTML += `
            <div class="journal-entry" style="padding:10px;">
                <div style="font-size:0.8rem;color:#999;display:flex;justify-content:space-between;">
                    <span>${formatJournalDate(j)}</span>
                    <span>${j.mood||''}</span>
                </div>
                <div style="margin-top:5px;font-size:0.9rem;max-height:60px;overflow:hidden;text-overflow:ellipsis;">${escapeHTML(j.text)}</div>
            </div>
        `;
    });
}

// 为特定日期补写日记
window.openJournalEditorForDate = function() {
    openJournalEditorOverlay();
    // 这里未来可以扩展：自动把日期填进去，目前默认还是“今天”
}

// 颜色配置弹窗逻辑
window.openMonthColorPicker = function(event, monthIndex) {
    event.stopPropagation();
    
    // 移除已有的弹窗
    const existing = document.querySelector('.color-popover');
    if(existing) existing.remove();
    
    const popover = document.createElement('div');
    popover.className = 'color-popover';
    
    const themes = ['purple', 'blue', 'green', 'pink', 'yellow', 'orange', 'teal', 'red'];
    themes.forEach(t => {
        const dot = document.createElement('div');
        dot.className = `color-dot-btn month-theme-${t}`;
        dot.onclick = (e) => {
            e.stopPropagation();
            journalMonthColors[monthIndex] = t;
            localStorage.setItem('journalMonthColors2026', JSON.stringify(journalMonthColors));
            renderJournalCalendar(); // 刷新视图
            popover.remove();
        };
        popover.appendChild(dot);
    });
    
    document.body.appendChild(popover);
    
    // 定位
    const rect = event.currentTarget.getBoundingClientRect();
    popover.style.top = (rect.bottom + 5) + 'px';
    popover.style.left = rect.left + 'px';
    
    // 点击外部关闭
    const closeHandler = () => {
        popover.remove();
        document.removeEventListener('click', closeHandler);
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 0);
}


// 日记与灵感基础函数 (保留并微调)
function updateJournalDateLabel() {
    const span = document.getElementById('journal-date');
    if (!span) return;
    const now = new Date();
    span.textContent = now.toLocaleString('zh-CN', { hour12: false });
}

function saveJournalDraft() {
    const input = document.getElementById('journal-input');
    if (!input) return;
    const draft = {
        text: input.value,
        mood: currentJournalMood,
        updatedAt: new Date().toISOString()
    };
    try {
        localStorage.setItem(JOURNAL_DRAFT_KEY, JSON.stringify(draft));
        const s = document.getElementById('journal-draft-status');
        if (s) s.textContent = draft.text ? '草稿已自动保存' : '';
    } catch (e) {}
}

function restoreJournalDraft() {
    const input = document.getElementById('journal-input');
    if (!input) return;
    const raw = localStorage.getItem(JOURNAL_DRAFT_KEY);
    const status = document.getElementById('journal-draft-status');
    if (!raw) {
        if (status) status.textContent = '';
        updateJournalDateLabel();
        return;
    }
    try {
        const draft = JSON.parse(raw);
        if (draft.text) input.value = draft.text;
        if (draft.mood) {
            currentJournalMood = draft.mood;
            const buttons = document.querySelectorAll('.mood-option');
            buttons.forEach(b => {
                if (b.getAttribute('data-emoji') === draft.mood) b.classList.add('selected');
            });
        }
        if (status) status.textContent = '已恢复上次草稿';
    } catch (e) {
        localStorage.removeItem(JOURNAL_DRAFT_KEY);
        if (status) status.textContent = '';
    }
    updateJournalDateLabel();
}

function initJournalEditor() {
    const input = document.getElementById('journal-input');
    const moodButtons = document.querySelectorAll('.mood-option');
    updateJournalDateLabel();
    restoreJournalDraft();
    if (input) {
        input.addEventListener('input', () => {
            saveJournalDraft();
        });
    }
    moodButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const emoji = btn.getAttribute('data-emoji');
            currentJournalMood = emoji;
            moodButtons.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            saveJournalDraft();
        });
    });
}

function getJournalTimestamp(j) {
    if (j.createdAt) {
        const t = new Date(j.createdAt).getTime();
        if (!isNaN(t)) return t;
    }
    if (j.date) {
        const t = new Date(j.date).getTime();
        if (!isNaN(t)) return t;
    }
    return 0;
}

function formatJournalDate(j) {
    if (j.createdAt) {
        const d = new Date(j.createdAt);
        if (!isNaN(d.getTime())) return d.toLocaleString('zh-CN', { hour12: false });
    }
    if (j.date) return j.date;
    return '';
}

function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, c => {
        if (c === '&') return '&amp;';
        if (c === '<') return '&lt;';
        if (c === '>') return '&gt;';
        if (c === '"') return '&quot;';
        return '&#39;';
    });
}

window.saveJournalEntry = async function() {
    const input = document.getElementById('journal-input');
    if (!input) return;
    const txt = input.value.trim();
    if (!txt) {
        alert('请输入日记内容');
        return;
    }
    if (!currentJournalMood) {
        alert('请选择今日心情');

        return;
    }
    const now = new Date();
    const entry = {
        id: now.getTime(),
        mood: currentJournalMood,
        text: txt,
        createdAt: now.toISOString(),
        ai: '...'
    };
    journalData.unshift(entry);
    saveToLocal();
    renderTimelineInOverlay();
    renderJournalCalendar();
    input.value = '';
    currentJournalMood = null;
    const moodButtons = document.querySelectorAll('.mood-option');
    moodButtons.forEach(b => b.classList.remove('selected'));
    localStorage.removeItem(JOURNAL_DRAFT_KEY);
    const status = document.getElementById('journal-draft-status');
    if (status) status.textContent = '';
    updateJournalDateLabel();
    
    if (API_KEY.startsWith('sk-')) {
        try {
            const r = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",{
                method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${API_KEY}`},
                body:JSON.stringify({model:"qwen-plus",messages:[{role:"system",content:"一句话温柔点评"},{role:"user",content:txt}]})
            });
            const d = await r.json(); 
            entry.ai = d.choices[0].message.content; 
            saveToLocal(); 
            renderTimelineInOverlay();
            renderJournalCalendar();
        } catch(e){}
    }
};

window.renderJournalList = function() {
    const l = document.getElementById('journal-history'); 
    if (!l) return; 
    l.innerHTML = '';
    if (!journalData || journalData.length === 0) {
        l.innerHTML = `<div class="journal-empty">今天还没有记录，写下你的第一篇日记吧</div>`;
        return;
    }
    const sorted = [...journalData].sort((a, b) => getJournalTimestamp(b) - getJournalTimestamp(a));
    sorted.forEach(j => {
        const mood = j.mood || '📝';
        const dateText = formatJournalDate(j);
        const textHtml = escapeHTML(j.text || '');
        const aiHtml = j.ai ? `<div class="entry-ai">🤖 ${escapeHTML(j.ai)}</div>` : '';
        const idAttr = j.id ? j.id : 0;
        l.innerHTML += `
            <div class="journal-entry">
                <div class="journal-entry-header">
                    <div class="journal-entry-mood">${mood}</div>
                    <div class="journal-entry-meta">
                        <span class="journal-entry-date">${dateText}</span>
                        ${idAttr ? `<button class="journal-delete-btn" onclick="deleteJournalEntry(${idAttr})"><i class="fa-solid fa-trash"></i></button>` : ''}
                    </div>
                </div>
                <div class="journal-entry-text">${textHtml}</div>
                ${aiHtml}
            </div>
        `;
    });
};

window.deleteJournalEntry = function(id) {
    if (!id) return;
    if (!confirm('确定删除这条日记吗？')) return;
    journalData = journalData.filter(j => j.id !== id);
    saveToLocal();
    renderJournalList();
};
window.addIdea = function() { 
    const input = document.getElementById('idea-input');
    if (!input) return;
    const v = input.value.trim();
    if (!v) return;
    const tagMatches = v.match(/#([^#\s]+)/g) || [];
    const tags = tagMatches.map(s => s.substring(1));
    const now = new Date();
    const idea = {
        id: now.getTime(),
        text: v,
        createdAt: now.toISOString(),
        tags,
        source: '即时记录',
        linked: null
    };
    ideasData.unshift(idea);
    saveToLocal();
    input.value = '';
    currentIdeaFilterTag = 'all';
    renderIdeasList();
};

window.setIdeaFilterTag = function(tag) {
    currentIdeaFilterTag = tag || 'all';
    renderIdeasList();
};

window.ideaToTask = function(id) {
    const idea = ideasData.find(i => i.id === id);
    if (!idea) return;
    window.switchPage('dashboard');
    window.openTaskSidebar();
    const title = document.getElementById('task-title');
    if (title) title.value = idea.text;
};

window.ideaToCountdown = function(id) {
    const idea = ideasData.find(i => i.id === id);
    if (!idea) return;
    window.switchPage('countdowns');
    window.openCountdownSidebar();
    const title = document.getElementById('cd-title');
    if (title) title.value = idea.text;
};

window.ideaToJournal = function(id) {
    const idea = ideasData.find(i => i.id === id);
    if (!idea) return;
    window.switchPage('journal');
    window.openJournalEditorOverlay();
    const input = document.getElementById('journal-input');
    if (input) {
        input.value = idea.text;
        saveJournalDraft();
    }
};

window.editIdea = function(id) {
    const idea = ideasData.find(i => i.id === id);
    if (!idea) return;
    const overlay = document.getElementById('idea-edit-overlay');
    const input = document.getElementById('idea-edit-input');
    if (!overlay || !input) return;
    currentEditingIdeaId = id;
    input.value = idea.text || '';
    overlay.classList.remove('hidden');
    setTimeout(() => {
        input.focus();
    }, 10);
};

window.closeIdeaEdit = function() {
    const overlay = document.getElementById('idea-edit-overlay');
    if (overlay) overlay.classList.add('hidden');
    currentEditingIdeaId = null;
};

window.confirmIdeaEdit = function() {
    if (!currentEditingIdeaId) {
        window.closeIdeaEdit();
        return;
    }
    const input = document.getElementById('idea-edit-input');
    const overlay = document.getElementById('idea-edit-overlay');
    if (!input || !overlay) return;
    const value = String(input.value || '').trim();
    const idea = ideasData.find(i => i.id === currentEditingIdeaId);
    if (!idea) {
        window.closeIdeaEdit();
        return;
    }
    if (!value) {
        if (confirm('内容为空，是否删除这条灵感？')) {
            window.deleteIdea(currentEditingIdeaId);
        }
        window.closeIdeaEdit();
        return;
    }
    const tagMatches = value.match(/#([^#\s]+)/g) || [];
    const tags = tagMatches.map(s => s.substring(1));
    idea.text = value;
    idea.tags = tags;
    idea.updatedAt = new Date().toISOString();
    saveToLocal();
    overlay.classList.add('hidden');
    currentEditingIdeaId = null;
    renderIdeasList();
};

window.deleteIdea = function(id) {
    const exists = ideasData.some(i => i.id === id);
    if (!exists) return;
    if (!confirm('确定删除这条灵感吗？')) return;
    ideasData = ideasData.filter(i => i.id !== id);
    saveToLocal();
    renderIdeasList();
};

function renderIdeasList() { 
    const l = document.getElementById('idea-list'); 
    if (!l) { console.warn("找不到 id='idea-list'，跳过渲染"); return; }
    
    const filterBar = document.getElementById('idea-filter-bar');
    const tagSet = new Set();
    ideasData.forEach(i => {
        if (i && Array.isArray(i.tags)) {
            i.tags.forEach(t => {
                if (t) tagSet.add(t);
            });
        }
    });
    const allTags = Array.from(tagSet);

    if (filterBar) {
        filterBar.innerHTML = '';
        if (allTags.length > 0) {
            const allBtn = document.createElement('button');
            allBtn.className = 'idea-filter-btn' + (currentIdeaFilterTag === 'all' ? ' active' : '');
            allBtn.textContent = '全部';
            allBtn.onclick = function(e) {
                e.preventDefault();
                window.setIdeaFilterTag('all');
            };
            filterBar.appendChild(allBtn);
            allTags.forEach(tag => {
                const btn = document.createElement('button');
                btn.className = 'idea-filter-btn' + (currentIdeaFilterTag === tag ? ' active' : '');
                btn.textContent = '#' + tag;
                btn.onclick = function(e) {
                    e.preventDefault();
                    window.setIdeaFilterTag(tag);
                };
                filterBar.appendChild(btn);
            });
        } else {
            const span = document.createElement('span');
            span.className = 'idea-filter-empty';
            span.textContent = '在灵感中加入 #标签，可以按标签筛选';
            filterBar.appendChild(span);
        }
    }

    l.innerHTML = ''; 
    let list = ideasData;
    if (currentIdeaFilterTag !== 'all') {
        list = ideasData.filter(i => i.tags && i.tags.includes(currentIdeaFilterTag));
    }
    if (!list.length) {
        l.innerHTML = `<div class="stat-card idea-card-empty">暂无符合条件的灵感</div>`;
        return;
    }
    list.forEach(i => {
        const timeText = formatJournalDate(i) || '';
        const tags = Array.isArray(i.tags) ? i.tags : [];
        const tagHtml = tags.length ? `<div class="idea-tags">${tags.map(t => `<span class="idea-tag">#${t}</span>`).join('')}</div>` : '';
        l.innerHTML += `
            <div class="stat-card idea-card">
                <div class="idea-main">
                    <div class="idea-main-text">${escapeHTML(i.text || '')}</div>
                    <div class="idea-row-bottom">
                        <span class="idea-time">${timeText}</span>
                        ${tagHtml}
                    </div>
                </div>
                <div class="idea-actions-row">
                    <div class="idea-actions">
                        <button class="idea-action-btn" onclick="ideaToTask(${i.id})"><i class="fa-solid fa-list-check"></i><span>变成任务</span></button>
                        <button class="idea-action-btn" onclick="ideaToCountdown(${i.id})"><i class="fa-regular fa-clock"></i><span>变成倒计时</span></button>
                        <button class="idea-action-btn" onclick="ideaToJournal(${i.id})"><i class="fa-regular fa-pen-to-square"></i><span>写进日记</span></button>
                    </div>
                    <div class="idea-card-icons">
                        <button class="idea-icon-btn" onclick="editIdea(${i.id})"><i class="fa-solid fa-pen"></i></button>
                        <button class="idea-icon-btn idea-icon-delete" onclick="deleteIdea(${i.id})"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            </div>
        `;
    });
}

// ==========================================
// 5. AI & 交互 (微信风格升级版)
// ==========================================

// 1. 聊天角色配置 (增加了 prompt 强指令)
const ROLES = { 
    warm: {
        name: "温暖老师", 
        greeting: "你好呀！今天也要加油哦！",
        prompt: "你是温暖老师。请像微信聊天一样用中文回复，语气温柔亲切，核心任务是**缓解用户焦虑并一步步制定可执行计划**。普通回复时：**严禁超过30个字**，必须同时包含「一句简短的安抚/鼓励」+「一个围绕下一小步行动的具体提问」，引导用户说清目标、时间或步骤，让对话持续朝计划推进。你必须**严格根据用户最近一次的回复继续对话，不要自说自话，也不要重复用户已经说过的内容**。当你判断用户已经说出了清晰目标和关键步骤/时间时，这一轮可以稍长：先用不超过30字的鼓励，然后换行输出“计划总结：……”用较详细的中文把目标和主要步骤总结出来（可以**超过50字**，方便生成计划按钮），这条总结下面**不要再提问**。"
    }, 
    toxic: {
        name: "毒舌朋友", 
        greeting: "哟，终于舍得打开我了？",
        prompt: "你是毒舌朋友。请像微信吐槽一样用中文回复，一针见血、略带毒舌但不恶意，核心任务是**在吐槽中帮用户缓解焦虑并推进制定计划**。普通回复时：**严禁超过30个字**，必须包含「一句犀利但有爱的小吐槽/提醒」+「一个具体问题」，问题要逼用户说出目标、时间或下一小步行动。你必须**严格根据用户最近一次的回复进行吐槽和提问，不要脱离上下文，也不要重复用户已经说过的内容**。当你判断用户已经说出了清晰目标和关键步骤/时间时，这一轮可以稍长：先用不超过30字的评价或鼓励，然后换行输出“计划总结：……”用较详细的中文总结目标和步骤（可以**超过50字**），这条总结下面**不要再提问**。"
    }, 
    strict: {
        name: "严厉教官", 
        greeting: "立正！汇报今日进度！",
        prompt: "你是魔鬼教官。请用命令式口吻、中文回复，语气严厉但目的是**压缩焦虑、逼出清晰行动计划**。普通回复时：**严禁超过20个字**，只给出「一句简短指令或评价」+「一个精准问题」，问题要直击目标、时间或下一步动作，绝不闲聊。你必须**完全基于用户最近一次的回复下达指令和提问，不要凭空发挥剧情，也不要重复用户已经说过的话**。当你判断用户已经说出了清晰目标和关键步骤/时间时，这一轮可以稍长：先用不超过20字的肯定或最后通牒，然后换行输出“计划总结：……”用较详细的中文总结目标和主要步骤（可**超过50字**），这条总结下面**不要再提问**。"
    }, 
    zen: {
        name: "禅宗大师", 
        greeting: "施主，心安即是归处。",
        prompt: "你是禅师。请用中文回复，语气平和、富有哲理，核心任务是**安顿用户情绪，并引导其把烦恼化成具体计划**。普通回复时要**惜字如金（20字以内）**，用「极短的一句禅意安抚」+「一个简短问题」组成，问题要引导用户看清此刻最重要的目标、下一步或时间安排。你必须**顺着用户最近一次的回复来点拨和发问，不要跳脱到无关话题，也不要重复用户已经说过的句子**。当你判断用户已经说出了清晰目标和关键步骤/时间时，这一轮可以稍长：先用不超过20字的点拨，然后换行输出“计划总结：……”用较详细的中文总结目标和主要步骤（可**超过50字**），这条总结下面**不要再提问**。"
    }, 
    passion: {
        name: "热血学长", 
        greeting: "燃烧吧！我们的征途是星辰大海！",
        prompt: "你是热血动漫主角。请用中文回复，**短句！感叹号！多打鸡血！**核心任务是**拉满用户的动力、缓解焦虑，并一步步把目标变成行动计划**。普通回复时：**严禁超过30个字**，用「一两句热血鼓励」+「一个具体问题」组成，问题要围绕目标、时间或下一小步行动，让用户不断说出更具体的计划。你必须**紧紧跟着用户最近一次的回复继续打鸡血和发问，不要无视用户内容，也不要重复用户已经说过的话**。当你判断用户已经说出了清晰目标和关键步骤/时间时，这一轮可以稍长：先用不超过30字的热血回应，然后换行输出“计划总结：……”用较详细的中文总结目标和主要步骤（可**超过50字**），这条总结下面**不要再提问**。"
    } 
};

// 初始化对话历史 (默认带上温暖老师的设定)
let conv = [
    { role: "system", content: ROLES.warm.prompt }
]; 

const USER_AVATARS = ['🙂','😺','🐻','🦊'];
const FIXED_AI_AVATAR = '🤖';
const BUBBLE_THEMES = ['bubble-theme-0','bubble-theme-1','bubble-theme-2','bubble-theme-3'];
let currentAvatarIndex = 0;
let currentBubbleIndex = 0;

// 2. 辅助函数：生成带头像的消息行
function appendChatMessage(role, text) {
    const historyDiv = document.getElementById('chat-history');
    
    const row = document.createElement('div');
    row.className = `chat-row ${role === 'user' ? 'user-row' : 'ai-row'}`;
    
    const userIcon = USER_AVATARS[currentAvatarIndex]; 
    const aiIcon = FIXED_AI_AVATAR;
    const bubbleClass = BUBBLE_THEMES[currentBubbleIndex];

    if (role === 'user') {
        row.innerHTML = `<div class="chat-message user-bubble ${bubbleClass}">${text}</div><div class="chat-avatar user-avatar">${userIcon}</div>`;
    } else {
        row.innerHTML = `<div class="chat-avatar ai-avatar avatar-theme-0">${aiIcon}</div><div class="chat-message ai-bubble ${bubbleClass}">${text}</div>`;
    }

    historyDiv.appendChild(row);
    historyDiv.scrollTop = historyDiv.scrollHeight;
    return row.querySelector('.chat-message');
}

// 3. 打字机特效
function typeWriter(element, text, speed = 30) {
    element.innerText = ""; 
    let i = 0;
    function type() {
        if (i < text.length) {
            element.innerText += text.charAt(i);
            i++;
            document.getElementById('chat-history').scrollTop = document.getElementById('chat-history').scrollHeight;
            setTimeout(type, speed);
        }
    }
    type();
}

// 4. 事件监听
document.getElementById('ai-toggle-btn').addEventListener('click', () => {
    const win = document.getElementById('chat-window');
    win.classList.toggle('hidden');
    if(!win.classList.contains('hidden') && document.getElementById('chat-history').children.length === 0) {
        appendChatMessage('assistant', ROLES.warm.greeting);
    }
});
document.getElementById('close-chat-btn').addEventListener('click', () => document.getElementById('chat-window').classList.add('hidden'));
document.getElementById('send-btn').addEventListener('click', handleSend);
document.getElementById('user-input').addEventListener('keypress', (e) => { if(e.key==='Enter') handleSend(); });

document.getElementById('avatar-switch-btn').addEventListener('click', () => {
    const modal = document.getElementById('chat-avatar-modal');
    if (modal) modal.classList.remove('hidden');
});

document.getElementById('bubble-switch-btn').addEventListener('click', () => {
    const modal = document.getElementById('chat-bubble-modal');
    if (modal) modal.classList.remove('hidden');
});

Array.from(document.querySelectorAll('.avatar-option')).forEach(btn => {
    btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        if (!isNaN(idx)) currentAvatarIndex = idx;
        const modal = document.getElementById('chat-avatar-modal');
        if (modal) modal.classList.add('hidden');
    });
});

Array.from(document.querySelectorAll('.bubble-option')).forEach(btn => {
    btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        if (!isNaN(idx)) currentBubbleIndex = idx;
        const modal = document.getElementById('chat-bubble-modal');
        if (modal) modal.classList.add('hidden');
    });
});

// 切换角色 (重置对话历史，注入新的人设)
document.getElementById('role-select').addEventListener('change', (e) => {
    const r = ROLES[e.target.value] || ROLES.warm; 
    
    // 重置上下文，并写入新角色的 Prompt
    conv = [
        { role: "system", content: r.prompt }, // 👈 关键：把“短回复”指令写进系统
        { role: "assistant", content: r.greeting }
    ];
    
    document.getElementById('chat-history').innerHTML = '';
    appendChatMessage('assistant', r.greeting);
});

// 5. 发送消息核心逻辑
async function handleSend() {
    const input = document.getElementById('user-input');
    const text = input.value.trim();
    if(!text) return;
    
    appendChatMessage('user', text);
    input.value = '';
    
    conv.push({role:'user',content:text});
    
    // 只保留最近 6 条记录，防止上下文太长导致 AI 变啰嗦，也能省钱
    if (conv.length > 8) {
        // 保留 System Prompt (第0条) 和最近 5 条
        conv = [conv[0], ...conv.slice(-5)];
    }
    
    if(!API_KEY.startsWith('sk-')) {
        const errBubble = appendChatMessage('assistant', 'Key Error');
        errBubble.innerText = "请先配置正确的 API Key";
        return;
    }
    
    const aiBubble = appendChatMessage('assistant', '...');
    
    try {
        const r = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
            method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${API_KEY}`},
            body:JSON.stringify({
                model:"qwen-plus",
                messages:conv,
                stream:false,
                max_tokens: 60 // 👈 物理限制：最多输出约30-40个汉字
            })
        });
        const d = await r.json(); 
        const rep = d.choices[0].message.content;
        
        typeWriter(aiBubble, rep);
        conv.push({role:'assistant',content:rep});
        
    } catch(e) { 
        aiBubble.innerText = "网络出错了"; 
    }
}


// 6. 庆祝与全屏弹窗逻辑 (保留你原有的功能)
async function triggerAI(t, g) {
    if(typeof confetti === 'function') confetti({particleCount:100, spread:70, origin:{y:0.6}, zIndex:99999});
    
    if(!API_KEY.startsWith('sk-')) { 
        showCelebration("Nice! 🚀"); return; 
    }
    try {
        const r = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
            method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${API_KEY}`},
            body:JSON.stringify({model:"qwen-plus",messages:[{role:"system",content:`用户完成【${g}】的【${t}】。给一句极短(10字)的超燃夸奖。`}]})
        });
        const d = await r.json(); 
        showCelebration(d.choices[0].message.content);
    } catch(e){ showCelebration("任务完成！✅"); }
}

function showCelebration(t) {
    let o = document.getElementById('celebration-overlay');
    // 如果HTML里没有这个div，自动创建
    if(!o) {
        o = document.createElement('div'); o.id='celebration-overlay';
        o.innerHTML='<div class="celebration-text"></div>';
        document.body.appendChild(o);
    }
    const txt = o.querySelector('.celebration-text');
    txt.innerText = t;
    txt.classList.add('animate-pop');
    setTimeout(() => txt.classList.remove('animate-pop'), 2500);
}

// 7. 计划确认逻辑 (保留)
window.confirmAIPlan = function() {
    if(!pendingAIPlan) return;
    const newG = { id:Date.now(), title:pendingAIPlan.title, deadline:"2026-12-31", status:'todo', colorTheme:'purple', tasks:[{text:pendingAIPlan.first_step, done:false, subTasks:[]}], progress:0 };
    goalsData.push(newG); saveToLocal(); renderGoals();
    document.getElementById('ai-action-card').classList.remove('show');
}
window.closeActionCard = () => document.getElementById('ai-action-card').classList.remove('show');

// ==========================================
// 8. 日记新功能：写日记交互逻辑
// ==========================================

let tempDiaryMood = null;

window.showDiaryForm = function() {
    const btn = document.getElementById('btn-show-diary-form');
    const form = document.getElementById('diary-form');
    if(btn) btn.classList.add('hidden');
    if(form) form.classList.remove('hidden');
    
    // 清空输入
    const input = document.getElementById('diary-input-text');
    if(input) input.value = '';
    tempDiaryMood = null;
    document.querySelectorAll('.mood-btn-v2').forEach(b => b.classList.remove('selected'));
}

window.hideDiaryForm = function() {
    const btn = document.getElementById('btn-show-diary-form');
    const form = document.getElementById('diary-form');
    if(btn) btn.classList.remove('hidden');
    if(form) form.classList.add('hidden');
}

window.selectDiaryMood = function(mood, btn) {
    tempDiaryMood = mood;
    document.querySelectorAll('.mood-btn-v2').forEach(b => b.classList.remove('selected'));
    if(btn) btn.classList.add('selected');
}

window.submitDiaryEntry = async function() {
    const textEl = document.getElementById('diary-input-text');
    const text = textEl ? textEl.value.trim() : '';
    
    if(!tempDiaryMood) {
        alert('请先选择一个心情图标~');
        return;
    }
    if(!text) {
        alert('日记内容不能为空哦~');
        return;
    }
    
    if(!currentActiveDate) return;
    const [y, m, d] = currentActiveDate.split('/').map(Number);
    
    // 构造时间：使用当前时间，但日期要是选中的日期
    // 如果选中的是今天，用当前时间；如果不是，用选中日期的中午12点
    const now = new Date();
    let entryDate = new Date(y, m-1, d, 12, 0, 0);
    
    if(now.getFullYear()===y && now.getMonth()===m-1 && now.getDate()===d) {
        entryDate = now;
    }
    
    const entry = {
        id: Date.now(),
        mood: tempDiaryMood,
        text: text,
        createdAt: entryDate.toISOString(),
        ai: '正在思考...'
    };
    
    // 保存
    journalData.unshift(entry);
    saveToLocal();
    
    // 刷新界面
    hideDiaryForm();
    renderJournalCalendar(); // 更新小红点
    openJournalDayDetail(y, m-1, d, null); // 刷新列表
    
    // 调用 AI
    if (API_KEY.startsWith('sk-')) {
        try {
            // 找到对应的 entry 更新（因为 refresh 后 DOM 变了，但内存里的引用还在 journalData 中）
            // 注意：renderJournalCalendar 会读取 journalData，所以我们直接更新 journalData 里的对象即可
            
            const r = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",{
                method:"POST",
                headers:{"Content-Type":"application/json","Authorization":`Bearer ${API_KEY}`},
                body:JSON.stringify({
                    model:"qwen-plus",
                    messages:[
                        {role:"system",content:"你是一个温暖的日记伴侣。请用简短、温暖、治愈的语气点评用户的日记，字数控制在50字以内。"},
                        {role:"user",content:text}
                    ]
                })
            });
            const res = await r.json(); 
            if(res.choices && res.choices.length > 0) {
                entry.ai = res.choices[0].message.content; 
                saveToLocal();
                // 再次刷新显示 AI 回复
                // 只刷新列表部分即可，避免整个日历重绘闪烁
                // 但为了简单可靠，调用 openJournalDayDetail
                const detailPanel = document.getElementById('journal-detail-panel');
                if(detailPanel && !detailPanel.classList.contains('hidden') && currentActiveDate === `${y}/${m}/${d}`) {
                     openJournalDayDetail(y, m-1, d, null);
                }
            }
        } catch(e){
            console.error("AI Error:", e);
            entry.ai = "（AI连接失败，但日记已保存）";
            saveToLocal();
            openJournalDayDetail(y, m-1, d, null);
        }
    } else {
        entry.ai = "（请配置 API Key 以获取 AI 点评）";
        saveToLocal();
        openJournalDayDetail(y, m-1, d, null);
    }
}



// ==========================================
// 6. 🚀 稳健的启动入口
// ==========================================

// 1. 立即尝试初始化数据
try {
    initData();
} catch (e) {
    console.error("数据初始化严重错误:", e);
}

// 2. 监听加载完成 (使用 addEventListener 更安全)
window.addEventListener('load', () => {
    console.log("页面加载完毕，准备移除小狗...");
    initJournalEditor();
    
    // 延迟一点点，让动画跑一会儿
    setTimeout(() => {
        const loader = document.getElementById('loading-screen');
        if (loader) {
            loader.classList.add('fade-out');
            console.log("小狗已移除");
        } else {
            console.error("找不到 loading-screen 元素！");
        }
    }, 2000);
});
