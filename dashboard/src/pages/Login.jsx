import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await axios.post(`${API}/auth/login`,
        new URLSearchParams({ username: email, password }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      )
      localStorage.setItem('token', res.data.access_token)
      navigate('/dashboard')
    } catch {
      setError('Incorrect email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#CBD5E8',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: '1rem'
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '52px', height: '52px',
            background: '#534AB7',
            borderRadius: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
            fontSize: '24px'
          }}>💼</div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1a1a2e', margin: 0 }}>ApplyWise</h1>
          <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>Never apply to the same job twice.</p>
        </div>

        {/* Card */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 8px 24px rgba(83,74,183,0.08)',
          border: '1px solid #ede9fe'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#1a1a2e', marginBottom: '1.5rem' }}>
            Sign in to your account
          </h2>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={{
                  width: '100%', padding: '10px 14px',
                  border: '1.5px solid #e5e7eb',
                  borderRadius: '10px', fontSize: '14px',
                  outline: 'none', color: '#1a1a2e',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s'
                }}
                onFocus={e => e.target.style.borderColor = '#534AB7'}
                onBlur={e => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%', padding: '10px 14px',
                  border: '1.5px solid #e5e7eb',
                  borderRadius: '10px', fontSize: '14px',
                  outline: 'none', color: '#1a1a2e',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s'
                }}
                onFocus={e => e.target.style.borderColor = '#534AB7'}
                onBlur={e => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            {error && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: '8px', padding: '10px 14px',
                fontSize: '13px', color: '#dc2626', marginBottom: '1rem'
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '11px',
                background: loading ? '#9ca3af' : '#534AB7',
                color: 'white', border: 'none',
                borderRadius: '10px', fontSize: '14px',
                fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s'
              }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: '13px', color: '#6b7280', marginTop: '1.25rem' }}>
            Don't have an account?{' '}
            <span
              onClick={() => navigate('/register')}
              style={{ color: '#534AB7', fontWeight: '500', cursor: 'pointer' }}
            >
              Create one free
            </span>
          </p>
        </div>

      </div>
    </div>
  )
}