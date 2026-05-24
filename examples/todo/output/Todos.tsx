"use client";
import * as React from "react";
import { useState } from "react";

export type TodoItem = { text: string; completed: boolean };
export type TodosProps = { initial?: TodoItem[] };
import Todo from "./Todo";

function Todos(props: TodosProps) {
  const [items, setItems] = useState<TodoItem[]>(() => props.initial || []);

  const [draft, setDraft] = useState<string>(() => "");

  function addTodo() {
    const text = draft.trim();
    if (!text) return;
    setItems([
      ...items,
      {
        text,
        completed: false,
      },
    ]);
    setDraft("");
  }

  function toggleTodo(index: number) {
    setItems(
      items.map((item, i) =>
        i === index ? { ...item, completed: !item.completed } : item
      )
    );
  }

  function removeTodo(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  return (
    <section className="todos">
      <h1>Todos</h1>
      <div className="add">
        <input
          type="text"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") addTodo();
          }}
        />
        <button onClick={(event) => addTodo()}>Add</button>
      </div>
      {items.length > 0 ? (
        <ul className="todo-list">
          {items?.map((item, index) => (
            <Todo
              text={item.text}
              completed={item.completed}
              onToggle={(event) => toggleTodo(index)}
              onRemove={(event) => removeTodo(index)}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export default Todos;
