// ========================================
// TaskHabit - localStorage版（Firebase依存なし）
// ========================================

class TaskHabitApp {
    constructor() {
        this.tasks = [];
        this.habits = [];
        this.goals = [];
        this.habitLogs = [];
        this.currentView = 'dashboard';
        this.editingTaskId = null;
        this.editingHabitId = null;
        this.editingGoalId = null;
        
        this.init();
    }

    // 初期化
    init() {
        console.log('📊 TaskHabit アプリ初期化開始');
        this.loadData();
        this.setupEventListeners();
        this.updateCurrentDate();
        this.renderAll();
        console.log('✅ TaskHabit アプリ初期化完了');
    }

    // データ読み込み（localStorage）
    loadData() {
        try {
            this.tasks = JSON.parse(localStorage.getItem('taskhabit_tasks') || '[]');
            this.habits = JSON.parse(localStorage.getItem('taskhabit_habits') || '[]');
            this.goals = JSON.parse(localStorage.getItem('taskhabit_goals') || '[]');
            this.habitLogs = JSON.parse(localStorage.getItem('taskhabit_habitLogs') || '[]');
            console.log('✅ データ読み込み完了', { tasks: this.tasks.length, habits: this.habits.length, goals: this.goals.length });
        } catch (error) {
            console.error('❌ データ読み込みエラー:', error);
        }
    }

    // データ保存（localStorage）
    saveData() {
        try {
            localStorage.setItem('taskhabit_tasks', JSON.stringify(this.tasks));
            localStorage.setItem('taskhabit_habits', JSON.stringify(this.habits));
            localStorage.setItem('taskhabit_goals', JSON.stringify(this.goals));
            localStorage.setItem('taskhabit_habitLogs', JSON.stringify(this.habitLogs));
            console.log('✅ データ保存完了');
        } catch (error) {
            console.error('❌ データ保存エラー:', error);
        }
    }

