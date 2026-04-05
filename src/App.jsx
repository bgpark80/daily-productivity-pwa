import TaskForm from './components/TaskForm';
import TaskSection from './components/TaskSection';
import useLocalStorage from './hooks/useLocalStorage';
import usePwaInstall from './hooks/usePwaInstall';

const STORAGE_KEY = 'daily-focus-tasks';
const VALID_CATEGORIES = new Set(['want', 'must']);

const createTaskId = () => {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const normalizeTasks = (tasks) => {
  if (!Array.isArray(tasks)) {
    return [];
  }

  return tasks
    .filter((task) => task && typeof task === 'object')
    .map((task) => ({
      id: typeof task.id === 'string' && task.id ? task.id : createTaskId(),
      title: typeof task.title === 'string' ? task.title.trim() : '',
      category: VALID_CATEGORIES.has(task.category) ? task.category : 'want',
      completed: Boolean(task.completed),
      createdAt: typeof task.createdAt === 'number' ? task.createdAt : Date.now(),
      completedAt: typeof task.completedAt === 'number' ? task.completedAt : null
    }))
    .filter((task) => task.title);
};

function App() {
  const [storedTasks, setTasks] = useLocalStorage(STORAGE_KEY, []);
  const tasks = normalizeTasks(storedTasks);
  const { canInstall, isInstalled, promptInstall } = usePwaInstall();

  const addTask = ({ title, category }) => {
    const newTask = {
      id: createTaskId(),
      title,
      category,
      completed: false,
      createdAt: Date.now()
    };

    setTasks((currentTasks) => [newTask, ...currentTasks]);
  };

  const updateTask = (taskId, updates) => {
    setTasks((currentTasks) =>
      currentTasks.map((task) => (task.id === taskId ? { ...task, ...updates } : task))
    );
  };

  const deleteTask = (taskId) => {
    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== taskId));
  };

  const toggleTaskComplete = (taskId) => {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              completed: !task.completed,
              completedAt: !task.completed ? Date.now() : null
            }
          : task
      )
    );
  };

  const activeTasks = tasks.filter((task) => !task.completed);
  const wantTasks = activeTasks.filter((task) => task.category === 'want');
  const mustTasks = activeTasks.filter((task) => task.category === 'must');
  const completedTasks = tasks
    .filter((task) => task.completed)
    .sort((firstTask, secondTask) => (secondTask.completedAt || 0) - (firstTask.completedAt || 0));

  return (
    <main className="app-shell">
      <section className="hero panel">
        <p className="eyebrow">Personal Productivity PWA</p>
        <h1>Daily Focus</h1>
        <p className="hero-copy">
          Organize what you want to do, what you must do, and keep completed work in one simple
          place.
        </p>
        <div className="hero-actions">
          <button
            type="button"
            className={canInstall ? 'primary-button' : 'ghost-button'}
            onClick={() => {
              if (canInstall) {
                promptInstall();
              }
            }}
            disabled={!canInstall}
          >
            {isInstalled ? 'Installed' : canInstall ? 'Install app' : 'Install from browser menu'}
          </button>
          <p className="install-hint">
            {isInstalled
              ? 'This app is already installed on this device.'
              : canInstall
                ? 'Install Daily Focus for a full-screen app experience.'
                : 'If your browser does not show the install prompt, use its install or add-to-home-screen menu.'}
          </p>
        </div>
        <div className="stats-row">
          <article className="stat-card">
            <span className="stat-number">{wantTasks.length}</span>
            <span className="stat-label">Want to do</span>
          </article>
          <article className="stat-card">
            <span className="stat-number">{mustTasks.length}</span>
            <span className="stat-label">Must do</span>
          </article>
          <article className="stat-card">
            <span className="stat-number">{completedTasks.length}</span>
            <span className="stat-label">Completed</span>
          </article>
        </div>
      </section>

      <section className="panel">
        <TaskForm onAddTask={addTask} />
      </section>

      <div className="content-grid">
        <TaskSection
          title="Want to do"
          accent="want"
          tasks={wantTasks}
          emptyMessage="Add something flexible or fun to this list."
          onUpdateTask={updateTask}
          onDeleteTask={deleteTask}
          onToggleComplete={toggleTaskComplete}
        />

        <TaskSection
          title="Must do"
          accent="must"
          tasks={mustTasks}
          emptyMessage="Add the important tasks you need to finish today."
          onUpdateTask={updateTask}
          onDeleteTask={deleteTask}
          onToggleComplete={toggleTaskComplete}
        />
      </div>

      <TaskSection
        title="Completed tasks"
        accent="done"
        tasks={completedTasks}
        emptyMessage="Completed tasks will appear here."
        onUpdateTask={updateTask}
        onDeleteTask={deleteTask}
        onToggleComplete={toggleTaskComplete}
        completedSection
      />
    </main>
  );
}

export default App;
