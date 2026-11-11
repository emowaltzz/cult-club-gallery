/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // Говорим Next.js: "Сделай просто статический сайт"
  images: {
    unoptimized: true, // Отключаем оптимизацию картинок, чтобы не ломалось
  },
};

export default nextConfig;