    // イベントリスナー設定
    setupEventListeners() {
        // ナビゲーションタブ
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const view = e.target.dataset.view;
                this.switchView(view);
            });
        });

        // タスク関連
        document.getElementById('addTaskBtn')?.addEventListener('click', () => this.openTaskModal());
        document.getElementById('taskForm')?.addEventListener('submit', (e) => this.handleTaskSubmit(e));
        document.getElementById('cancelTaskBtn')?.addEventListener('click', () => this.closeTaskModal());

        // 習慣関連
        document.getElementById('addHabitBtn')?.addEventListener('click', () => this.openHabitModal());
        document.getElementById('habitForm')?.addEventListener('submit', (e) => this.handleHabitSubmit(e));
        document.getElementById('cancelHabitBtn')?.addEventListener('click', () => this.closeHabitModal());

        // 目標関連
        document.getElementById('addGoalBtn')?.addEventListener('click', () => this.openGoalModal());
        document.getElementById('goalForm')?.addEventListener('submit', (e) => this.handleGoalSubmit(e));
        document.getElementById('cancelGoalBtn')?.addEventListener('click', () => this.closeGoalModal());

        // エクスポート/インポート
        document.getElementById('exportBtn')?.addEventListener('click', () => this.exportData());
        document.getElementById('importBtn')?.addEventListener('click', () => this.importData());
        document.getElementById('fileInput')?.addEventListener('change', (e) => this.handleFileImport(e));

        // モーダル閉じる
        document.querySelectorAll('.modal .close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                e.target.closest('.modal').style.display = 'none';
            });
        });

        // モーダル外クリックで閉じる
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
    }

    // 現在の日付を更新
    updateCurrentDate() {
        const dateElement = document.getElementById('currentDate');
        if (dateElement) {
            const now = new Date();
            const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
            dateElement.textContent = now.toLocaleDateString('ja-JP', options);
        }
    }

    // ビュー切り替え
    switchView(view) {
        this.currentView = view;
        
        // タブのアクティブ状態更新
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.view === view) {
                tab.classList.add('active');
            }
        });

        // ビューの表示切り替え
        document.querySelectorAll('.view-container').forEach(container => {
            container.classList.remove('active');
        });
        document.getElementById(`${view}-view`)?.classList.add('active');

        // ビューに応じたレンダリング
        this.renderCurrentView();
    }

    // 全体レンダリング
    renderAll() {
        this.renderDashboard();
        this.renderTasks();
        this.renderHabits();
        this.renderGoals();
    }

    // 現在のビューをレンダリング
    renderCurrentView() {
        switch (this.currentView) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'tasks':
                this.renderTasks();
                break;
            case 'habits':
                this.renderHabits();
                break;
            case 'goals':
                this.renderGoals();
                break;
        }
    }

    // ダッシュボードレンダリング
    renderDashboard() {
        // 統計更新
        const today = new Date().toISOString().split('T')[0];
        const todayTasks = this.tasks.filter(t => t.dueDate === today);
        document.getElementById('totalTasks').textContent = todayTasks.length;

        // 習慣達成率
        const todayLogs = this.habitLogs.filter(log => log.date === today);
        const habitRate = this.habits.length > 0 
            ? Math.round((todayLogs.length / this.habits.length) * 100) 
            : 0;
        document.getElementById('habitStreak').textContent = `${habitRate}%`;

        // 最長連続記録
        const maxStreak = Math.max(...this.habits.map(h => h.currentStreak || 0), 0);
        document.getElementById('goalsProgress').textContent = maxStreak;

        // 累計作業時間（仮）
        document.getElementById('totalTime').textContent = '0h';

        // 今日のタスク表示
        this.renderTodayTasks(todayTasks);

        // アクティブな習慣表示
        this.renderActiveHabits();
    }

    // 今日のタスク表示
    renderTodayTasks(tasks) {
        const container = document.getElementById('todayTasks');
        if (!container) return;

        if (tasks.length === 0) {
            container.innerHTML = '<p class="empty-message">今日のタスクはありません</p>';
            return;
        }

        container.innerHTML = tasks.map(task => `
            <div class="task-item ${task.status}" data-id="${task.id}">
                <input type="checkbox" ${task.status === 'done' ? 'checked' : ''} 
                       onchange="app.toggleTaskStatus('${task.id}')">
                <div class="task-info">
                    <div class="task-title">${this.escapeHtml(task.title)}</div>
                    <div class="task-meta">
                        <span class="priority-badge priority-${task.priority}">${this.getPriorityText(task.priority)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // アクティブな習慣表示
    renderActiveHabits() {
        const container = document.getElementById('activeHabits');
        if (!container) return;

        if (this.habits.length === 0) {
            container.innerHTML = '<p class="empty-message">習慣を追加してください</p>';
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        
        container.innerHTML = this.habits.slice(0, 6).map(habit => {
            const todayLog = this.habitLogs.find(log => log.habitId === habit.id && log.date === today);
            const isCompleted = !!todayLog;

            return `
                <div class="habit-card ${isCompleted ? 'completed' : ''}" data-id="${habit.id}">
                    <div class="habit-icon">${habit.icon || '📚'}</div>
                    <div class="habit-name">${this.escapeHtml(habit.name)}</div>
                    <div class="habit-streak">🔥 ${habit.currentStreak || 0}日</div>
                    <button class="btn btn-small ${isCompleted ? 'btn-secondary' : 'btn-primary'}" 
                            onclick="app.toggleHabitLog('${habit.id}')"
                            ${isCompleted ? 'disabled' : ''}>
                        ${isCompleted ? '完了' : '記録'}
                    </button>
                </div>
            `;
        }).join('');
    }

    // タスクレンダリング
    renderTasks() {
        const todoColumn = document.getElementById('todoColumn');
        const inProgressColumn = document.getElementById('inProgressColumn');
        const doneColumn = document.getElementById('doneColumn');

        if (!todoColumn || !inProgressColumn || !doneColumn) return;

        const todoTasks = this.tasks.filter(t => t.status === 'todo');
        const inProgressTasks = this.tasks.filter(t => t.status === 'in_progress');
        const doneTasks = this.tasks.filter(t => t.status === 'done');

        todoColumn.innerHTML = this.renderTaskList(todoTasks);
        inProgressColumn.innerHTML = this.renderTaskList(inProgressTasks);
        doneColumn.innerHTML = this.renderTaskList(doneTasks);
    }

    // タスクリスト生成
    renderTaskList(tasks) {
        if (tasks.length === 0) {
            return '<p class="empty-message">タスクなし</p>';
        }

        return tasks.map(task => `
            <div class="task-item" data-id="${task.id}">
                <div class="task-info">
                    <div class="task-title">${this.escapeHtml(task.title)}</div>
                    ${task.description ? `<div class="task-description">${this.escapeHtml(task.description)}</div>` : ''}
                    <div class="task-meta">
                        <span class="priority-badge priority-${task.priority}">${this.getPriorityText(task.priority)}</span>
                        ${task.dueDate ? `<span class="due-date">📅 ${task.dueDate}</span>` : ''}
                    </div>
                </div>
                <div class="task-actions">
                    <button class="btn btn-small btn-secondary" onclick="app.editTask('${task.id}')">編集</button>
                    <button class="btn btn-small btn-danger" onclick="app.deleteTask('${task.id}')">削除</button>
                </div>
            </div>
        `).join('');
    }

    // 習慣レンダリング
    renderHabits() {
        const container = document.getElementById('habitsList');
        if (!container) return;

        if (this.habits.length === 0) {
            container.innerHTML = '<p class="empty-message">習慣を追加してください</p>';
            return;
        }

        const today = new Date().toISOString().split('T')[0];

        container.innerHTML = this.habits.map(habit => {
            const todayLog = this.habitLogs.find(log => log.habitId === habit.id && log.date === today);
            const isCompleted = !!todayLog;

            return `
                <div class="habit-card ${isCompleted ? 'completed' : ''}" data-id="${habit.id}">
                    <div class="habit-icon">${habit.icon || '📚'}</div>
                    <div class="habit-name">${this.escapeHtml(habit.name)}</div>
                    <div class="habit-frequency">${this.getFrequencyText(habit.frequency)}</div>
                    <div class="habit-streak">🔥 連続${habit.currentStreak || 0}日</div>
                    <div class="habit-actions">
                        <button class="btn btn-small ${isCompleted ? 'btn-secondary' : 'btn-primary'}" 
                                onclick="app.toggleHabitLog('${habit.id}')"
                                ${isCompleted ? 'disabled' : ''}>
                            ${isCompleted ? '完了' : '記録'}
                        </button>
                        <button class="btn btn-small btn-secondary" onclick="app.editHabit('${habit.id}')">編集</button>
                        <button class="btn btn-small btn-danger" onclick="app.deleteHabit('${habit.id}')">削除</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 目標レンダリング
    renderGoals() {
        const container = document.getElementById('goalsList');
        if (!container) return;

        if (this.goals.length === 0) {
            container.innerHTML = '<p class="empty-message">目標を追加してください</p>';
            return;
        }

        container.innerHTML = this.goals.map(goal => {
            const progress = Math.min(Math.round((goal.current / goal.target) * 100), 100);

            return `
                <div class="goal-card" data-id="${goal.id}">
                    <div class="goal-header">
                        <div class="goal-title">${this.escapeHtml(goal.title)}</div>
                        <div class="goal-progress">${progress}%</div>
                    </div>
                    ${goal.description ? `<div class="goal-description">${this.escapeHtml(goal.description)}</div>` : ''}
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <div class="goal-stats">
                        <span>現在: ${goal.current} / ${goal.target}</span>
                        ${goal.deadline ? `<span>期限: ${goal.deadline}</span>` : ''}
                    </div>
                    <div class="goal-actions">
                        <button class="btn btn-small btn-primary" onclick="app.incrementGoal('${goal.id}')">+1</button>
                        <button class="btn btn-small btn-secondary" onclick="app.editGoal('${goal.id}')">編集</button>
                        <button class="btn btn-small btn-danger" onclick="app.deleteGoal('${goal.id}')">削除</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // タスク追加/編集モーダル
    openTaskModal(taskId = null) {
        const modal = document.getElementById('taskModal');
        const title = document.getElementById('taskModalTitle');
        const form = document.getElementById('taskForm');
        
        if (taskId) {
            const task = this.tasks.find(t => t.id === taskId);
            if (task) {
                title.textContent = 'タスクを編集';
                document.getElementById('taskTitle').value = task.title;
                document.getElementById('taskDescription').value = task.description || '';
                document.getElementById('taskPriority').value = task.priority;
                document.getElementById('taskDueDate').value = task.dueDate || '';
                this.editingTaskId = taskId;
            }
        } else {
            title.textContent = 'タスクを追加';
            form.reset();
            this.editingTaskId = null;
        }
        
        modal.style.display = 'block';
    }

    closeTaskModal() {
        document.getElementById('taskModal').style.display = 'none';
        this.editingTaskId = null;
    }

    handleTaskSubmit(e) {
        e.preventDefault();
        
        const title = document.getElementById('taskTitle').value.trim();
        const description = document.getElementById('taskDescription').value.trim();
        const priority = document.getElementById('taskPriority').value;
        const dueDate = document.getElementById('taskDueDate').value;

        if (!title) return;

        if (this.editingTaskId) {
            // 編集
            const task = this.tasks.find(t => t.id === this.editingTaskId);
            if (task) {
                task.title = title;
                task.description = description;
                task.priority = priority;
                task.dueDate = dueDate;
                task.updatedAt = new Date().toISOString();
            }
        } else {
            // 新規追加
            const newTask = {
                id: this.generateId(),
                title,
                description,
                priority,
                dueDate,
                status: 'todo',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            this.tasks.push(newTask);
        }

        this.saveData();
        this.renderAll();
        this.closeTaskModal();
    }

    // タスクステータス切り替え
    toggleTaskStatus(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.status = task.status === 'done' ? 'todo' : 'done';
            task.updatedAt = new Date().toISOString();
            this.saveData();
            this.renderAll();
        }
    }

    editTask(taskId) {
        this.openTaskModal(taskId);
    }

    deleteTask(taskId) {
        if (confirm('このタスクを削除しますか？')) {
            this.tasks = this.tasks.filter(t => t.id !== taskId);
            this.saveData();
            this.renderAll();
        }
    }

    // 習慣モーダル
    openHabitModal(habitId = null) {
        const modal = document.getElementById('habitModal');
        const title = document.getElementById('habitModalTitle');
        const form = document.getElementById('habitForm');
        
        if (habitId) {
            const habit = this.habits.find(h => h.id === habitId);
            if (habit) {
                title.textContent = '習慣を編集';
                document.getElementById('habitName').value = habit.name;
                document.getElementById('habitFrequency').value = habit.frequency;
                document.getElementById('habitIcon').value = habit.icon || '';
                this.editingHabitId = habitId;
            }
        } else {
            title.textContent = '習慣を追加';
            form.reset();
            this.editingHabitId = null;
        }
        
        modal.style.display = 'block';
    }

    closeHabitModal() {
        document.getElementById('habitModal').style.display = 'none';
        this.editingHabitId = null;
    }

    handleHabitSubmit(e) {
        e.preventDefault();
        
        const name = document.getElementById('habitName').value.trim();
        const frequency = document.getElementById('habitFrequency').value;
        const icon = document.getElementById('habitIcon').value.trim() || '📚';

        if (!name) return;

        if (this.editingHabitId) {
            // 編集
            const habit = this.habits.find(h => h.id === this.editingHabitId);
            if (habit) {
                habit.name = name;
                habit.frequency = frequency;
                habit.icon = icon;
                habit.updatedAt = new Date().toISOString();
            }
        } else {
            // 新規追加
            const newHabit = {
                id: this.generateId(),
                name,
                frequency,
                icon,
                currentStreak: 0,
                bestStreak: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            this.habits.push(newHabit);
        }

        this.saveData();
        this.renderAll();
        this.closeHabitModal();
    }

    toggleHabitLog(habitId) {
        const today = new Date().toISOString().split('T')[0];
        const existingLog = this.habitLogs.find(log => log.habitId === habitId && log.date === today);

        if (existingLog) {
            return; // 既に記録済み
        }

        // 新規記録
        const newLog = {
            id: this.generateId(),
            habitId,
            date: today,
            createdAt: new Date().toISOString()
        };
        this.habitLogs.push(newLog);

        // 連続記録更新
        const habit = this.habits.find(h => h.id === habitId);
        if (habit) {
            habit.currentStreak = (habit.currentStreak || 0) + 1;
            habit.bestStreak = Math.max(habit.bestStreak || 0, habit.currentStreak);
        }

        this.saveData();
        this.renderAll();
    }

    editHabit(habitId) {
        this.openHabitModal(habitId);
    }

    deleteHabit(habitId) {
        if (confirm('この習慣を削除しますか？')) {
            this.habits = this.habits.filter(h => h.id !== habitId);
            this.habitLogs = this.habitLogs.filter(log => log.habitId !== habitId);
            this.saveData();
            this.renderAll();
        }
    }

    // 目標モーダル
    openGoalModal(goalId = null) {
        const modal = document.getElementById('goalModal');
        const title = document.getElementById('goalModalTitle');
        const form = document.getElementById('goalForm');
        
        if (goalId) {
            const goal = this.goals.find(g => g.id === goalId);
            if (goal) {
                title.textContent = '目標を編集';
                document.getElementById('goalTitle').value = goal.title;
                document.getElementById('goalDescription').value = goal.description || '';
                document.getElementById('goalTarget').value = goal.target;
                document.getElementById('goalCurrent').value = goal.current;
                document.getElementById('goalDeadline').value = goal.deadline || '';
                this.editingGoalId = goalId;
            }
        } else {
            title.textContent = '目標を追加';
            form.reset();
            this.editingGoalId = null;
        }
        
        modal.style.display = 'block';
    }

    closeGoalModal() {
        document.getElementById('goalModal').style.display = 'none';
        this.editingGoalId = null;
    }

    handleGoalSubmit(e) {
        e.preventDefault();
        
        const title = document.getElementById('goalTitle').value.trim();
        const description = document.getElementById('goalDescription').value.trim();
        const target = parseInt(document.getElementById('goalTarget').value);
        const current = parseInt(document.getElementById('goalCurrent').value);
        const deadline = document.getElementById('goalDeadline').value;

        if (!title || isNaN(target)) return;

        if (this.editingGoalId) {
            // 編集
            const goal = this.goals.find(g => g.id === this.editingGoalId);
            if (goal) {
                goal.title = title;
                goal.description = description;
                goal.target = target;
                goal.current = current;
                goal.deadline = deadline;
                goal.updatedAt = new Date().toISOString();
            }
        } else {
            // 新規追加
            const newGoal = {
                id: this.generateId(),
                title,
                description,
                target,
                current,
                deadline,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            this.goals.push(newGoal);
        }

        this.saveData();
        this.renderAll();
        this.closeGoalModal();
    }

    incrementGoal(goalId) {
        const goal = this.goals.find(g => g.id === goalId);
        if (goal && goal.current < goal.target) {
            goal.current += 1;
            goal.updatedAt = new Date().toISOString();
            this.saveData();
            this.renderAll();
        }
    }

    editGoal(goalId) {
        this.openGoalModal(goalId);
    }

    deleteGoal(goalId) {
        if (confirm('この目標を削除しますか？')) {
            this.goals = this.goals.filter(g => g.id !== goalId);
            this.saveData();
            this.renderAll();
        }
    }

    // データエクスポート
    exportData() {
        const data = {
            tasks: this.tasks,
            habits: this.habits,
            goals: this.goals,
            habitLogs: this.habitLogs,
            exportedAt: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `taskhabit-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        alert('データをエクスポートしました');
    }

    // データインポート
    importData() {
        document.getElementById('fileInput').click();
    }

    handleFileImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                
                if (confirm('現在のデータを上書きしてインポートしますか？')) {
                    this.tasks = data.tasks || [];
                    this.habits = data.habits || [];
                    this.goals = data.goals || [];
                    this.habitLogs = data.habitLogs || [];
                    
                    this.saveData();
                    this.renderAll();
                    alert('データをインポートしました');
                }
            } catch (error) {
                alert('ファイルの読み込みに失敗しました');
                console.error('Import error:', error);
            }
        };
        reader.readAsText(file);
    }

    // ユーティリティ
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getPriorityText(priority) {
        const map = { low: '低', medium: '中', high: '高' };
        return map[priority] || '中';
    }

    getFrequencyText(frequency) {
        const map = { daily: '毎日', weekly: '毎週', custom: 'カスタム' };
        return map[frequency] || '毎日';
    }
}

// アプリ起動
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new TaskHabitApp();
});
