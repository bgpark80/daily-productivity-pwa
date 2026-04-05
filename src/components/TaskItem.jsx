import { useState } from 'react';

function TaskItem({ task, onUpdateTask, onDeleteTask, onToggleComplete, completedSection = false }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [draftCategory, setDraftCategory] = useState(task.category);

  const handleSave = () => {
    const trimmedTitle = draftTitle.trim();

    if (!trimmedTitle) {
      return;
    }

    onUpdateTask(task.id, {
      title: trimmedTitle,
      category: draftCategory
    });

    setIsEditing(false);
  };

  const handleCancel = () => {
    setDraftTitle(task.title);
    setDraftCategory(task.category);
    setIsEditing(false);
  };

  return (
    <article className={completedSection ? 'task-card completed' : 'task-card'}>
      {isEditing ? (
        <div className="task-edit-form">
          <input
            type="text"
            className="task-input edit-input"
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            maxLength={120}
          />

          <select
            className="task-select"
            value={draftCategory}
            onChange={(event) => setDraftCategory(event.target.value)}
          >
            <option value="want">Want to do</option>
            <option value="must">Must do</option>
          </select>

          <div className="task-actions">
            <button type="button" className="primary-button small" onClick={handleSave}>
              Save
            </button>
            <button type="button" className="ghost-button small" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="task-copy">
            <span className={task.category === 'must' ? 'task-badge must' : 'task-badge'}>
              {task.category === 'must' ? 'Must do' : 'Want to do'}
            </span>
            <h3>{task.title}</h3>
          </div>

          <div className="task-actions">
            <button
              type="button"
              className="primary-button small"
              onClick={() => onToggleComplete(task.id)}
            >
              {completedSection ? 'Undo' : 'Complete'}
            </button>
            <button type="button" className="ghost-button small" onClick={() => setIsEditing(true)}>
              Edit
            </button>
            <button type="button" className="danger-button small" onClick={() => onDeleteTask(task.id)}>
              Delete
            </button>
          </div>
        </>
      )}
    </article>
  );
}

export default TaskItem;
