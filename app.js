// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyByOPObpGD_NebwLZZJXnp_jDVeRu0IfSs",
  authDomain: "taskhabit-3c667.firebaseapp.com",
  projectId: "taskhabit-3c667",
  storageBucket: "taskhabit-3c667.firebasestorage.app",
  messagingSenderId: "235440561788",
  appId: "1:235440561788:web:9a5a5429908b14a4d0b3f9"
};

// Firebase モジュール（グローバルスコープから利用）
let auth, googleProvider, signInWithPopup, signOut;
let db, collection, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where;

// Firebase初期化を待つ
async function initFirebase() {
  // Firebase SDKの読み込みを待機
  while (!window.firebase || !window.firebaseAuth || !window.firebaseFirestore) {
    console.log('⏳ Firebase SDKの読み込み中...');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Firebase初期化
  const app = window.firebase.initializeApp(firebaseConfig);
  auth = window.firebaseAuth.getAuth(app);
  googleProvider = new window.firebaseAuth.GoogleAuthProvider();
  signInWithPopup = window.firebaseAuth.signInWithPopup;
  signOut = window.firebaseAuth.signOut;
  
  db = window.firebaseFirestore.getFirestore(app);
  collection = window.firebaseFirestore.collection;
  doc = window.firebaseFirestore.doc;
  getDoc = window.firebaseFirestore.getDoc;
  setDoc = window.firebaseFirestore.setDoc;
  updateDoc = window.firebaseFirestore.updateDoc;
  deleteDoc = window.firebaseFirestore.deleteDoc;
  onSnapshot = window.firebaseFirestore.onSnapshot;
  query = window.firebaseFirestore.query;
  where = window.firebaseFirestore.where;
  
  console.log('✅ Firebase初期化完了');
  return app;
}

// FirebaseAuthManager
class FirebaseAuthManager {
  constructor() {
    this.currentUser = null;
    this.onAuthStateChangedCallback = null;
  }
  
  async init() {
    return new Promise((resolve) => {
      window.firebaseAuth.onAuthStateChanged(auth, (user) => {
        if (user) {
          this.currentUser = {
            userId: user.uid,
            username: user.displayName || user.email,
            email: user.email,
            photoURL: user.photoURL
          };
          console.log('✅ ログイン済み:', this.currentUser.username);
        } else {
          this.currentUser = null;
          console.log('❌ 未ログイン');
        }
        
        if (this.onAuthStateChangedCallback) {
          this.onAuthStateChangedCallback(this.currentUser);
        }
        
        resolve(this.currentUser);
      });
    });
  }
  
  async loginWithGoogle() {
    try {
      console.log('🔐 Googleログイン開始...');
      const result = await signInWithPopup(auth, googleProvider);
      this.currentUser = {
        userId: result.user.uid,
        username: result.user.displayName || result.user.email,
        email: result.user.email,
        photoURL: result.user.photoURL
      };
      console.log('✅ ログイン成功:', this.currentUser.username);
      return this.currentUser;
    } catch (error) {
      console.error('❌ ログインエラー:', error);
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('ログインがキャンセルされました');
      }
      throw error;
    }
  }
  
  async logout() {
    try {
      await signOut(auth);
      this.currentUser = null;
      console.log('✅ ログアウト完了');
    } catch (error) {
      console.error('❌ ログアウトエラー:', error);
      throw error;
    }
  }
  
  getCurrentUser() {
    return this.currentUser;
  }
  
  onAuthStateChanged(callback) {
    this.onAuthStateChangedCallback = callback;
  }
}

// FirebaseDataManager
class FirebaseDataManager {
  constructor(userId) {
    this.userId = userId;
    this.data = {
      tasks: [],
      habits: [],
      goals: [],
      habitLogs: []
    };
    this.unsubscribers = [];
  }
  
  async init() {
    console.log('📊 データ初期化開始...');
    await this.loadAllData();
    this.setupRealtimeSync();
    console.log('✅ データ初期化完了');
  }
  
