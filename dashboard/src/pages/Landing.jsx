import { useNavigate } from 'react-router-dom'

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', minHeight: '100vh', background: '#f8f7ff' }}>

      {/* Nav */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 40px', background: 'white',
        borderBottom: '1px solid #ede9fe'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, background: '#534AB7', borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
          }}>💼</div>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>ApplyWise</span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => navigate('/login')} style={{
            padding: '8px 20px', borderRadius: 8, border: '1.5px solid #534AB7',
            background: 'white', color: '#534AB7', fontWeight: 600, cursor: 'pointer', fontSize: 14
          }}>Sign in</button>
          <button onClick={() => navigate('/register')} style={{
            padding: '8px 20px', borderRadius: 8, border: 'none',
            background: '#534AB7', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: 14
          }}>Get started free</button>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '80px 24px 60px' }}>
        <div style={{
          display: 'inline-block', background: '#ede9fe', color: '#534AB7',
          borderRadius: 20, padding: '4px 16px', fontSize: 13, fontWeight: 600, marginBottom: 24
        }}>Free job application tracker</div>
        <h1 style={{ fontSize: 48, fontWeight: 800, color: '#1a1a2e', margin: '0 0 20px', lineHeight: 1.2 }}>
          Never apply to the<br />same job twice
        </h1>
        <p style={{ fontSize: 18, color: '#6b7280', maxWidth: 520, margin: '0 auto 36px', lineHeight: 1.6 }}>
          ApplyWise automatically tracks your job applications from Gmail, warns you about duplicates, and gives you a clear dashboard of your job search.
        </p>
        <button onClick={() => navigate('/register')} style={{
          padding: '14px 36px', borderRadius: 12, border: 'none',
          background: '#534AB7', color: 'white', fontWeight: 700,
          cursor: 'pointer', fontSize: 16
        }}>Start tracking for free</button>
      </div>

      {/* Features */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 24,
        flexWrap: 'wrap', padding: '0 24px 80px'
      }}>
        {[
          { icon: '📧', title: 'Gmail Auto-Import', desc: 'Automatically detects job emails and logs applications — no manual entry needed.' },
          { icon: '🔴', title: 'Duplicate Warnings', desc: 'Chrome extension warns you in real-time if you visit a job you already applied to.' },
          { icon: '📊', title: 'Application Dashboard', desc: 'Track status, response rate, and trends across all your applications in one place.' },
        ].map(f => (
          <div key={f.title} style={{
            background: 'white', borderRadius: 16, padding: '28px 24px',
            width: 260, boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(83,74,183,0.07)',
            border: '1px solid #ede9fe'
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>{f.icon}</div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', margin: '0 0 8px' }}>{f.title}</h3>
            <p style={{ fontSize: 14, color: '#6b7280', margin: 0, lineHeight: 1.6 }}>{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        textAlign: 'center', padding: '24px', borderTop: '1px solid #ede9fe',
        fontSize: 13, color: '#9ca3af'
      }}>
        <a href="/privacy" style={{ color: '#534AB7', textDecoration: 'none' }}>Privacy Policy</a>
        {' · '}© 2026 ApplyWise
      </div>

    </div>
  )
}