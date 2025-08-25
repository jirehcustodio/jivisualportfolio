import { useEffect, useState } from 'preact/hooks';

export default function HeroIsland() {
  const [greeting, setGreeting] = useState('Welcome!');
  useEffect(() => {
    try {
      const returning = sessionStorage.getItem('profile:returning') === '1';
      const fullName = localStorage.getItem('profile:currentName') || '';
      setGreeting(returning && fullName ? `Welcome back, ${fullName.split(' ')[0]}!` : 'Welcome!');
    } catch {}
  }, []);
  return (
    <div class="card" style="margin:1rem 0;">
      <h2 style="margin:0">{greeting}</h2>
      <p style="opacity:.8;margin:.4rem 0 0">This section is hydrated with Preact (Astro island). Smooth and fast.</p>
      <button class="cta-btn" onClick={() => alert('Hello from Preact island!')}>Ping</button>
    </div>
  );
}
