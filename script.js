let state = {
    activeTab: 'home',
    globalTargetRate: 80,
    subjects: []
};

window.onload = () => {
    const saved = localStorage.getItem('attendance_v5');
    if (saved) state = JSON.parse(saved);
    render();
};

function saveData() {
    localStorage.setItem('attendance_v5', JSON.stringify(state));
}

function addSubject(e) {
    if(e) e.preventDefault();
    const newSub = {
        id: Date.now(),
        name: "新しい教科",
        present: 0,
        absent: 0,
        totalClasses: 15
    };
    state.subjects.push(newSub);
    state.activeTab = newSub.id;
    saveData();
    render();
}

function switchTab(id) {
    state.activeTab = id;
    render();
}

function updateGlobalTarget(val) {
    state.globalTargetRate = Math.max(0, Math.min(100, parseFloat(val) || 0));
    saveData();
    // 入力中はrender()を呼ばず、数値だけ保存する
}

function updateSubject(id, field, val, e) {
    if(e) e.preventDefault();
    const sub = state.subjects.find(s => s.id === id);
    if (sub) {
        if (field === 'name') {
            sub[field] = val;
            renderTabs(); // 名前はタブに即反映させる
        } else {
            let num = Math.max(0, parseFloat(val) || 0);
            if(field === 'totalClasses' && num < (sub.present + sub.absent)) {
                num = sub.present + sub.absent;
            }
            sub[field] = num;
        }
        saveData();
    }
}

function changeCount(id, field, delta, e) {
    if(e) e.preventDefault();
    const sub = state.subjects.find(s => s.id === id);
    if (sub) {
        const nextVal = sub[field] + delta;
        if (delta > 0 && (sub.present + sub.absent + 1) > sub.totalClasses) return;
        if (nextVal >= 0) {
            sub[field] = nextVal;
            saveData();
            render(); // カウント変更時はUI更新が必要
        }
    }
}

function deleteSubject(id, e) {
    if(e) e.preventDefault();
    if(confirm("この教科を削除しますか？")) {
        state.subjects = state.subjects.filter(s => s.id !== id);
        state.activeTab = 'home';
        saveData();
        render();
    }
}

function getCalc(sub) {
    const currentTotal = sub.present + sub.absent;
    const rate = currentTotal === 0 ? 0 : (sub.present / currentTotal * 100);
    const remaining = Math.max(0, sub.totalClasses - currentTotal);
    const maxAbsentAllowed = Math.floor(sub.totalClasses * (1 - state.globalTargetRate / 100));
    const allowAbsent = maxAbsentAllowed - sub.absent;
    const maxPossibleRate = ((sub.present + remaining) / sub.totalClasses * 100);
    const isImpossible = maxPossibleRate < state.globalTargetRate;

    return {
        rate: rate.toFixed(1),
        remaining: remaining,
        allowAbsent: Math.max(0, allowAbsent),
        isDanger: rate < state.globalTargetRate,
        isImpossible: isImpossible,
        maxAbsentRaw: allowAbsent,
        isAtLimit: currentTotal >= sub.totalClasses
    };
}

function renderTabs() {
    const tabContainer = document.getElementById('subject-tabs');
    const homeTab = document.getElementById('tab-home');
    if(homeTab) homeTab.className = `tab ${state.activeTab === 'home' ? 'active' : ''}`;
    
    tabContainer.innerHTML = state.subjects.map(sub => `
        <div class="tab ${state.activeTab === sub.id ? 'active' : ''}" onclick="switchTab(${sub.id})">
            ${sub.name}
        </div>
    `).join('');
}

