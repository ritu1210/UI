import { Link } from 'react-router-dom'
import { APP_NAME, APP_TAGLINE } from '../lib/constants'
import '../styles/login.css'

export default function Login() {
  return (
    <>
      <div className="auth-container">
        <div className="auth-brand">
          <div className="brand-content">
            <img className="brand-logo" src="/philips-white.png" alt="Philips" />
            <h1>{APP_NAME}</h1>
            <p>{APP_TAGLINE} — track full-time employee resources and give people managers a clear view of their reportees.</p>
            <div className="brand-features">
              <div className="feature"><i className="fas fa-shield-halved" /><span>Secure &amp; Compliant</span></div>
              <div className="feature"><i className="fas fa-users" /><span>Internal Access Only</span></div>
              <div className="feature"><i className="fas fa-lock" /><span>Azure AD Protected</span></div>
            </div>
          </div>
        </div>

        <div className="auth-form-panel">
          <div className="auth-form-wrapper">
            <div className="auth-header">
              <h2>Welcome Back</h2>
              <p>Sign in to access {APP_NAME}.</p>
            </div>
            <Link className="auth-btn" to="/">
              <i className="fas fa-building" /> Sign in with Philips SSO
            </Link>
            <p className="auth-note">
              <i className="fas fa-info-circle" />
              You will be signed in with your Philips account.
            </p>
          </div>
        </div>
      </div>

      <div className="stet-badge">
        <span className="stet-badge-text">Developed by STET</span>
      </div>
    </>
  )
}
