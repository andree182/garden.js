// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import PlanEditor from './PlanEditor';
import './index.css'; // Optional: for basic styling like body margin removal

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <PlanEditor />
  </React.StrictMode>
);
