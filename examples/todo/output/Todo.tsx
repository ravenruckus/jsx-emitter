"use client";
import * as React from "react";

export type TodoProps = {
  text: string;
  completed: boolean;
  onToggle: () => void;
  onRemove: () => void;
};

function Todo(props: TodoProps) {
  return (
    <li className={props.completed ? "completed" : ""}>
      <input
        type="checkbox"
        checked={props.completed}
        onChange={(event) => props.onToggle()}
      />
      <label>{props.text}</label>
      <button className="remove" onClick={(event) => props.onRemove()}>
        x
      </button>
    </li>
  );
}

export default Todo;
