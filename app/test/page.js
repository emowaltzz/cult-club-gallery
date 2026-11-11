"use client";
import { useState } from 'react';

export default function TestUpload() {
  const [status, setStatus] = useState('');

  const handleUpload = async (e) => {
    e.preventDefault();
    setStatus('Отправка...');
    
    const file = e.target.file.files[0];
    if (!file) {
      setStatus('Файл не выбран');
      return;
    }

    const formData = new FormData();
    formData.append('photo', file);
    formData.append('tag', '@test_user');

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setStatus('Успех! Ссылка: ' + data.url);
      } else {
        setStatus('Ошибка: ' + (data.error || 'Неизвестная ошибка'));
      }
    } catch (err) {
      setStatus('Ошибка сети: ' + err.message);
    }
  };

  return (
    <div style={{ padding: 50, fontFamily: 'sans-serif' }}>
      <h1>Тест отправки фото</h1>
      <form onSubmit={handleUpload}>
        <input type="file" name="file" accept="image/*" required />
        <button type="submit" style={{ marginLeft: 10, padding: '5px 15px' }}>Отправить</button>
      </form>
      <p style={{ marginTop: 20, color: status.includes('Ошибка') ? 'red' : 'blue' }}>
        {status}
      </p>
    </div>
  );
}