"use client";
import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    window.location.replace('/index.html');
  }, []);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#888' }}>
      Загрузка галереи...
    </div>
  );
}