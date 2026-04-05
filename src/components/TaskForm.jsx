import { useState } from 'react';

function TaskForm({ onAddTask }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('want');

  const handleSubmit = (event) => {
    event.preventDefault();

    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      return;
    }

    onAddTask({
      title: trimmedTitle,
      category
    });

    setTitle('');
  };

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <div className="form-heading">
        <h2>Add a task</h2>
        <p>Choose the task type first, then write a short clear action.</p>
      </div>

      <div className="category-toggle" role="group" aria-label="Task category">
        <button
          type="button"
          className={category === 'want' ? 'toggle-button active' : 'toggle-button'}
          onClick={() => setCategory('want')}
        >
          Want to do
        </button>
        <button
          type="button"
          className={category === 'must' ? 'toggle-button active must' : 'toggle-button'}
          onClick={() => setCategory('must')}
        >
          Must do
        </button>
      </div>

      <div className="task-entry-row">
        <input
          type="text"
          className="task-input"
          placeholder="Example: Review meeting notes"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={120}
        />
        <button type="submit" className="primary-button">
          Add task
        </button>
      </div>
    </form>
  );
}

export default TaskForm;
