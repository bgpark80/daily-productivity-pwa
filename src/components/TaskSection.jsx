import TaskItem from './TaskItem';

function TaskSection({
  title,
  tasks,
  emptyMessage,
  onUpdateTask,
  onDeleteTask,
  onToggleComplete,
  accent,
  completedSection = false
}) {
  return (
    <section className={`panel section-panel ${accent}`}>
      <div className="section-header">
        <h2>{title}</h2>
        <span className="section-count">{tasks.length}</span>
      </div>

      {tasks.length === 0 ? (
        <p className="empty-state">{emptyMessage}</p>
      ) : (
        <div className="task-list">
          {tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onUpdateTask={onUpdateTask}
              onDeleteTask={onDeleteTask}
              onToggleComplete={onToggleComplete}
              completedSection={completedSection}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default TaskSection;