  async loadAllData() {
    // タスク読み込み
    const tasksRef = collection(db, `users/${this.userId}/tasks`);
    const tasksSnapshot = await getDoc(doc(db, `users/${this.userId}/data`, 'tasks'));
    if (tasksSnapshot.exists()) {
      this.data.tasks = tasksSnapshot.data().items || [];
    }
    
    // 習慣読み込み
    const habitsSnapshot = await getDoc(doc(db, `users/${this.userId}/data`, 'habits'));
    if (habitsSnapshot.exists()) {
      this.data.habits = habitsSnapshot.data().items || [];
    }
    
    // 目標読み込み
    const goalsSnapshot = await getDoc(doc(db, `users/${this.userId}/data`, 'goals'));
    if (goalsSnapshot.exists()) {
      this.data.goals = goalsSnapshot.data().items || [];
    }
    
    // 習慣ログ読み込み
    const logsSnapshot = await getDoc(doc(db, `users/${this.userId}/data`, 'habitLogs'));
    if (logsSnapshot.exists()) {
      this.data.habitLogs = logsSnapshot.data().items || [];
    }
  }
  
  setupRealtimeSync() {
    // タスクのリアルタイム同期
    const unsubTasks = onSnapshot(doc(db, `users/${this.userId}/data`, 'tasks'), (snapshot) => {
      if (snapshot.exists()) {
        this.data.tasks = snapshot.data().items || [];
        if (window.app && window.app.uiManager) {
          window.app.uiManager.refreshAllViews();
        }
      }
    });
    
    // 習慣のリアルタイム同期
    const unsubHabits = onSnapshot(doc(db, `users/${this.userId}/data`, 'habits'), (snapshot) => {
      if (snapshot.exists()) {
        this.data.habits = snapshot.data().items || [];
        if (window.app && window.app.uiManager) {
          window.app.uiManager.refreshAllViews();
        }
      }
    });
    
    this.unsubscribers.push(unsubTasks, unsubHabits);
  }
  
