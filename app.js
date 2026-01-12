// 認証マネージャー
class AuthManager {
    constructor() {
        this.currentUser = null;
    }

    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    generateUserId(username) {
        return 'user_' + username.toLowerCase().replace(/[^a-z0-9]/g, '_');
    }

    async register(username, password) {
        if (!username || !password) {
            throw new Error('ユーザー名とパスワードを入力してください');
        }

        if (username.length < 3) {
            throw new Error('ユーザー名は3文字以上で入力してください');
        }

        if (password.length < 4) {
            throw new Error('パスワードは4文字以上で入力してください');
        }

        const userId = this.generateUserId(username);
        const existingUser = localStorage.getItem(`user_${userId}`);

        if (existingUser) {
            throw new Error('このユーザー名は既に使用されています');
        }

        const passwordHash = await this.hashPassword(password);
        const userData = {
            username: username,
            passwordHash: passwordHash,
            createdAt: Date.now()
        };

        localStorage.setItem(`user_${userId}`, JSON.stringify(userData));
        return userId;
    }

    async login(username, password) {
        if (!username || !password) {
            throw new Error('ユーザー名とパスワードを入力してください');
        }

        const userId = this.generateUserId(username);
        const userDataStr = localStorage.getItem(`user_${userId}`);

        if (!userDataStr) {
            throw new Error('ユーザー名またはパスワードが間違っています');
        }

        const userData = JSON.parse(userDataStr);
        const passwordHash = await this.hashPassword(password);

        if (userData.passwordHash !== passwordHash) {
            throw new Error('ユーザー名またはパスワードが間違っています');
        }

        this.currentUser = {
            userId: userId,
            username: userData.username
        };

        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
        return this.currentUser;
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
    }

    getCurrentUser() {
        if (this.currentUser) {
            return this.currentUser;
        }

        const userStr = localStorage.getItem('currentUser');
        if (userStr) {
            this.currentUser = JSON.parse(userStr);
            return this.currentUser;
        }

        return null;
    }
}

// データマネージャー
class DataManager {
    constructor(userId) {
        this.userId = userId;
        this.storageKey = `taskhabit_${userId}`;
        this.data = this.loadData();
    }

    loadData() {
        const dataStr = localStorage.getItem(this.storageKey);
        if (dataStr) {
            return JSON.parse(dataStr);
        }

        return {
            tasks: [],
            habits: [],
            goals: [],
            habitLogs: [],
            lastSync: Date.now()
        };
    }

    saveData() {
        this.data.lastSync = Date.now();
        localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    }

    generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // タスク管理
    addTask(task) {
        task.id = this.generateId();
        task.createdAt = Date.now();
        task.status = 'todo';
        this.data.tasks.push(task);
        this.saveData();
        return task;
    }

    updateTask(taskId, updates) {
        const task = this.data.tasks.find(t => t.id === taskId);
        if (task) {
            Object.assign(task, updates);
            task.updatedAt = Date.now();
            this.saveData();
        }
        return task;
    }

    deleteTask(taskId) {
        this.data.tasks = this.data.tasks.filter(t => t.id !== taskId);
        this.saveData();
    }

    getTasks(filter = {}) {
        return this.data.tasks.filter(task => {
            if (filter.status && task.status !== filter.status) return false;
            if (filter.type && task.type !== filter.type) return false;
            if (filter.habitId && task.habitId !== filter.habitId) return false;
            return true;
        });
    }

    // 習慣管理
    addHabit(habit) {
        habit.id = this.generateId();
        habit.createdAt = Date.now();
        habit.streak = 0;
        habit.longestStreak = 0;
        habit.totalCompleted = 0;
        this.data.habits.push(habit);
        this.saveData();
        return habit;
    }

    updateHabit(habitId, updates) {
        const habit = this.data.habits.find(h => h.id === habitId);
        if (habit) {
            Object.assign(habit, updates);
            habit.updatedAt = Date.now();
            this.saveData();
        }
        return habit;
    }

    deleteHabit(habitId) {
        this.data.habits = this.data.habits.filter(h => h.id !== habitId);
        this.data.habitLogs = this.data.habitLogs.filter(l => l.habitId !== habitId);
        this.saveData();
    }

    getHabits() {
        return this.data.habits;
    }

    // 習慣ログ
    logHabit(habitId, log) {
        const habit = this.data.habits.find(h => h.id === habitId);
        if (!habit) return null;

        const logEntry = {
            id: this.generateId(),
            habitId: habitId,
            date: this.getTodayString(),
            timestamp: Date.now(),
            time: log.time || 0,
            note: log.note || ''
        };

        this.data.habitLogs.push(logEntry);

        // 連続記録を更新
        this.updateHabitStreak(habitId);

        habit.totalCompleted++;
        this.saveData();
        return logEntry;
    }

    getHabitLogs(habitId, dateStr = null) {
        return this.data.habitLogs.filter(log => {
            if (log.habitId !== habitId) return false;
            if (dateStr && log.date !== dateStr) return false;
            return true;
        });
    }

    getTodayString() {
        const today = new Date();
        return today.toISOString().split('T')[0];
    }

