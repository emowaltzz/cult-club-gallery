"use client";
import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    // Этот код создает невидимый iframe и загружает в него твой index.html.
    // Vercel не сможет «починить» или сломать скрипты внутри iframe, потому что это изолированная среда.
    const iframe = document.createElement('iframe');
    iframe.src = '/index.html'; // Убедись, что файл лежит в папке public и называется index.html
    iframe.style.width = '100vw';
    iframe.style.height = '100vh';
    iframe.style.border = 'none';
    iframe.style.position = 'fixed';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.zIndex = '99999';
    
    // Добавляем iframe на страницу
    document.body.appendChild(iframe);
    // Убираем отступы у body, чтобы iframe занимал весь экран
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';

    return () => {
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
    };
  }, []);

  return null; // Сама страница Next.js будет пустой, все покажет iframe
}