function render() {
    renderTabs();
    const content = document.getElementById('main-content');
    
    if (state.activeTab === 'home') {
        let rows = state.subjects.map(sub => {
            const c = getCalc(sub);
            return `
                <tr>
                    <td style="text-align:left"><b>${sub.name}</b></td>
                    <td class="${c.isDanger ? 'status-ng' : 'status-ok'}">
                        ${c.rate}%
                        ${c.isImpossible ? '<span class="impossible">達成不可</span>' : ''}
                    </td>
                    <td>${sub.totalClasses}</td>
                    <td>${c.remaining}</td>
                    <td>
                        <b style="font-size:1.2em; color:${c.maxAbsentRaw < 0 ? 'var(--danger-color)' : 'var(--success-color)'}">
                            ${c.maxAbsentRaw < 0 ? '不可' : c.allowAbsent}
                        </b>
                    </td>
                </tr>
            `;
        }).join('');

        content.innerHTML = `
            <div class="card">
                <h2>全体サマリー</h2>
                <div class="global-settings">
                    <label>全教科共通 目標出席率:</label>
                    <input type="number" value="${state.globalTargetRate}" 
                        oninput="updateGlobalTarget(this.value)" 
                        onblur="render()"> 
                    <span>%</span>
                </div>
                ${state.subjects.length === 0 ? '<p>右下の「＋」から教科を追加してください。</p>' : `
                    <table>
                        <thead>
                            <tr><th>教科名</th><th>出席率</th><th>全コマ</th><th>残り</th><th>許容欠席</th></tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                `}
            </div>
        `;
    } else {
        const sub = state.subjects.find(s => s.id === state.activeTab);
        if (!sub) return;
        const c = getCalc(sub);

        content.innerHTML = `
            <div class="card">
                <div class="input-group">
                    <label>教科名</label>
                    <input type="text" style="font-size:1.2em; font-weight:bold;" value="${sub.name}" 
                        oninput="updateSubject(${sub.id}, 'name', this.value, event)">
                </div>
                <div class="input-group">
                    <label>この教科の全授業コマ数</label>
                    <input type="number" value="${sub.totalClasses}" 
                        oninput="updateSubject(${sub.id}, 'totalClasses', this.value, event)"
                        onblur="render()">
                </div>
                
                <div class="stats-grid">
                    <div class="stat-item" style="${c.isImpossible ? 'background:#ffebee; border-radius:8px;' : ''}">
                        <div class="stat-label">現在の出席率</div>
                        <div class="stat-value ${c.isDanger ? 'status-ng' : 'status-ok'}">${c.rate}%</div>
                        <div style="font-size:0.7em">(目標: ${state.globalTargetRate}%)</div>
                        ${c.isImpossible ? '<span class="impossible">目標達成不可</span>' : ''}
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">残り授業数</div>
                        <div class="stat-value" style="color:#5f6368">${c.remaining}</div>
                    </div>
                    <div class="stat-item" style="grid-column: span 2; border-top: 1px solid #ddd; padding-top:10px;">
                        <div class="stat-label">あと何回休める？</div>
                        <div class="stat-value" style="color:${c.maxAbsentRaw < 0 ? 'var(--danger-color)' : 'var(--success-color)'}">
                            ${c.maxAbsentRaw < 0 ? 'もう休めません' : c.allowAbsent + ' 回'}
                        </div>
                    </div>
                </div>

                <div class="btn-row">
                    <div class="counter-unit">
                        <div class="stat-label">出席</div>
                        <div class="count-display">${sub.present}</div>
                        <button onclick="changeCount(${sub.id}, 'present', 1, event)" ${c.isAtLimit ? 'disabled' : ''}>＋</button>
                        <button class="minus" onclick="changeCount(${sub.id}, 'present', -1, event)" ${sub.present <= 0 ? 'disabled' : ''}>－</button>
                    </div>
                    <div style="width: 40px;"></div>
                    <div class="counter-unit">
                        <div class="stat-label">欠席</div>
                        <div class="count-display">${sub.absent}</div>
                        <button onclick="changeCount(${sub.id}, 'absent', 1, event)" ${c.isAtLimit ? 'disabled' : ''}>＋</button>
                        <button class="minus" onclick="changeCount(${sub.id}, 'absent', -1, event)" ${sub.absent <= 0 ? 'disabled' : ''}>－</button>
                    </div>
                </div>
                
                <p style="text-align:center; color:#777; font-size:0.8em;">合計 (${sub.present + sub.absent} / ${sub.totalClasses})</p>

                <button class="delete-btn" onclick="deleteSubject(${sub.id}, event)">この教科を削除する</button>
            </div>
        `;
    }
}