    updateHabitStreak(habitId) {
        const habit = this.data.habits.find(h => h.id === habitId);
        if (!habit) return;

        const logs = this.getHabitLogs(habitId);
        const sortedDates = [...new Set(logs.map(l => l.date))].sort().reverse();

        let streak = 0;
        const today = this.getTodayString();
        let checkDate = new Date(today);

        for (let i = 0; i < sortedDates.length; i++) {
            const logDate = sortedDates[i];
            const expectedDate = checkDate.toISOString().split('T')[0];

            if (logDate === expectedDate) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }

        habit.streak = streak;
        if (streak > habit.longestStreak) {
            habit.longestStreak = streak;
        }
        this.saveData();
    }

    isHabitCompletedToday(habitId) {
        const today = this.getTodayString();
        return this.getHabitLogs(habitId, today).length > 0;
    }

    // 目標管理
    addGoal(goal) {
        goal.id = this.generateId();
        goal.createdAt = Date.now();
        goal.progress = 0;
        this.data.goals.push(goal);
        this.saveData();
        return goal;
    }

    updateGoal(goalId, updates) {
        const goal = this.data.goals.find(g => g.id === goalId);
        if (goal) {
            Object.assign(goal, updates);
            goal.updatedAt = Date.now();
            this.saveData();
        }
        return goal;
    }

    deleteGoal(goalId) {
        this.data.goals = this.data.goals.filter(g => g.id !== goalId);
        this.saveData();
    }

    getGoals() {
        return this.data.goals;
    }

    calculateGoalProgress(goalId) {
        const goal = this.data.goals.find(g => g.id === goalId);
        if (!goal || !goal.habitIds || goal.habitIds.length === 0) return 0;

        let totalRate = 0;
        goal.habitIds.forEach(habitId => {
            const habit = this.data.habits.find(h => h.id === habitId);
            if (habit) {
                const logs = this.getHabitLogs(habitId);
                const daysActive = Math.floor((Date.now() - habit.createdAt) / (1000 * 60 * 60 * 24)) + 1;
                const completionRate = logs.length / daysActive;
                totalRate += completionRate;
            }
        });

        return Math.min(Math.round((totalRate / goal.habitIds.length) * 100), 100);
    }

    // エクスポート/インポート
    exportData() {
        return JSON.stringify(this.data, null, 2);
    }

    importData(jsonStr) {
        try {
            const imported = JSON.parse(jsonStr);
            this.data = imported;
            this.saveData();
            return true;
        } catch (e) {
            throw new Error('無効なデータ形式です');
        }
    }

    // 統計
    getWeeklyStats() {
        const today = new Date();
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

        const weeklyLogs = this.data.habitLogs.filter(log => {
            const logDate = new Date(log.timestamp);
            return logDate >= weekAgo && logDate <= today;
        });

        const tasksCompleted = this.data.tasks.filter(task => {
            return task.status === 'done' && 
                   task.updatedAt >= weekAgo.getTime() &&
                   task.updatedAt <= today.getTime();
        }).length;

        return {
            habitLogs: weeklyLogs.length,
            tasksCompleted: tasksCompleted,
            totalTime: weeklyLogs.reduce((sum, log) => sum + (log.time || 0), 0)
        };
    }

    getMonthlyStats() {
        const today = new Date();
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

        const monthlyLogs = this.data.habitLogs.filter(log => {
            const logDate = new Date(log.timestamp);
            return logDate >= monthAgo && logDate <= today;
        });

        const tasksCompleted = this.data.tasks.filter(task => {
            return task.status === 'done' && 
                   task.updatedAt >= monthAgo.getTime() &&
                   task.updatedAt <= today.getTime();
        }).length;

        return {
            habitLogs: monthlyLogs.length,
            tasksCompleted: tasksCompleted,
            totalTime: monthlyLogs.reduce((sum, log) => sum + (log.time || 0), 0)
        };
    }
}

// UIマネージャー
class UIManager {
    constructor(authManager, dataManager) {
        this.authManager = authManager;
        this.dataManager = dataManager;
        this.currentView = 'dashboard';
        this.currentTask = null;
        this.currentHabit = null;
        this.currentGoal = null;
        this.initElements();
        this.initEventListeners();
    }

    initElements() {
        // 画面
        this.loginScreen = document.getElementById('loginScreen');
        this.appScreen = document.getElementById('appScreen');

        // ログインフォーム
        this.loginForm = document.getElementById('loginForm');
        this.registerForm = document.getElementById('registerForm');

        // ナビゲーション
        this.navTabs = document.querySelectorAll('.nav-tab');

        // ビュー
        this.dashboardView = document.getElementById('dashboardView');
        this.tasksView = document.getElementById('tasksView');
        this.habitsView = document.getElementById('habitsView');
        this.reportsView = document.getElementById('reportsView');
        this.goalsView = document.getElementById('goalsView');

        // モーダル
        this.taskModal = document.getElementById('taskModal');
        this.habitModal = document.getElementById('habitModal');
        this.habitLogModal = document.getElementById('habitLogModal');
        this.goalModal = document.getElementById('goalModal');
        this.importModal = document.getElementById('importModal');
    }