  generateId() {
    return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // タスク管理
  async addTask(task) {
    const newTask = {
      ...task,
      id: this.generateId(),
      createdAt: Date.now(),
      status: 'todo'
    };
    this.data.tasks.push(newTask);
    await setDoc(doc(db, `users/${this.userId}/data`, 'tasks'), {
      items: this.data.tasks,
      lastUpdated: Date.now()
    });
    return newTask;
  }
  
  async updateTask(taskId, updates) {
    const taskIndex = this.data.tasks.findIndex(t => t.id === taskId);
    if (taskIndex !== -1) {
      this.data.tasks[taskIndex] = {
        ...this.data.tasks[taskIndex],
        ...updates,
        updatedAt: Date.now()
      };
      await setDoc(doc(db, `users/${this.userId}/data`, 'tasks'), {
        items: this.data.tasks,
        lastUpdated: Date.now()
      });
      return this.data.tasks[taskIndex];
    }
    return null;
  }
  
  async deleteTask(taskId) {
    this.data.tasks = this.data.tasks.filter(t => t.id !== taskId);
    await setDoc(doc(db, `users/${this.userId}/data`, 'tasks'), {
      items: this.data.tasks,
      lastUpdated: Date.now()
    });
  }
  
  getTasks(filter = {}) {
    let tasks = [...this.data.tasks];
    if (filter.status) {
      tasks = tasks.filter(t => t.status === filter.status);
    }
    if (filter.type) {
      tasks = tasks.filter(t => t.type === filter.type);
    }
    return tasks;
  }
  
  // 習慣管理
  async addHabit(habit) {
    const newHabit = {
      ...habit,
      id: this.generateId(),
      createdAt: Date.now(),
      streak: 0,
      longestStreak: 0,
      totalCompleted: 0
    };
    this.data.habits.push(newHabit);
    await setDoc(doc(db, `users/${this.userId}/data`, 'habits'), {
      items: this.data.habits,
      lastUpdated: Date.now()
    });
    return newHabit;
  }
  
  async updateHabit(habitId, updates) {
    const habitIndex = this.data.habits.findIndex(h => h.id === habitId);
    if (habitIndex !== -1) {
      this.data.habits[habitIndex] = {
        ...this.data.habits[habitIndex],
        ...updates,
        updatedAt: Date.now()
      };
      await setDoc(doc(db, `users/${this.userId}/data`, 'habits'), {
        items: this.data.habits,
        lastUpdated: Date.now()
      });
      return this.data.habits[habitIndex];
    }
    return null;
  }
  
  async deleteHabit(habitId) {
    this.data.habits = this.data.habits.filter(h => h.id !== habitId);
    this.data.habitLogs = this.data.habitLogs.filter(l => l.habitId !== habitId);
    await setDoc(doc(db, `users/${this.userId}/data`, 'habits'), {
      items: this.data.habits,
      lastUpdated: Date.now()
    });
    await setDoc(doc(db, `users/${this.userId}/data`, 'habitLogs'), {
      items: this.data.habitLogs,
      lastUpdated: Date.now()
    });
  }
  
  getHabits() {
    return [...this.data.habits];
  }
  
  // 習慣ログ
  async logHabit(habitId, log) {
    const habit = this.data.habits.find(h => h.id === habitId);
    if (!habit) return null;
    
    const newLog = {
      ...log,
      id: this.generateId(),
      habitId,
      date: new Date().toISOString().split('T')[0],
      timestamp: Date.now()
    };
    
    this.data.habitLogs.push(newLog);
    
    // 連続記録更新
    habit.streak = (habit.streak || 0) + 1;
    habit.longestStreak = Math.max(habit.longestStreak || 0, habit.streak);
    habit.totalCompleted = (habit.totalCompleted || 0) + 1;
    
    await setDoc(doc(db, `users/${this.userId}/data`, 'habitLogs'), {
      items: this.data.habitLogs,
      lastUpdated: Date.now()
    });
    
    await this.updateHabit(habitId, {
      streak: habit.streak,
      longestStreak: habit.longestStreak,
      totalCompleted: habit.totalCompleted
    });
    
    return newLog;
  }
  
  // 目標管理
  async addGoal(goal) {
    const newGoal = {
      ...goal,
      id: this.generateId(),
      createdAt: Date.now(),
      progress: 0
    };
    this.data.goals.push(newGoal);
    await setDoc(doc(db, `users/${this.userId}/data`, 'goals'), {
      items: this.data.goals,
      lastUpdated: Date.now()
    });
    return newGoal;
  }
  
  async updateGoal(goalId, updates) {
    const goalIndex = this.data.goals.findIndex(g => g.id === goalId);
    if (goalIndex !== -1) {
      this.data.goals[goalIndex] = {
        ...this.data.goals[goalIndex],
        ...updates,
        updatedAt: Date.now()
      };
      await setDoc(doc(db, `users/${this.userId}/data`, 'goals'), {
        items: this.data.goals,
        lastUpdated: Date.now()
      });
      return this.data.goals[goalIndex];
    }
    return null;
  }
  
  async deleteGoal(goalId) {
    this.data.goals = this.data.goals.filter(g => g.id !== goalId);
    await setDoc(doc(db, `users/${this.userId}/data`, 'goals'), {
      items: this.data.goals,
      lastUpdated: Date.now()
    });
  }
  
  getGoals() {
    return [...this.data.goals];
  }
  
  exportData() {
    return JSON.stringify(this.data, null, 2);
  }
  
  async importData(jsonData) {
    try {
      const imported = JSON.parse(jsonData);
      this.data = {
        tasks: imported.tasks || [],
        habits: imported.habits || [],
        goals: imported.goals || [],
        habitLogs: imported.habitLogs || []
      };
      
      await setDoc(doc(db, `users/${this.userId}/data`, 'tasks'), {
        items: this.data.tasks,
        lastUpdated: Date.now()
      });
      await setDoc(doc(db, `users/${this.userId}/data`, 'habits'), {
        items: this.data.habits,
        lastUpdated: Date.now()
      });
      await setDoc(doc(db, `users/${this.userId}/data`, 'goals'), {
        items: this.data.goals,
        lastUpdated: Date.now()
      });
      await setDoc(doc(db, `users/${this.userId}/data`, 'habitLogs'), {
        items: this.data.habitLogs,
        lastUpdated: Date.now()
      });
      
      return true;
    } catch (error) {
      console.error('❌ インポートエラー:', error);
      return false;
    }
  }
  
  cleanup() {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
  }
}

// UIManager（完全版）
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
    // スクリーン
    this.loginScreen = document.getElementById('loginScreen');
    this.appScreen = document.getElementById('appScreen');
    
