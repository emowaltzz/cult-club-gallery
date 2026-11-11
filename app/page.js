"use client";
import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    // Когда страница загрузится, перенаправляем на наш HTML
    window.location.href = '/index.html';
  }, []);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
      <p>Загрузка...</p>
    </div>
  );
}