    initEventListeners() {
        // ログイン/登録
        document.getElementById('loginBtn')?.addEventListener('click', () => this.handleLogin());
        document.getElementById('registerBtn')?.addEventListener('click', () => this.handleRegister());
        document.getElementById('showRegisterBtn')?.addEventListener('click', () => this.toggleLoginRegister());
        document.getElementById('showLoginBtn')?.addEventListener('click', () => this.toggleLoginRegister());
        document.getElementById('logoutBtn')?.addEventListener('click', () => this.handleLogout());

        // ナビゲーション
        this.navTabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchView(tab.dataset.view));
        });

        // タスク
        document.getElementById('addTaskBtn')?.addEventListener('click', () => this.openTaskModal());
        document.getElementById('addHabitTaskBtn')?.addEventListener('click', () => this.openTaskModal('habit'));
        document.getElementById('saveTaskBtn')?.addEventListener('click', () => this.saveTask());
        document.getElementById('cancelTaskBtn')?.addEventListener('click', () => this.closeModal('taskModal'));

        // 習慣
        document.getElementById('addHabitBtn')?.addEventListener('click', () => this.openHabitModal());
        document.getElementById('saveHabitBtn')?.addEventListener('click', () => this.saveHabit());
        document.getElementById('cancelHabitBtn')?.addEventListener('click', () => this.closeModal('habitModal'));

        // 習慣ログ
        document.getElementById('saveHabitLogBtn')?.addEventListener('click', () => this.saveHabitLog());
        document.getElementById('cancelHabitLogBtn')?.addEventListener('click', () => this.closeModal('habitLogModal'));

        // 目標
        document.getElementById('addGoalBtn')?.addEventListener('click', () => this.openGoalModal());
        document.getElementById('saveGoalBtn')?.addEventListener('click', () => this.saveGoal());
        document.getElementById('cancelGoalBtn')?.addEventListener('click', () => this.closeModal('goalModal'));

        // データ
        document.getElementById('exportBtn')?.addEventListener('click', () => this.exportData());
        document.getElementById('importBtn')?.addEventListener('click', () => this.openModal('importModal'));
        document.getElementById('confirmImportBtn')?.addEventListener('click', () => this.importData());
        document.getElementById('cancelImportBtn')?.addEventListener('click', () => this.closeModal('importModal'));

        // モーダルclose
        document.querySelectorAll('.close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    modal.classList.remove('active');
                }
            });
        });

        // タスクタイプ変更
        document.getElementById('taskTypeInput')?.addEventListener('change', (e) => {
            const habitGroup = document.getElementById('habitSelectGroup');
            if (e.target.value === 'habit') {
                habitGroup.style.display = 'block';
                this.populateHabitSelect();
            } else {
                habitGroup.style.display = 'none';
            }
        });

        // 習慣頻度変更
        document.getElementById('habitFrequencyInput')?.addEventListener('change', (e) => {
            const customGroup = document.getElementById('customDaysGroup');
            if (e.target.value === 'custom') {
                customGroup.style.display = 'block';
            } else {
                customGroup.style.display = 'none';
            }
        });

        // レポート期間変更
        document.getElementById('reportPeriod')?.addEventListener('change', () => {
            if (this.currentView === 'reports') {
                this.renderReports();
            }
        });

        // タスクフィルター
        document.getElementById('taskFilter')?.addEventListener('change', () => {
            this.renderTaskBoard();
        });

        // ドラッグ&ドロップ設定
        this.setupDragAndDrop();
    }

    setupDragAndDrop() {
        const columns = document.querySelectorAll('.task-list');
        
        columns.forEach(column => {
            column.addEventListener('dragover', (e) => {
                e.preventDefault();
                const dragging = document.querySelector('.dragging');
                if (dragging) {
                    column.appendChild(dragging);
                }
            });

            column.addEventListener('drop', (e) => {
                e.preventDefault();
                const dragging = document.querySelector('.dragging');
                if (dragging) {
                    const taskId = dragging.dataset.taskId;
                    const newStatus = column.dataset.status;
                    this.dataManager.updateTask(taskId, { status: newStatus });
                    this.renderTaskBoard();
                    this.renderDashboard();
                }
            });
        });
    }

    async handleLogin() {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;

        try {
            await this.authManager.login(username, password);
            this.dataManager = new DataManager(this.authManager.currentUser.userId);
            this.showApp();
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    async handleRegister() {
        const username = document.getElementById('registerUsername').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirmPassword').value;

        if (password !== confirmPassword) {
            this.showNotification('パスワードが一致しません', 'error');
            return;
        }

        try {
            await this.authManager.register(username, password);
            await this.authManager.login(username, password);
            this.dataManager = new DataManager(this.authManager.currentUser.userId);
            this.showApp();
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    handleLogout() {
        this.authManager.logout();
        this.loginScreen.style.display = 'flex';
        this.appScreen.style.display = 'none';
        this.loginForm.style.display = 'block';
        this.registerForm.style.display = 'none';
    }

    toggleLoginRegister() {
        if (this.loginForm.style.display === 'none') {
            this.loginForm.style.display = 'block';
            this.registerForm.style.display = 'none';
        } else {
            this.loginForm.style.display = 'none';
            this.registerForm.style.display = 'block';
        }
    }

    showApp() {
        this.loginScreen.style.display = 'none';
        this.appScreen.style.display = 'block';
        document.getElementById('currentUser').textContent = this.authManager.currentUser.username;
        this.updateCurrentDate();
        this.switchView('dashboard');
    }

    updateCurrentDate() {
        const today = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        document.getElementById('currentDate').textContent = today.toLocaleDateString('ja-JP', options);
    }

    switchView(view) {
        this.currentView = view;

        // すべてのビューを非表示
        this.dashboardView.style.display = 'none';
        this.tasksView.style.display = 'none';
        this.habitsView.style.display = 'none';
        this.reportsView.style.display = 'none';
        this.goalsView.style.display = 'none';

        // タブのアクティブ状態を更新
        this.navTabs.forEach(tab => {
            if (tab.dataset.view === view) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // 選択されたビューを表示してレンダリング
        switch(view) {
            case 'dashboard':
                this.dashboardView.style.display = 'block';
                this.renderDashboard();
                break;
            case 'tasks':
                this.tasksView.style.display = 'block';
                this.renderTaskBoard();
                break;
            case 'habits':
                this.habitsView.style.display = 'block';
                this.renderHabits();
                break;
            case 'reports':
                this.reportsView.style.display = 'block';
                this.renderReports();
                break;
            case 'goals':
                this.goalsView.style.display = 'block';
                this.renderGoals();
                break;
        }
    }

    renderDashboard() {
        // サマリーカード
        const tasks = this.dataManager.getTasks();
        const habits = this.dataManager.getHabits();
        const todayTasks = tasks.filter(t => t.status !== 'done');
        
        let completedToday = 0;
        let longestStreak = 0;
        habits.forEach(habit => {
            if (this.dataManager.isHabitCompletedToday(habit.id)) {
                completedToday++;
            }
            if (habit.longestStreak > longestStreak) {
                longestStreak = habit.longestStreak;
            }
        });

        const habitRate = habits.length > 0 ? Math.round((completedToday / habits.length) * 100) : 0;

        document.getElementById('todayTasksCount').textContent = todayTasks.length;
        document.getElementById('habitCompletionRate').textContent = habitRate + '%';
        document.getElementById('longestStreak').textContent = longestStreak + '日';

        const todayLogs = this.dataManager.data.habitLogs.filter(log => 
            log.date === this.dataManager.getTodayString()
        );
        const totalMinutes = todayLogs.reduce((sum, log) => sum + (log.time || 0), 0);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        document.getElementById('todayWorkTime').textContent = hours > 0 ? `${hours}h${minutes}m` : `${minutes}m`;

        // 今日の習慣
        this.renderTodayHabits();

        // 今日のタスク
        this.renderTodayTasks();
    }

    renderTodayHabits() {
        const container = document.getElementById('todayHabitsQuick');
        const habits = this.dataManager.getHabits();

        if (habits.length === 0) {
            container.innerHTML = '<p class="empty-message">習慣が登録されていません</p>';
            return;
        }

        container.innerHTML = habits.map(habit => {
            const completed = this.dataManager.isHabitCompletedToday(habit.id);
            return `
                <div class="habit-quick-item">
                    <div class="habit-quick-info">
                        <div class="habit-icon">${habit.icon || '📚'}</div>
                        <div class="habit-details">
                            <div class="habit-name">${habit.name}</div>
                            <div class="habit-streak">🔥 ${habit.streak}日連続</div>
                        </div>
                    </div>
                    <button class="habit-check-btn ${completed ? 'completed' : ''}" 
                            onclick="uiManager.quickLogHabit('${habit.id}')">
                        ${completed ? '✓' : ''}
                    </button>
                </div>
            `;
        }).join('');
    }

    renderTodayTasks() {
        const container = document.getElementById('todayTasksList');
        const tasks = this.dataManager.getTasks().filter(t => t.status !== 'done');

        if (tasks.length === 0) {
            container.innerHTML = '<p class="empty-message">今日のタスクはありません</p>';
            return;
        }

        container.innerHTML = tasks.map(task => `
            <div class="task-item-simple ${task.type === 'habit' ? 'habit-task' : ''} ${task.type === 'project' ? 'project-task' : ''}">
                <input type="checkbox" onchange="uiManager.completeTaskQuick('${task.id}')" 
                       ${task.status === 'inProgress' ? 'checked' : ''}>
                <div style="flex: 1;">
                    <div style="font-weight: 600;">${task.name}</div>
                    ${task.desc ? `<div style="font-size: 0.85rem; color: var(--text-secondary);">${task.desc}</div>` : ''}
                </div>
                ${task.estimatedTime ? `<span style="font-size: 0.85rem; color: var(--text-secondary);">⏱️ ${task.estimatedTime}分</span>` : ''}
            </div>
        `).join('');
    }

    quickLogHabit(habitId) {
        if (this.dataManager.isHabitCompletedToday(habitId)) {
            this.showNotification('今日は既に記録済みです', 'error');
            return;
        }

        this.currentHabit = this.dataManager.getHabits().find(h => h.id === habitId);
        this.openHabitLogModal(habitId);
    }

    completeTaskQuick(taskId) {
        const task = this.dataManager.getTasks().find(t => t.id === taskId);
        if (task.status === 'todo') {
            this.dataManager.updateTask(taskId, { status: 'inProgress' });
        } else {
            this.dataManager.updateTask(taskId, { status: 'done' });
        }
        this.renderDashboard();
        this.showNotification('タスクを更新しました', 'success');
    }

    renderTaskBoard() {
        const filter = document.getElementById('taskFilter')?.value || 'all';
        const tasks = this.dataManager.getTasks();

        const filteredTasks = filter === 'all' ? tasks : tasks.filter(t => {
            if (filter === 'habit') return t.type === 'habit';
            if (filter === 'normal') return t.type === 'normal';
            if (filter === 'project') return t.type === 'project';
            return true;
        });

        ['todo', 'inProgress', 'done'].forEach(status => {
            const column = document.getElementById(status + 'Column');
            const statusTasks = filteredTasks.filter(t => t.status === status);
            
            document.getElementById(status + 'Count').textContent = statusTasks.length;

            if (statusTasks.length === 0) {
                column.innerHTML = '<p class="empty-message">タスクなし</p>';
                return;
            }

            column.innerHTML = statusTasks.map(task => this.createTaskCard(task)).join('');

            // ドラッグ可能に設定
            column.querySelectorAll('.task-card').forEach(card => {
                card.draggable = true;
                card.addEventListener('dragstart', () => card.classList.add('dragging'));
                card.addEventListener('dragend', () => card.classList.remove('dragging'));
            });
        });
    }

    createTaskCard(task) {
        const habit = task.habitId ? this.dataManager.getHabits().find(h => h.id === task.habitId) : null;
        
        return `
            <div class="task-card ${task.type === 'habit' ? 'habit-task' : ''} ${task.type === 'project' ? 'project-task' : ''}" 
                 data-task-id="${task.id}">
                <div class="task-header">
                    <div class="task-title">${task.name}</div>
                    <span class="task-type-badge ${task.type}">${
                        task.type === 'habit' ? '🔄 習慣' : 
                        task.type === 'project' ? '🎯 PJ' : '📋'
                    }</span>
                </div>
                ${task.desc ? `<div class="task-desc">${task.desc}</div>` : ''}
                <div class="task-meta">
                    ${task.estimatedTime ? `<span class="task-time">⏱️ ${task.estimatedTime}分</span>` : ''}
                    ${habit ? `<span class="task-streak">🔥 ${habit.streak}日</span>` : ''}
                </div>
                <div class="task-actions">
                    ${task.type === 'habit' ? `<button class="task-action-btn record" onclick="uiManager.openHabitLogModal('${task.habitId}')">記録</button>` : ''}
                    <button class="task-action-btn edit" onclick="uiManager.editTask('${task.id}')">編集</button>
                    <button class="task-action-btn delete" onclick="uiManager.deleteTask('${task.id}')">削除</button>
                </div>
            </div>
        `;
    }

    renderHabits() {
        const container = document.getElementById('habitsGrid');
        const habits = this.dataManager.getHabits();

        if (habits.length === 0) {
            container.innerHTML = '<p class="empty-message">習慣が登録されていません。「習慣追加」ボタンから追加してください。</p>';
            return;
        }

        container.innerHTML = habits.map(habit => this.createHabitCard(habit)).join('');
    }

    createHabitCard(habit) {
        const completedToday = this.dataManager.isHabitCompletedToday(habit.id);
        const logs = this.dataManager.getHabitLogs(habit.id);
        const totalDays = Math.floor((Date.now() - habit.createdAt) / (1000 * 60 * 60 * 24)) + 1;
        const completionRate = Math.round((logs.length / totalDays) * 100);

        // 最近7日間のカレンダー
        const calendarHtml = this.createHabitCalendar(habit.id);

        return `
            <div class="habit-card">
                <div class="habit-card-header">
                    <div class="habit-title-row">
                        <span class="habit-icon">${habit.icon || '📚'}</span>
                        <span class="habit-title">${habit.name}</span>
                    </div>
                    <button class="btn btn-danger" style="padding: 5px 10px; font-size: 0.8rem;" 
                            onclick="uiManager.deleteHabit('${habit.id}')">削除</button>
                </div>
                <div class="habit-card-body">
                    <div class="habit-stats">
                        <div class="habit-stat">
                            <div class="habit-stat-value">${habit.streak}</div>
                            <div class="habit-stat-label">連続日数</div>
                        </div>
                        <div class="habit-stat">
                            <div class="habit-stat-value">${habit.longestStreak}</div>
                            <div class="habit-stat-label">最長記録</div>
                        </div>
                        <div class="habit-stat">
                            <div class="habit-stat-value">${completionRate}%</div>
                            <div class="habit-stat-label">達成率</div>
                        </div>
                    </div>
                    <div class="habit-calendar">
                        ${calendarHtml}
                    </div>
                    <div class="habit-actions">
                        <button class="habit-action-btn" style="background: var(--success-color); color: white;" 
                                onclick="uiManager.openHabitLogModal('${habit.id}')" 
                                ${completedToday ? 'disabled' : ''}>
                            ${completedToday ? '✓ 記録済み' : '記録する'}
                        </button>
                        <button class="habit-action-btn" style="background: var(--info-color); color: white;" 
                                onclick="uiManager.editHabit('${habit.id}')">
                            編集
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    createHabitCalendar(habitId) {
        const today = new Date();
        const days = [];
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const logs = this.dataManager.getHabitLogs(habitId, dateStr);
            const isToday = i === 0;
            
            days.push(`
                <div class="habit-day ${logs.length > 0 ? 'completed' : ''} ${isToday ? 'today' : ''}"
                     title="${dateStr}">
                    ${date.getDate()}
                </div>
            `);
        }
        
        return days.join('');
    }

    renderReports() {
        const period = document.getElementById('reportPeriod')?.value || 'week';
        const container = document.getElementById('reportContent');

        let stats;
        let title;
        
        if (period === 'week') {
            stats = this.dataManager.getWeeklyStats();
            title = '今週の成果';
        } else if (period === 'month') {
            stats = this.dataManager.getMonthlyStats();
            title = '今月の成果';
        } else {
            stats = this.dataManager.getMonthlyStats(); // 簡略化
            title = '今年の成果';
        }

        const hours = Math.floor(stats.totalTime / 60);
        const minutes = stats.totalTime % 60;

        container.innerHTML = `
            <div class="report-section">
                <h3>${title}</h3>
                <div class="report-grid">
                    <div class="report-item">
                        <div class="report-value">${stats.tasksCompleted}</div>
                        <div class="report-label">完了タスク</div>
                    </div>
                    <div class="report-item">
                        <div class="report-value">${stats.habitLogs}</div>
                        <div class="report-label">習慣記録</div>
                    </div>
                    <div class="report-item">
                        <div class="report-value">${hours}h${minutes}m</div>
                        <div class="report-label">作業時間</div>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <h3>習慣別の詳細</h3>
                ${this.createHabitReport()}
            </div>
        `;
    }

    createHabitReport() {
        const habits = this.dataManager.getHabits();
        if (habits.length === 0) {
            return '<p class="empty-message">習慣データがありません</p>';
        }

        return habits.map(habit => {
            const logs = this.dataManager.getHabitLogs(habit.id);
            const totalTime = logs.reduce((sum, log) => sum + (log.time || 0), 0);
            const hours = Math.floor(totalTime / 60);
            const minutes = totalTime % 60;

            return `
                <div class="report-item" style="text-align: left; padding: 20px;">
                    <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 10px;">
                        ${habit.icon} ${habit.name}
                    </div>
                    <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                        <div>
                            <div style="font-size: 0.85rem; color: var(--text-secondary);">連続記録</div>
                            <div style="font-size: 1.3rem; font-weight: 600; color: var(--warning-color);">🔥 ${habit.streak}日</div>
                        </div>
                        <div>
                            <div style="font-size: 0.85rem; color: var(--text-secondary);">最長記録</div>
                            <div style="font-size: 1.3rem; font-weight: 600; color: var(--primary-color);">${habit.longestStreak}日</div>
                        </div>
                        <div>
                            <div style="font-size: 0.85rem; color: var(--text-secondary);">総記録回数</div>
                            <div style="font-size: 1.3rem; font-weight: 600; color: var(--secondary-color);">${logs.length}回</div>
                        </div>
                        <div>
                            <div style="font-size: 0.85rem; color: var(--text-secondary);">総時間</div>
                            <div style="font-size: 1.3rem; font-weight: 600; color: var(--info-color);">${hours}h${minutes}m</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderGoals() {
        const container = document.getElementById('goalsGrid');
        const goals = this.dataManager.getGoals();

        if (goals.length === 0) {
            container.innerHTML = '<p class="empty-message">目標が登録されていません。「目標追加」ボタンから追加してください。</p>';
            return;
        }

        container.innerHTML = goals.map(goal => this.createGoalCard(goal)).join('');
    }

    createGoalCard(goal) {
        const progress = this.dataManager.calculateGoalProgress(goal.id);
        const deadline = goal.deadline ? new Date(goal.deadline).toLocaleDateString('ja-JP') : '期限なし';

        const habitTags = (goal.habitIds || []).map(habitId => {
            const habit = this.dataManager.getHabits().find(h => h.id === habitId);
            return habit ? `<span class="goal-habit-tag">${habit.icon} ${habit.name}</span>` : '';
        }).join('');

        return `
            <div class="goal-card">
                <div class="goal-header">
                    <div class="goal-title">🎯 ${goal.name}</div>
                    <div class="goal-deadline">📅 ${deadline}</div>
                </div>
                <div class="goal-progress-bar">
                    <div class="goal-progress-fill" style="width: ${progress}%"></div>
                </div>
                <div style="text-align: center; font-weight: 600; color: var(--primary-color); margin-bottom: 15px;">
                    ${progress}% 達成
                </div>
                <div class="goal-habits">
                    ${habitTags}
                </div>
                ${goal.desc ? `<div style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 10px;">${goal.desc}</div>` : ''}
                <div style="display: flex; gap: 10px; margin-top: 15px;">
                    <button class="btn btn-info" style="flex: 1; padding: 8px;" onclick="uiManager.editGoal('${goal.id}')">編集</button>
                    <button class="btn btn-danger" style="flex: 1; padding: 8px;" onclick="uiManager.deleteGoal('${goal.id}')">削除</button>
                </div>
            </div>
        `;
    }

    // モーダル操作
    openModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    }

    openTaskModal(type = 'normal') {
        this.currentTask = null;
        document.getElementById('taskModalTitle').textContent = 'タスクを追加';
        document.getElementById('taskNameInput').value = '';
        document.getElementById('taskTypeInput').value = type;
        document.getElementById('taskDescInput').value = '';
        document.getElementById('taskTimeInput').value = '';
        
        if (type === 'habit') {
            document.getElementById('habitSelectGroup').style.display = 'block';
            this.populateHabitSelect();
        } else {
            document.getElementById('habitSelectGroup').style.display = 'none';
        }

        this.openModal('taskModal');
    }

    populateHabitSelect() {
        const select = document.getElementById('taskHabitInput');
        const habits = this.dataManager.getHabits();
        
        select.innerHTML = '<option value="">選択してください</option>' +
            habits.map(h => `<option value="${h.id}">${h.icon} ${h.name}</option>`).join('');
    }

    saveTask() {
        const name = document.getElementById('taskNameInput').value.trim();
        const type = document.getElementById('taskTypeInput').value;
        const desc = document.getElementById('taskDescInput').value.trim();
        const estimatedTime = parseInt(document.getElementById('taskTimeInput').value) || 0;
        const habitId = type === 'habit' ? document.getElementById('taskHabitInput').value : null;

        if (!name) {
            this.showNotification('タスク名を入力してください', 'error');
            return;
        }

        if (type === 'habit' && !habitId) {
            this.showNotification('習慣を選択してください', 'error');
            return;
        }

        const taskData = {
            name,
            type,
            desc,
            estimatedTime,
            habitId
        };

        if (this.currentTask) {
            this.dataManager.updateTask(this.currentTask.id, taskData);
            this.showNotification('タスクを更新しました', 'success');
        } else {
            this.dataManager.addTask(taskData);
            this.showNotification('タスクを追加しました', 'success');
        }

        this.closeModal('taskModal');
        this.renderTaskBoard();
        this.renderDashboard();
    }

    editTask(taskId) {
        const task = this.dataManager.getTasks().find(t => t.id === taskId);
        if (!task) return;

        this.currentTask = task;
        document.getElementById('taskModalTitle').textContent = 'タスクを編集';
        document.getElementById('taskNameInput').value = task.name;
        document.getElementById('taskTypeInput').value = task.type;
        document.getElementById('taskDescInput').value = task.desc || '';
        document.getElementById('taskTimeInput').value = task.estimatedTime || '';

        if (task.type === 'habit') {
            document.getElementById('habitSelectGroup').style.display = 'block';
            this.populateHabitSelect();
            document.getElementById('taskHabitInput').value = task.habitId || '';
        }

        this.openModal('taskModal');
    }

    deleteTask(taskId) {
        if (confirm('このタスクを削除しますか？')) {
            this.dataManager.deleteTask(taskId);
            this.renderTaskBoard();
            this.renderDashboard();
            this.showNotification('タスクを削除しました', 'success');
        }
    }

    openHabitModal() {
        this.currentHabit = null;
        document.getElementById('habitModalTitle').textContent = '習慣を追加';
        document.getElementById('habitNameInput').value = '';
        document.getElementById('habitIconInput').value = '📚';
        document.getElementById('habitFrequencyInput').value = 'daily';
        document.getElementById('habitTargetTimeInput').value = '';
        document.getElementById('habitReminderInput').value = '';
        document.getElementById('customDaysGroup').style.display = 'none';
        
        this.openModal('habitModal');
    }

    saveHabit() {
        const name = document.getElementById('habitNameInput').value.trim();
        const icon = document.getElementById('habitIconInput').value;
        const frequency = document.getElementById('habitFrequencyInput').value;
        const targetTime = parseInt(document.getElementById('habitTargetTimeInput').value) || 0;
        const reminder = document.getElementById('habitReminderInput').value;

        let customDays = null;
        if (frequency === 'custom') {
            customDays = Array.from(document.querySelectorAll('#customDaysGroup input:checked'))
                .map(cb => parseInt(cb.value));
            if (customDays.length === 0) {
                this.showNotification('曜日を選択してください', 'error');
                return;
            }
        }

        if (!name) {
            this.showNotification('習慣名を入力してください', 'error');
            return;
        }

        const habitData = {
            name,
            icon,
            frequency,
            customDays,
            targetTime,
            reminder
        };

        if (this.currentHabit) {
            this.dataManager.updateHabit(this.currentHabit.id, habitData);
            this.showNotification('習慣を更新しました', 'success');
        } else {
            this.dataManager.addHabit(habitData);
            this.showNotification('習慣を追加しました', 'success');
        }

        this.closeModal('habitModal');
        this.renderHabits();
        this.renderDashboard();
    }

    editHabit(habitId) {
        const habit = this.dataManager.getHabits().find(h => h.id === habitId);
        if (!habit) return;

        this.currentHabit = habit;
        document.getElementById('habitModalTitle').textContent = '習慣を編集';
        document.getElementById('habitNameInput').value = habit.name;
        document.getElementById('habitIconInput').value = habit.icon || '📚';
        document.getElementById('habitFrequencyInput').value = habit.frequency;
        document.getElementById('habitTargetTimeInput').value = habit.targetTime || '';
        document.getElementById('habitReminderInput').value = habit.reminder || '';

        if (habit.frequency === 'custom' && habit.customDays) {
            document.getElementById('customDaysGroup').style.display = 'block';
            document.querySelectorAll('#customDaysGroup input').forEach(cb => {
                cb.checked = habit.customDays.includes(parseInt(cb.value));
            });
        }

        this.openModal('habitModal');
    }

    deleteHabit(habitId) {
        if (confirm('この習慣を削除しますか？関連するタスクも削除されます。')) {
            this.dataManager.deleteHabit(habitId);
            // 関連タスクも削除
            const relatedTasks = this.dataManager.getTasks().filter(t => t.habitId === habitId);
            relatedTasks.forEach(task => this.dataManager.deleteTask(task.id));
            
            this.renderHabits();
            this.renderDashboard();
            this.renderTaskBoard();
            this.showNotification('習慣を削除しました', 'success');
        }
    }

    openHabitLogModal(habitId) {
        const habit = this.dataManager.getHabits().find(h => h.id === habitId);
        if (!habit) return;

        if (this.dataManager.isHabitCompletedToday(habitId)) {
            this.showNotification('今日は既に記録済みです', 'error');
            return;
        }

        this.currentHabit = habit;
        document.getElementById('habitLogModalTitle').textContent = `${habit.icon} ${habit.name} を記録`;
        document.getElementById('habitLogTimeInput').value = habit.targetTime || '';
        document.getElementById('habitLogNoteInput').value = '';
        
        this.openModal('habitLogModal');
    }

    saveHabitLog() {
        if (!this.currentHabit) return;

        const time = parseInt(document.getElementById('habitLogTimeInput').value) || 0;
        const note = document.getElementById('habitLogNoteInput').value.trim();

        this.dataManager.logHabit(this.currentHabit.id, { time, note });

        this.closeModal('habitLogModal');
        this.renderHabits();
        this.renderDashboard();
        this.renderTaskBoard();
        this.showNotification('習慣を記録しました！🎉', 'success');
    }

    openGoalModal() {
        this.currentGoal = null;
        document.getElementById('goalModalTitle').textContent = '目標を追加';
        document.getElementById('goalNameInput').value = '';
        document.getElementById('goalDeadlineInput').value = '';
        document.getElementById('goalDescInput').value = '';
        
        this.populateGoalHabitsSelector();
        this.openModal('goalModal');
    }

    populateGoalHabitsSelector() {
        const container = document.getElementById('goalHabitsSelector');
        const habits = this.dataManager.getHabits();

        if (habits.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.9rem;">習慣がありません</p>';
            return;
        }

        container.innerHTML = habits.map(habit => `
            <label>
                <input type="checkbox" value="${habit.id}" ${
                    this.currentGoal && this.currentGoal.habitIds && this.currentGoal.habitIds.includes(habit.id) ? 'checked' : ''
                }>
                ${habit.icon} ${habit.name}
            </label>
        `).join('');
    }

    saveGoal() {
        const name = document.getElementById('goalNameInput').value.trim();
        const deadline = document.getElementById('goalDeadlineInput').value;
        const desc = document.getElementById('goalDescInput').value.trim();
        const habitIds = Array.from(document.querySelectorAll('#goalHabitsSelector input:checked'))
            .map(cb => cb.value);

        if (!name) {
            this.showNotification('目標名を入力してください', 'error');
            return;
        }

        const goalData = {
            name,
            deadline,
            desc,
            habitIds
        };

        if (this.currentGoal) {
            this.dataManager.updateGoal(this.currentGoal.id, goalData);
            this.showNotification('目標を更新しました', 'success');
        } else {
            this.dataManager.addGoal(goalData);
            this.showNotification('目標を追加しました', 'success');
        }

        this.closeModal('goalModal');
        this.renderGoals();
    }

    editGoal(goalId) {
        const goal = this.dataManager.getGoals().find(g => g.id === goalId);
        if (!goal) return;

        this.currentGoal = goal;
        document.getElementById('goalModalTitle').textContent = '目標を編集';
        document.getElementById('goalNameInput').value = goal.name;
        document.getElementById('goalDeadlineInput').value = goal.deadline || '';
        document.getElementById('goalDescInput').value = goal.desc || '';
        
        this.populateGoalHabitsSelector();
        this.openModal('goalModal');
    }

    deleteGoal(goalId) {
        if (confirm('この目標を削除しますか？')) {
            this.dataManager.deleteGoal(goalId);
            this.renderGoals();
            this.showNotification('目標を削除しました', 'success');
        }
    }

    exportData() {
        const data = this.dataManager.exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `taskhabit_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showNotification('データをエクスポートしました', 'success');
    }

    importData() {
        const fileInput = document.getElementById('importFileInput');
        const file = fileInput.files[0];

        if (!file) {
            this.showNotification('ファイルを選択してください', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                this.dataManager.importData(e.target.result);
                this.closeModal('importModal');
                this.renderDashboard();
                this.renderTaskBoard();
                this.renderHabits();
                this.renderGoals();
                this.showNotification('データをインポートしました', 'success');
            } catch (error) {
                this.showNotification(error.message, 'error');
            }
        };
        reader.readAsText(file);
    }

    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type} show`;
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
}

// アプリ初期化
let authManager, dataManager, uiManager;

document.addEventListener('DOMContentLoaded', () => {
    authManager = new AuthManager();
    
    const currentUser = authManager.getCurrentUser();
    if (currentUser) {
        dataManager = new DataManager(currentUser.userId);
        uiManager = new UIManager(authManager, dataManager);
        uiManager.showApp();
    } else {
        uiManager = new UIManager(authManager, null);
    }
});
