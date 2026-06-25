import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

function App() {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(localStorage.getItem("todo-token") || "");
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("todo-user");
    return raw ? JSON.parse(raw) : null;
  });
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState("");
  const [message, setMessage] = useState("");
  const isAuthenticated = Boolean(token);

  const authHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }),
    [token]
  );

  async function request(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, options);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      if (response.status === 401 && !path.startsWith("/auth/")) {
        logout();
        throw new Error("Session expired. Please log in again.");
      }
      throw new Error(body.error || `Request failed: ${response.status}`);
    }
    if (response.status === 204) return null;
    return response.json();
  }

  async function loadTodos() {
    if (!token) return;
    const data = await request("/todos", { headers: authHeaders });
    setTodos(data);
  }

  async function submitAuth(event) {
    event.preventDefault();
    setMessage("");

    try {
      const data = await request(`/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem("todo-token", data.token);
      localStorage.setItem("todo-user", JSON.stringify(data.user));
      setPassword("");
      setMessage(`Welcome, ${data.user.username}`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function addTodo(event) {
    event.preventDefault();
    if (!newTodo.trim()) return;

    try {
      await request("/todos", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ title: newTodo })
      });
      setNewTodo("");
      await loadTodos();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function toggleTodo(todo) {
    try {
      await request(`/todos/${todo.id}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ completed: !todo.completed })
      });
      await loadTodos();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deleteTodo(todo) {
    try {
      await request(`/todos/${todo.id}`, {
        method: "DELETE",
        headers: authHeaders
      });
      await loadTodos();
    } catch (error) {
      setMessage(error.message);
    }
  }

  function logout() {
    setToken("");
    setUser(null);
    setTodos([]);
    localStorage.removeItem("todo-token");
    localStorage.removeItem("todo-user");
  }

  useEffect(() => {
    loadTodos().catch((error) => setMessage(error.message));
  }, [token]);

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Fog and Cloud Computing Project</p>
        <h1>Cloud-Native TodoList</h1>
        <p>
          A small multi-user app deployed with Docker, Kubernetes, PostgreSQL,
          persistent storage, security controls, CI, and HPA.
        </p>
      </section>

      {message && <div className="message">{message}</div>}

      {!isAuthenticated ? (
        <section className="panel">
          <div className="tabs">
            <button
              className={mode === "login" ? "active" : ""}
              onClick={() => setMode("login")}
            >
              Login
            </button>
            <button
              className={mode === "register" ? "active" : ""}
              onClick={() => setMode("register")}
            >
              Register
            </button>
          </div>

          <form onSubmit={submitAuth} className="form">
            <label>
              Username
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                minLength="3"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength="6"
                required
              />
            </label>
            <button type="submit">
              {mode === "login" ? "Login" : "Create account"}
            </button>
          </form>
        </section>
      ) : (
        <section className="panel">
          <div className="topline">
            <div>
              <p className="eyebrow">Signed in as</p>
              <h2>{user?.username}</h2>
            </div>
            <button className="ghost" onClick={logout}>
              Logout
            </button>
          </div>

          <form className="todo-form" onSubmit={addTodo}>
            <input
              value={newTodo}
              onChange={(event) => setNewTodo(event.target.value)}
              placeholder="Add a new task"
            />
            <button type="submit">Add</button>
          </form>

          <div className="todo-list">
            {todos.length === 0 ? (
              <p className="empty">No todos yet. Add one above.</p>
            ) : (
              todos.map((todo) => (
                <article className="todo" key={todo.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={() => toggleTodo(todo)}
                    />
                    <span className={todo.completed ? "done" : ""}>
                      {todo.title}
                    </span>
                  </label>
                  <button className="danger" onClick={() => deleteTodo(todo)}>
                    Delete
                  </button>
                </article>
              ))
            )}
          </div>
        </section>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
