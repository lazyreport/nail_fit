import { useState, useEffect } from "react";
import { fetchData, insertData, updateData, deleteData } from "../lib/database";

interface Todo {
  id: number;
  title: string;
  completed: boolean;
}

export function ExampleComponent() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState("");

  useEffect(() => {
    loadTodos();
  }, []);

  async function loadTodos() {
    try {
      const data = await fetchData<Todo>("todos", {
        order: { column: "created_at", ascending: false },
      });
      setTodos(data);
    } catch (error) {
      console.error("Error loading todos:", error);
    }
  }

  async function handleAddTodo(e: React.FormEvent) {
    e.preventDefault();
    if (!newTodo.trim()) return;

    try {
      await insertData<Todo>("todos", {
        title: newTodo,
        completed: false,
      });
      setNewTodo("");
      loadTodos();
    } catch (error) {
      console.error("Error adding todo:", error);
    }
  }

  async function handleToggleTodo(todo: Todo) {
    try {
      await updateData<Todo>("todos", todo.id, {
        completed: !todo.completed,
      });
      loadTodos();
    } catch (error) {
      console.error("Error updating todo:", error);
    }
  }

  async function handleDeleteTodo(id: number) {
    try {
      await deleteData("todos", id);
      loadTodos();
    } catch (error) {
      console.error("Error deleting todo:", error);
    }
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Todo List</h2>

      <form onSubmit={handleAddTodo} className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            placeholder="Add a new todo"
            className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Add
          </button>
        </div>
      </form>

      <ul className="space-y-2">
        {todos.map((todo) => (
          <li
            key={todo.id}
            className="flex items-center justify-between p-3 bg-white rounded-lg shadow"
          >
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => handleToggleTodo(todo)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <span
                className={todo.completed ? "line-through text-gray-500" : ""}
              >
                {todo.title}
              </span>
            </div>
            <button
              onClick={() => handleDeleteTodo(todo.id)}
              className="text-red-600 hover:text-red-800"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