    // ボタン
    this.googleLoginBtn = document.getElementById('googleLoginBtn');
    this.logoutBtn = document.getElementById('logoutBtn');
    
    // ユーザー情報
    this.currentUserSpan = document.getElementById('currentUser');
    this.currentDate = document.getElementById('currentDate');
    
    // ナビゲーション
    this.navTabs = document.querySelectorAll('.nav-tabs button');
    
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
    // ログイン/ログアウト
    this.googleLoginBtn?.addEventListener('click', () => this.handleGoogleLogin());
    this.logoutBtn?.addEventListener('click', () => this.handleLogout());
    
    // ナビゲーション
    this.navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const view = tab.dataset.view;
        this.switchView(view);
      });
    });
    
    // タスク関連
    document.getElementById('addTaskBtn')?.addEventListener('click', () => this.openTaskModal());
    document.getElementById('saveTaskBtn')?.addEventListener('click', () => this.saveTask());
    document.getElementById('cancelTaskBtn')?.addEventListener('click', () => this.closeModal('taskModal'));
    
    // 習慣関連
    document.getElementById('addHabitBtn')?.addEventListener('click', () => this.openHabitModal());
    document.getElementById('saveHabitBtn')?.addEventListener('click', () => this.saveHabit());
    document.getElementById('cancelHabitBtn')?.addEventListener('click', () => this.closeModal('habitModal'));
    
    // 習慣ログ
    document.getElementById('saveHabitLogBtn')?.addEventListener('click', () => this.saveHabitLog());
    document.getElementById('cancelHabitLogBtn')?.addEventListener('click', () => this.closeModal('habitLogModal'));
    
    // 目標関連
    document.getElementById('addGoalBtn')?.addEventListener('click', () => this.openGoalModal());
    document.getElementById('saveGoalBtn')?.addEventListener('click', () => this.saveGoal());
    document.getElementById('cancelGoalBtn')?.addEventListener('click', () => this.closeModal('goalModal'));
    
    // データ管理
    document.getElementById('exportBtn')?.addEventListener('click', () => this.exportData());
    document.getElementById('importBtn')?.addEventListener('click', () => this.openModal('importModal'));
    document.getElementById('confirmImportBtn')?.addEventListener('click', () => this.importData());
    document.getElementById('cancelImportBtn')?.addEventListener('click', () => this.closeModal('importModal'));
    
    // モーダルのクローズボタン
    document.querySelectorAll('.close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        if (modal) {
          modal.style.display = 'none';
        }
      });
    });
    
    // タスクタイプ変更
    document.getElementById('taskType')?.addEventListener('change', (e) => {
      const habitOptions = document.getElementById('habitOptions');
      if (habitOptions) {
        habitOptions.style.display = e.target.value === 'habit' ? 'block' : 'none';
      }
    });
  }
  
  async handleGoogleLogin() {
    try {
      const debugDiv = document.getElementById('debugMessages');
      if (debugDiv) debugDiv.innerHTML += '<p>⏳ ログイン中...</p>';
      
      await this.authManager.loginWithGoogle();
      
      if (debugDiv) debugDiv.innerHTML += '<p>✅ ログイン成功！</p>';
      
      // DataManager初期化
      window.app.dataManager = new FirebaseDataManager(this.authManager.currentUser.userId);
      await window.app.dataManager.init();
      this.dataManager = window.app.dataManager;
      
      this.showApp();
    } catch (error) {
      console.error('❌ ログインエラー:', error);
      const debugDiv = document.getElementById('debugMessages');
      if (debugDiv) debugDiv.innerHTML += `<p>❌ エラー: ${error.message}</p>`;
      alert(`ログインに失敗しました: ${error.message}`);
    }
  }
  
  async handleLogout() {
    try {
      if (this.dataManager) {
        this.dataManager.cleanup();
      }
      await this.authManager.logout();
      this.loginScreen.style.display = 'flex';
      this.appScreen.style.display = 'none';
    } catch (error) {
      console.error('❌ ログアウトエラー:', error);
      alert('ログアウトに失敗しました');
    }
  }
  
  showApp() {
    this.loginScreen.style.display = 'none';
    this.appScreen.style.display = 'flex';
    this.currentUserSpan.textContent = this.authManager.currentUser.username;
    this.updateCurrentDate();
    this.switchView('dashboard');
  }
  
  updateCurrentDate() {
    const today = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    this.currentDate.textContent = today.toLocaleDateString('ja-JP', options);
  }
  
  switchView(view) {
    this.currentView = view;
    
    // すべてのビューを非表示
    this.dashboardView.style.display = 'none';
    this.tasksView.style.display = 'none';
    this.habitsView.style.display = 'none';
    this.reportsView.style.display = 'none';
    this.goalsView.style.display = 'none';
    
    // ナビゲーションタブのアクティブ状態更新
    this.navTabs.forEach(tab => {
      if (tab.dataset.view === view) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
    
    // 選択されたビューを表示
    switch (view) {
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
  
  refreshAllViews() {
    switch (this.currentView) {
      case 'dashboard':
        this.renderDashboard();
        break;
      case 'tasks':
        this.renderTaskBoard();
        break;
      case 'habits':
        this.renderHabits();
        break;
      case 'reports':
        this.renderReports();
        break;
      case 'goals':
        this.renderGoals();
        break;
    }
  }
  
  renderDashboard() {
    const tasks = this.dataManager.getTasks();
    const habits = this.dataManager.getHabits();
    
    // 今日のタスク数
    document.getElementById('todayTasks').textContent = tasks.filter(t => t.status !== 'done').length;
    
    // 習慣達成率
    const completedToday = habits.filter(h => h.lastCompleted === new Date().toISOString().split('T')[0]).length;
    const habitRate = habits.length > 0 ? Math.round((completedToday / habits.length) * 100) : 0;
    document.getElementById('habitProgress').textContent = `${habitRate}%`;
    
    // 最長連続記録
    const longestStreak = Math.max(0, ...habits.map(h => h.longestStreak || 0));
    document.getElementById('longestStreak').textContent = `${longestStreak}日`;
    
    // 作業時間（ダミー）
    document.getElementById('todayWorkTime').textContent = '0h 0m';
    
    // 今日の習慣
    const todayHabitsContainer = document.getElementById('todayHabits');
    todayHabitsContainer.innerHTML = habits.map(habit => `
      <div class="habit-item">
        <span>${habit.name}</span>
        <button onclick="window.app.uiManager.logHabitQuick('${habit.id}')">✓</button>
      </div>
    `).join('') || '<p>習慣が登録されていません</p>';
    
    // 今日のタスク
    const todayTasksContainer = document.getElementById('todayTasksList');
    const incompleteTasks = tasks.filter(t => t.status !== 'done');
    todayTasksContainer.innerHTML = incompleteTasks.map(task => `
      <div class="task-item">
        <input type="checkbox" onchange="window.app.uiManager.toggleTaskStatus('${task.id}', this.checked)">
        <span>${task.title}</span>
        <span class="task-priority priority-${task.priority || 'medium'}">${task.priority || 'medium'}</span>
      </div>
    `).join('') || '<p>タスクがありません</p>';
  }
  
  renderTaskBoard() {
    const tasks = this.dataManager.getTasks();
    
    // Kanban列
    ['todo', 'inProgress', 'done'].forEach(status => {
      const container = document.getElementById(`${status}Tasks`);
      const statusTasks = tasks.filter(t => t.status === status);
      
      container.innerHTML = statusTasks.map(task => `
        <div class="task-card" draggable="true">
          <h4>${task.title}</h4>
          <p>${task.description || ''}</p>
          <div class="task-meta">
            <span class="task-priority priority-${task.priority || 'medium'}">${task.priority || 'medium'}</span>
            ${task.deadline ? `<span class="task-deadline">📅 ${new Date(task.deadline).toLocaleDateString()}</span>` : ''}
          </div>
          <div class="task-actions">
            <button onclick="window.app.uiManager.editTask('${task.id}')">✏️</button>
            <button onclick="window.app.uiManager.deleteTask('${task.id}')">🗑️</button>
          </div>
        </div>
      `).join('') || '<p class="empty-state">タスクがありません</p>';
    });
  }
  
  renderHabits() {
    const habits = this.dataManager.getHabits();
    const habitsContainer = document.getElementById('habitsList');
    
    habitsContainer.innerHTML = habits.map(habit => `
      <div class="habit-card">
        <h3>${habit.name}</h3>
        <p>${habit.description || ''}</p>
        <div class="habit-stats">
          <div class="stat">
            <span class="stat-label">連続</span>
            <span class="stat-value">${habit.streak || 0}日</span>
          </div>
          <div class="stat">
            <span class="stat-label">最長</span>
            <span class="stat-value">${habit.longestStreak || 0}日</span>
          </div>
          <div class="stat">
            <span class="stat-label">合計</span>
            <span class="stat-value">${habit.totalCompleted || 0}回</span>
          </div>
        </div>
        <div class="habit-actions">
          <button onclick="window.app.uiManager.logHabitWithModal('${habit.id}')">記録</button>
          <button onclick="window.app.uiManager.editHabit('${habit.id}')">編集</button>
          <button onclick="window.app.uiManager.deleteHabit('${habit.id}')">削除</button>
        </div>
      </div>
    `).join('') || '<p class="empty-state">習慣が登録されていません</p>';
  }
  
  renderReports() {
    document.getElementById('reportsContent').innerHTML = `
      <h2>レポート機能</h2>
      <p>統計情報は今後実装予定です</p>
    `;
  }
  
  renderGoals() {
    const goals = this.dataManager.getGoals();
    const goalsContainer = document.getElementById('goalsList');
    
    goalsContainer.innerHTML = goals.map(goal => `
      <div class="goal-card">
        <h3>${goal.name}</h3>
        <p>${goal.description || ''}</p>
        ${goal.deadline ? `<p>期限: ${new Date(goal.deadline).toLocaleDateString()}</p>` : ''}
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${goal.progress || 0}%"></div>
        </div>
        <div class="goal-actions">
          <button onclick="window.app.uiManager.editGoal('${goal.id}')">編集</button>
          <button onclick="window.app.uiManager.deleteGoal('${goal.id}')">削除</button>
        </div>
      </div>
    `).join('') || '<p class="empty-state">目標が設定されていません</p>';
  }
  
  // タスク操作
  openTaskModal(task = null) {
    this.currentTask = task;
    
    if (task) {
      document.getElementById('taskTitle').value = task.title || '';
      document.getElementById('taskDescription').value = task.description || '';
      document.getElementById('taskPriority').value = task.priority || 'medium';
      document.getElementById('taskDeadline').value = task.deadline || '';
      document.getElementById('taskType').value = task.type || 'general';
    } else {
      document.getElementById('taskTitle').value = '';
      document.getElementById('taskDescription').value = '';
      document.getElementById('taskPriority').value = 'medium';
      document.getElementById('taskDeadline').value = '';
      document.getElementById('taskType').value = 'general';
    }
    
    this.openModal('taskModal');
  }
  
  async saveTask() {
    const taskData = {
      title: document.getElementById('taskTitle').value,
      description: document.getElementById('taskDescription').value,
      priority: document.getElementById('taskPriority').value,
      deadline: document.getElementById('taskDeadline').value,
      type: document.getElementById('taskType').value
    };
    
    if (!taskData.title) {
      alert('タスク名を入力してください');
      return;
    }
    
    try {
      if (this.currentTask) {
        await this.dataManager.updateTask(this.currentTask.id, taskData);
      } else {
        await this.dataManager.addTask(taskData);
      }
      
      this.closeModal('taskModal');
      this.refreshAllViews();
      this.showNotification('タスクを保存しました');
    } catch (error) {
      console.error('タスク保存エラー:', error);
      alert('タスクの保存に失敗しました');
    }
  }
  
  async editTask(taskId) {
    const task = this.dataManager.getTasks().find(t => t.id === taskId);
    if (task) {
      this.openTaskModal(task);
    }
  }
  
  async deleteTask(taskId) {
    if (confirm('このタスクを削除しますか？')) {
      await this.dataManager.deleteTask(taskId);
      this.refreshAllViews();
      this.showNotification('タスクを削除しました');
    }
  }
  
  async toggleTaskStatus(taskId, completed) {
    await this.dataManager.updateTask(taskId, {
      status: completed ? 'done' : 'todo'
    });
    this.refreshAllViews();
  }
  
  // 習慣操作
  openHabitModal(habit = null) {
    this.currentHabit = habit;
    
    if (habit) {
      document.getElementById('habitName').value = habit.name || '';
      document.getElementById('habitDescription').value = habit.description || '';
      document.getElementById('habitFrequency').value = habit.frequency || 'daily';
    } else {
      document.getElementById('habitName').value = '';
      document.getElementById('habitDescription').value = '';
      document.getElementById('habitFrequency').value = 'daily';
    }
    
    this.openModal('habitModal');
  }
  
  async saveHabit() {
    const habitData = {
      name: document.getElementById('habitName').value,
      description: document.getElementById('habitDescription').value,
      frequency: document.getElementById('habitFrequency').value
    };
    
    if (!habitData.name) {
      alert('習慣名を入力してください');
      return;
    }
    
    try {
      if (this.currentHabit) {
        await this.dataManager.updateHabit(this.currentHabit.id, habitData);
      } else {
        await this.dataManager.addHabit(habitData);
      }
      
      this.closeModal('habitModal');
      this.refreshAllViews();
      this.showNotification('習慣を保存しました');
    } catch (error) {
      console.error('習慣保存エラー:', error);
      alert('習慣の保存に失敗しました');
    }
  }
  
  async editHabit(habitId) {
    const habit = this.dataManager.getHabits().find(h => h.id === habitId);
    if (habit) {
      this.openHabitModal(habit);
    }
  }
  
  async deleteHabit(habitId) {
    if (confirm('この習慣を削除しますか？')) {
      await this.dataManager.deleteHabit(habitId);
      this.refreshAllViews();
      this.showNotification('習慣を削除しました');
    }
  }
  
  async logHabitQuick(habitId) {
    await this.dataManager.logHabit(habitId, {
      time: new Date().toLocaleTimeString(),
      note: ''
    });
    this.refreshAllViews();
    this.showNotification('習慣を記録しました');
  }
  
  logHabitWithModal(habitId) {
    this.currentHabit = this.dataManager.getHabits().find(h => h.id === habitId);
    this.openModal('habitLogModal');
  }
  
  async saveHabitLog() {
    const time = document.getElementById('habitLogTime').value;
    const note = document.getElementById('habitLogNote').value;
    
    await this.dataManager.logHabit(this.currentHabit.id, { time, note });
    this.closeModal('habitLogModal');
    this.refreshAllViews();
    this.showNotification('習慣を記録しました');
  }
  
  // 目標操作
  openGoalModal(goal = null) {
    this.currentGoal = goal;
    
    if (goal) {
      document.getElementById('goalName').value = goal.name || '';
      document.getElementById('goalDescription').value = goal.description || '';
      document.getElementById('goalDeadline').value = goal.deadline || '';
    } else {
      document.getElementById('goalName').value = '';
      document.getElementById('goalDescription').value = '';
      document.getElementById('goalDeadline').value = '';
    }
    
    this.openModal('goalModal');
  }
  
  async saveGoal() {
    const goalData = {
      name: document.getElementById('goalName').value,
      description: document.getElementById('goalDescription').value,
      deadline: document.getElementById('goalDeadline').value
    };
    
    if (!goalData.name) {
      alert('目標名を入力してください');
      return;
    }
    
    try {
      if (this.currentGoal) {
        await this.dataManager.updateGoal(this.currentGoal.id, goalData);
      } else {
        await this.dataManager.addGoal(goalData);
      }
      
      this.closeModal('goalModal');
      this.refreshAllViews();
      this.showNotification('目標を保存しました');
    } catch (error) {
      console.error('目標保存エラー:', error);
      alert('目標の保存に失敗しました');
    }
  }
  
  async editGoal(goalId) {
    const goal = this.dataManager.getGoals().find(g => g.id === goalId);
    if (goal) {
      this.openGoalModal(goal);
    }
  }
  
  async deleteGoal(goalId) {
    if (confirm('この目標を削除しますか？')) {
      await this.dataManager.deleteGoal(goalId);
      this.refreshAllViews();
      this.showNotification('目標を削除しました');
    }
  }
  
  // データ管理
  exportData() {
    const data = this.dataManager.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taskhabit_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showNotification('データをエクスポートしました');
  }
  
  async importData() {
    const fileInput = document.getElementById('importFile');
    const file = fileInput.files[0];
    
    if (!file) {
      alert('ファイルを選択してください');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const success = await this.dataManager.importData(e.target.result);
        if (success) {
          this.closeModal('importModal');
          this.refreshAllViews();
          this.showNotification('データをインポートしました');
        } else {
          alert('データのインポートに失敗しました');
        }
      } catch (error) {
        console.error('インポートエラー:', error);
        alert('データのインポートに失敗しました');
      }
    };
    reader.readAsText(file);
  }
  
  // ユーティリティ
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'block';
    }
  }
  
  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'none';
    }
  }
  
  showNotification(message) {
    const notification = document.getElementById('notification');
    if (notification) {
      notification.textContent = message;
      notification.style.display = 'block';
      setTimeout(() => {
        notification.style.display = 'none';
      }, 3000);
    }
  }
}

// アプリ初期化
async function initApp() {
  try {
    console.log('🚀 アプリ初期化開始...');
    
    // Firebase初期化
    await initFirebase();
    
    // AuthManager初期化
    const authManager = new FirebaseAuthManager();
    await authManager.init();
    
    // グローバルに公開
    window.app = {
      authManager,
      dataManager: null,
      uiManager: null
    };
    
    // 既存ユーザーチェック
    if (authManager.currentUser) {
      // DataManager初期化
      window.app.dataManager = new FirebaseDataManager(authManager.currentUser.userId);
      await window.app.dataManager.init();
      
      // UIManager初期化
      window.app.uiManager = new UIManager(authManager, window.app.dataManager);
      window.app.uiManager.showApp();
    } else {
      // UIManager初期化（ログイン画面用）
      window.app.uiManager = new UIManager(authManager, null);
    }
    
    console.log('✅ アプリ初期化完了');
    
    // ローディング非表示
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';
    
  } catch (error) {
    console.error('❌ アプリ初期化エラー:', error);
    alert('アプリの初期化に失敗しました。ページを再読み込みしてください。');
  }
}

// DOM読み込み完了時に実行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

console.log('✅ app.js 読み込み完了');
